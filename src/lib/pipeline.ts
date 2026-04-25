/**
 * Civic Document Processing Pipeline
 *
 * Shared pipeline module used by both:
 * - Manual upload route (src/app/api/summarize/route.ts)
 * - Automated feed ingestion worker (C7)
 *
 * Handles: AI summarization, verification, translation, and database persistence.
 * Does NOT handle: rate limiting, dedup checks, PDF extraction, or HTTP concerns.
 */

import { generateJSON, MODEL, PROMPT_VERSION } from '@/lib/anthropic';
import { getServerClient } from '@/lib/supabase';
import { CIVIC_SUMMARIZE_SYSTEM, CIVIC_SUMMARIZE_USER } from '@/lib/prompts/civic-summarize';
import { CIVIC_VERIFY_SYSTEM, CIVIC_VERIFY_USER } from '@/lib/prompts/civic-verify';
import { CIVIC_TRANSLATE_SYSTEM, CIVIC_TRANSLATE_USER } from '@/lib/prompts/civic-translate';
import type { CivicContent, VerificationResult } from '@/lib/types';

export const MAX_TEXT_LENGTH = 100_000; // ~25K words, well within Claude's context

// ─── Public Types ───

export interface PipelineParams {
  /** Raw text extracted from the document (will be truncated if over MAX_TEXT_LENGTH). */
  extractedText: string;
  /** SHA-256 hash of the extracted text, used for source record. */
  contentHash: string;
  /** Canonical URL of the source government document. */
  sourceUrl: string;
  /** UUID of the jurisdiction. Defaults to Seattle (000...0004). */
  jurisdictionId?: string;
  /** Slug like 'resolution', 'budget', 'minutes'. Used to resolve document_type_id. */
  documentTypeSlug?: string;
  /** Previous brief ID for version linking (document update flow). */
  previousBriefId?: string | null;
  /** Authenticated user ID, if available. */
  userId?: string | null;
  /** Feed ID that triggered this ingestion, for audit tracking (C7). */
  ingestedByFeedId?: string | null;
}

export interface PipelineResult {
  /** Database ID of the saved source record, or null if DB unavailable. */
  source_id: string | null;
  /** Database IDs for each saved brief, or empty array if DB unavailable. */
  brief_ids: { language: string; brief_id: string }[];
  /** Verification result from LLM-as-Judge. */
  verification: { confidence_score: number; confidence_level: string };
  /** Structured civic content from the summarization step. */
  content: CivicContent;
  /** Translated content objects (currently Spanish only). */
  translations: { language: string; content: CivicContent }[];
  /** Previous version brief ID (passed through from params). */
  previous_version_id: string | null;
}

// ─── Jurisdiction Tagging ───

/**
 * Tag a brief with its direct jurisdiction and all ancestors.
 * Uses ON CONFLICT DO NOTHING for idempotency.
 */
export async function tagBriefJurisdictions(
  briefId: string,
  jurisdictionId: string,
  assignedBy: 'ai' | 'manual' | 'feed'
): Promise<void> {
  const db = safeGetDb();
  if (!db) return;

  // Insert direct relationship (fire-and-forget, ON CONFLICT is handled by unique constraint)
  try {
    await Promise.resolve(
      db.from('brief_jurisdictions').insert({
        brief_id: briefId,
        jurisdiction_id: jurisdictionId,
        relationship: 'direct',
        confidence: 1.0,
        assigned_by: assignedBy,
      })
    );
  } catch {
    // Unique constraint violation = already tagged, safe to ignore
  }

  // Get all ancestors and insert ancestor relationships
  try {
    const { data: ancestors } = await db.rpc('jurisdiction_ancestors', {
      jurisdiction_uuid: jurisdictionId,
    });

    if (ancestors && Array.isArray(ancestors)) {
      for (const ancestor of ancestors) {
        if (ancestor.id === jurisdictionId) continue;
        try {
          await Promise.resolve(
            db.from('brief_jurisdictions').insert({
              brief_id: briefId,
              jurisdiction_id: ancestor.id,
              relationship: 'ancestor',
              confidence: 1.0,
              assigned_by: 'ai',
            })
          );
        } catch {
          // Unique constraint violation, safe to ignore
        }
      }
    }
  } catch {
    // RPC not available (e.g., test environment), skip ancestor tagging
  }
}

// ─── Internal Helpers ───

/** Returns the Supabase server client, or null if not configured. */
function safeGetDb() {
  try {
    return getServerClient();
  } catch {
    return null;
  }
}

/** Build the plain-text summary string from structured civic content. */
function buildSummaryText(content: CivicContent): string {
  return [content.what_changed, content.who_affected, content.what_to_do, content.money]
    .filter(Boolean)
    .join(' ');
}

// ─── Main Export ───

/**
 * Run the full civic document processing pipeline.
 *
 * Steps:
 * 1. Truncate text if needed
 * 2. Summarize with Claude (civic-context prompt)
 * 3. Verify with LLM-as-Judge
 * 4. Translate to Spanish
 * 5. Persist to database (if available)
 *
 * Throws on AI failures. Returns partial result (null IDs) on DB failure.
 */
