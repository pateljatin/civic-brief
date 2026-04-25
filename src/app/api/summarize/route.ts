import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPDF, hashText, PDFExtractionError } from '@/lib/pdf-extract';
import { generateJSON, MODEL, PROMPT_VERSION } from '@/lib/anthropic';
import { getServerClient } from '@/lib/supabase';
import { createAuthServerClient } from '@/lib/supabase-server';
import { CIVIC_SUMMARIZE_SYSTEM, CIVIC_SUMMARIZE_USER } from '@/lib/prompts/civic-summarize';
import { CIVIC_VERIFY_SYSTEM, CIVIC_VERIFY_USER } from '@/lib/prompts/civic-verify';
import { CIVIC_TRANSLATE_SYSTEM, CIVIC_TRANSLATE_USER } from '@/lib/prompts/civic-translate';
import { rateLimit, validateUrl, validateFile, sanitizeText, isValidUUID, safeErrorMessage } from '@/lib/security';
import type { CivicContent, VerificationResult } from '@/lib/types';

/** Normalize a URL for comparison: lowercase host, strip www, remove trailing slash. */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const MAX_TEXT_LENGTH = 100_000; // ~25K words, well within Claude's context
const DAILY_LIMIT = parseInt(process.env.DEMO_DAILY_LIMIT || '10', 10);

/** Check how many documents have been processed today. Returns remaining count. */
async function checkDailyLimit(): Promise<{ remaining: number; allowed: boolean }> {
  const db = safeGetDb();
  if (!db) return { remaining: DAILY_LIMIT, allowed: true };

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count } = await db
    .from('sources')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString());

  const used = count || 0;
  const remaining = Math.max(0, DAILY_LIMIT - used);
  return { remaining, allowed: remaining > 0 };
}

export async function POST(request: NextRequest) {
  // Rate limiting (per-IP)
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  // Daily global limit (cost protection)
  const { remaining, allowed } = await checkDailyLimit();
  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Daily demo limit reached. This is a free demo with limited daily capacity. Try again tomorrow.',
        dailyLimit: DAILY_LIMIT,
        remaining: 0,
      },
      { status: 429 }
    );
  }

  // Extract authenticated user (optional, works without auth)
  let userId: string | null = null;
  try {
    const authClient = await createAuthServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Auth not configured or no session, continue anonymously
  }

  const startTime = Date.now();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sourceUrl = formData.get('sourceUrl') as string | null;
    const jurisdictionId = formData.get('jurisdictionId') as string | null;
    const documentTypeSlug = formData.get('documentTypeSlug') as string | null;

    // Validate source URL
    if (!sourceUrl) {
      return NextResponse.json(
        { error: 'Source URL is required. Provide the URL where this document is published.' },
        { status: 400 }
      );
    }
    const urlCheck = validateUrl(sourceUrl);
    if (!urlCheck.valid) {
      return NextResponse.json({ error: urlCheck.error }, { status: 400 });
    }

    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: 'A PDF file is required.' },
        { status: 400 }
      );
    }
    const fileCheck = validateFile(file);
    if (!fileCheck.valid) {
      return NextResponse.json({ error: fileCheck.error }, { status: 400 });
    }

    // Validate optional jurisdictionId
    if (jurisdictionId && !isValidUUID(jurisdictionId)) {
      return NextResponse.json(
        { error: 'Invalid jurisdiction ID format.' },
        { status: 400 }
      );
    }

    // Sanitize optional text inputs
    const cleanDocTypeSlug = documentTypeSlug ? sanitizeText(documentTypeSlug, 50) : null;

    // 1. Extract text from PDF (in memory, never written to disk)
    const buffer = await file.arrayBuffer();
    let extractedText: string;
    try {
      extractedText = await extractTextFromPDF(buffer);
    } catch (e) {
      if (e instanceof PDFExtractionError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    if (extractedText.length > MAX_TEXT_LENGTH) {
      extractedText = extractedText.slice(0, MAX_TEXT_LENGTH);
    }

    // 2. Hash for dedup
    const contentHash = await hashText(extractedText);

    // 3. Check for duplicate or update
    const db = safeGetDb();
    let previousBriefId: string | null = null;

    if (db) {
      // 3a. Check content hash (exact duplicate)
      const { data: hashMatch, error: hashError } = await db
        .from('sources')
        .select('id, source_url, metadata, duplicate_count')
        .eq('content_hash', contentHash)
        .maybeSingle();

      if (hashError) {
        console.error('Hash lookup error:', hashError);
      }

      if (hashMatch) {
        // Increment duplicate count
        Promise.resolve(
          db.from('sources')
            .update({ duplicate_count: ((hashMatch as Record<string, unknown>).duplicate_count as number || 0) + 1 })
            .eq('id', hashMatch.id)
        ).catch((err: unknown) => console.error('Failed to increment duplicate_count:', err));

        // Store alternate URL if different
        const normalizedUpload = normalizeUrl(sourceUrl);
        const normalizedStored = normalizeUrl(hashMatch.source_url);
        if (normalizedUpload !== normalizedStored) {
          const meta = (hashMatch.metadata as Record<string, unknown>) || {};
          const altUrls: string[] = (meta.alternate_urls as string[]) || [];
          if (!altUrls.includes(normalizedUpload)) {
            altUrls.push(normalizedUpload);
            await db
              .from('sources')
              .update({ metadata: { ...meta, alternate_urls: altUrls } })
              .eq('id', hashMatch.id);
          }
        }

        // Fetch existing English brief
        const { data: existingBrief } = await db
          .from('briefs')
          .select('id')
          .eq('source_id', hashMatch.id)
          .eq('language_id', 1)
          .maybeSingle();

        return NextResponse.json({
          duplicate: true,
          sourceId: hashMatch.id,
          briefId: existingBrief?.id || null,
          message: 'This document was already processed.',
          redirectUrl: existingBrief ? `/brief/${existingBrief.id}` : null,
        });
      }

      // 3b. Check URL match (same URL, different hash = document update)
      const { data: urlMatch } = await db
        .from('sources')
        .select('id')
        .eq('source_url', sourceUrl)
        .maybeSingle();

      if (urlMatch) {
        // Find the old brief to link as previous version
        const { data: oldBrief } = await db
          .from('briefs')
          .select('id')
          .eq('source_id', urlMatch.id)
          .eq('language_id', 1)
          .maybeSingle();

        previousBriefId = oldBrief?.id || null;
      }
    }

    // 4. Civic summarization
    const civicContent = await generateJSON<CivicContent>(
      CIVIC_SUMMARIZE_SYSTEM,
      CIVIC_SUMMARIZE_USER(extractedText)
    );

    // 5. LLM-as-Judge verification
    const verification = await generateJSON<VerificationResult>(
      CIVIC_VERIFY_SYSTEM,
      CIVIC_VERIFY_USER(extractedText, JSON.stringify(civicContent, null, 2))
    );

    // 6. Translate to Spanish
    const spanishContent = await generateJSON<CivicContent>(
      CIVIC_TRANSLATE_SYSTEM,
      CIVIC_TRANSLATE_USER(JSON.stringify(civicContent, null, 2), 'es', 'Spanish')
    );

    // 7. Build plain-text summary from structured content
    const summaryText = [
      civicContent.what_changed,
      civicContent.who_affected,
      civicContent.what_to_do,
      civicContent.money,
    ]
      .filter(Boolean)
      .join(' ');

    const spanishSummaryText = [
      spanishContent.what_changed,
      spanishContent.who_affected,
      spanishContent.what_to_do,
      spanishContent.money,
    ]
      .filter(Boolean)
      .join(' ');

    // 8. Save to database (if configured)
    if (db) {
      const resolvedJurisdictionId = jurisdictionId || '00000000-0000-0000-0000-000000000004'; // default: Seattle

      // Resolve document type
      let documentTypeId = 1;
      if (cleanDocTypeSlug) {
        const { data: dt } = await db
          .from('document_types')
          .select('id')
          .eq('slug', cleanDocTypeSlug)
          .single();
        if (dt) documentTypeId = dt.id;
      } else if (civicContent.document_type) {
        const { data: dt } = await db
          .from('document_types')
          .select('id')
          .eq('slug', civicContent.document_type)
          .single();
        if (dt) documentTypeId = dt.id;
      }

      // Insert source
      let source;
      try {
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
          })
          .select('id')
          .single();

        if (sourceError) throw sourceError;
        source = sourceData;
      } catch (insertErr: unknown) {
        // Race condition: another request inserted the same hash concurrently
        const pgError = insertErr as { code?: string };
        if (pgError.code === '23505') {
          // Fall back to duplicate path
          const { data: raceMatch } = await db
            .from('sources')
            .select('id')
            .eq('content_hash', contentHash)
            .single();

          const { data: raceBrief } = await db
            .from('briefs')
            .select('id')
            .eq('source_id', raceMatch?.id)
            .eq('language_id', 1)
            .maybeSingle();

          return NextResponse.json({
            duplicate: true,
            sourceId: raceMatch?.id || null,
            briefId: raceBrief?.id || null,
            message: 'This document was already processed.',
            redirectUrl: raceBrief ? `/brief/${raceBrief.id}` : null,
          });
        }
        throw insertErr;
      }

      // Parse deadline from content if available
      const deadlineStr = civicContent.deadlines?.[0] || null;

      // Insert English brief
      const { data: enBrief, error: enError } = await db
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

      // Insert Spanish brief
      const { data: esBrief, error: esError } = await db
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

      // Log usage event (fire and forget)
      logUsageEvent(db, {
        userId,
        eventType: 'summarize',
        sourceId: source.id,
        briefId: enBrief.id,
        success: true,
        latencyMs: Date.now() - startTime,
      });

      return NextResponse.json({
        sourceId: source.id,
        briefId: enBrief.id,
        brief: {
          headline: civicContent.title,
          summary: summaryText,
          content: civicContent,
          confidence_score: verification.confidence_score,
          confidence_level: verification.confidence_level,
        },
        verification,
        translations: [{ language: 'es', briefId: esBrief.id }],
        ...(previousBriefId ? { previousVersionId: previousBriefId } : {}),
      });
    }

    // No database: return results directly
    return NextResponse.json({
      sourceId: null,
      briefId: null,
      brief: {
        headline: civicContent.title,
        summary: summaryText,
        content: civicContent,
        confidence_score: verification.confidence_score,
        confidence_level: verification.confidence_level,
      },
      verification,
      translations: [
        {
          language: 'es',
          briefId: null,
          headline: spanishContent.title,
          content: spanishContent,
        },
      ],
    });
  } catch (error) {
    console.error('Summarize error:', error);
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

/** Log a usage event to the database (non-blocking). */
function logUsageEvent(
  db: ReturnType<typeof getServerClient>,
  event: {
    userId: string | null;
    eventType: string;
    sourceId?: string;
    briefId?: string;
    success: boolean;
    errorMessage?: string;
    latencyMs?: number;
  }
) {
  Promise.resolve(
    db.from('usage_events').insert({
      user_id: event.userId,
      event_type: event.eventType,
      source_id: event.sourceId,
      brief_id: event.briefId,
      success: event.success,
      error_message: event.errorMessage,
      latency_ms: event.latencyMs,
    })
  ).catch((err: unknown) => {
    console.error('Failed to log usage event:', err);
  });
}

/** Returns the Supabase client or null if not configured. */
function safeGetDb() {
  try {
    return getServerClient();
  } catch {
    return null;
  }
}