export async function processCivicDocument(params: PipelineParams): Promise<PipelineResult> {
  const {
    extractedText: rawText,
    contentHash,
    sourceUrl,
    jurisdictionId,
    documentTypeSlug,
    previousBriefId = null,
    userId = null,
    ingestedByFeedId = null,
  } = params;

  // Truncate to stay within Claude's optimal context window
  const extractedText =
    rawText.length > MAX_TEXT_LENGTH ? rawText.slice(0, MAX_TEXT_LENGTH) : rawText;

  // Step 1: Civic summarization
  const civicContent = await generateJSON<CivicContent>(
    CIVIC_SUMMARIZE_SYSTEM,
    CIVIC_SUMMARIZE_USER(extractedText)
  );

  // Step 2: LLM-as-Judge verification
  const verification = await generateJSON<VerificationResult>(
    CIVIC_VERIFY_SYSTEM,
    CIVIC_VERIFY_USER(extractedText, JSON.stringify(civicContent, null, 2))
  );

  // Step 3: Translate to Spanish
  const spanishContent = await generateJSON<CivicContent>(
    CIVIC_TRANSLATE_SYSTEM,
    CIVIC_TRANSLATE_USER(JSON.stringify(civicContent, null, 2), 'es', 'Spanish')
  );

  const summaryText = buildSummaryText(civicContent);
  const spanishSummaryText = buildSummaryText(spanishContent);

  const translations = [{ language: 'es', content: spanishContent }];

  // Step 4: Persist to database (gracefully skip if unavailable)
  const db = safeGetDb();

  if (!db) {
    return {
      source_id: null,
      brief_ids: [],
      verification: {
        confidence_score: verification.confidence_score,
        confidence_level: verification.confidence_level,
      },
      content: civicContent,
      translations,
      previous_version_id: previousBriefId,
    };
  }

  const resolvedJurisdictionId = jurisdictionId ?? '00000000-0000-0000-0000-000000000004';

  // Resolve document type ID
  let documentTypeId = 1;
  const slugToResolve = documentTypeSlug ?? civicContent.document_type ?? null;
  if (slugToResolve) {
    const { data: dt } = await db
      .from('document_types')
      .select('id')
      .eq('slug', slugToResolve)
      .maybeSingle();
    if (dt) documentTypeId = (dt as { id: number }).id;
  }

  // Insert source record
  const { data: sourceData, error: sourceError } = await db
    .from('sources')
    .insert({
      jurisdiction_id: resolvedJurisdictionId,
      document_type_id: documentTypeId,
      title: civicContent.title,
      source_url: sourceUrl,
      content_hash: contentHash,
      factuality_score: verification.confidence_score,
      confidence_level: verification.confidence_level,
      requires_review: verification.confidence_level === 'low',
      status: 'processed',
      ...(userId ? { submitted_by: userId } : {}),
      ...(ingestedByFeedId ? { ingested_by_feed_id: ingestedByFeedId } : {}),
    })
    .select('id')
    .single();

  if (sourceError) throw sourceError;
  const source = sourceData as { id: string };

  // Insert English brief
  const { data: enBriefData, error: enError } = await db
    .from('briefs')
    .insert({
      source_id: source.id,
      language_id: 1, // English
      headline: civicContent.title,
      summary: summaryText,
      content: civicContent,
      who_affected: civicContent.who_affected,
      what_action: civicContent.what_to_do,
      is_published: true,
      published_at: new Date().toISOString(),
      model_used: MODEL,
      prompt_version: PROMPT_VERSION,
      tags: [civicContent.document_type].filter(Boolean),
      ...(previousBriefId ? { previous_version_id: previousBriefId } : {}),
    })
    .select('id')
    .single();

  if (enError) throw enError;
  const enBrief = enBriefData as { id: string };

  // Insert Spanish brief
  const { data: esBriefData, error: esError } = await db
    .from('briefs')
    .insert({
      source_id: source.id,
      language_id: 2, // Spanish
      headline: spanishContent.title,
      summary: spanishSummaryText,
      content: spanishContent,
      who_affected: spanishContent.who_affected,
      what_action: spanishContent.what_to_do,
      is_published: true,
      published_at: new Date().toISOString(),
      model_used: MODEL,
      prompt_version: PROMPT_VERSION,
      tags: [spanishContent.document_type].filter(Boolean),
    })
    .select('id')
    .single();

  if (esError) throw esError;
  const esBrief = esBriefData as { id: string };

  // Tag briefs with jurisdictions (direct + ancestors)
  const tagAssignedBy = params.ingestedByFeedId ? 'feed' as const : (params.jurisdictionId ? 'manual' as const : 'ai' as const);
  await tagBriefJurisdictions(enBrief.id, resolvedJurisdictionId, tagAssignedBy);
  await tagBriefJurisdictions(esBrief.id, resolvedJurisdictionId, tagAssignedBy);

  return {
    source_id: source.id,
    brief_ids: [
      { language: 'en', brief_id: enBrief.id },
      { language: 'es', brief_id: esBrief.id },
    ],
    verification: {
      confidence_score: verification.confidence_score,
      confidence_level: verification.confidence_level,
    },
    content: civicContent,
    translations,
    previous_version_id: previousBriefId,
  };
}
