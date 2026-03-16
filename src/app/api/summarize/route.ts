import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPDF, hashText, PDFExtractionError } from '@/lib/pdf-extract';
import { generateJSON, MODEL, PROMPT_VERSION } from '@/lib/anthropic';
import { getServerClient } from '@/lib/supabase';
import { CIVIC_SUMMARIZE_SYSTEM, CIVIC_SUMMARIZE_USER } from '@/lib/prompts/civic-summarize';
import { CIVIC_VERIFY_SYSTEM, CIVIC_VERIFY_USER } from '@/lib/prompts/civic-verify';
import { CIVIC_TRANSLATE_SYSTEM, CIVIC_TRANSLATE_USER } from '@/lib/prompts/civic-translate';
import { rateLimit, validateUrl, validateFile, sanitizeText } from '@/lib/security';
import type { CivicContent, VerificationResult } from '@/lib/types';

const MAX_TEXT_LENGTH = 100_000; // ~25K words, well within Claude's context

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

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

    // 3. Check for duplicate (if Supabase is configured)
    const db = safeGetDb();
    if (db) {
      const { data: existing } = await db
        .from('sources')
        .select('id')
        .eq('content_hash', contentHash)
        .single();

      if (existing) {
        const { data: existingBrief } = await db
          .from('briefs')
          .select('id')
          .eq('source_id', existing.id)
          .eq('language_id', 1) // English
          .single();

        return NextResponse.json({
          sourceId: existing.id,
          briefId: existingBrief?.id,
          duplicate: true,
          message: 'This document has already been processed.',
        });
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
      const { data: source, error: sourceError } = await db
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
        })
        .select('id')
        .single();

      if (sourceError) throw sourceError;

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
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Returns the Supabase client or null if not configured. */
function safeGetDb() {
  try {
    return getServerClient();
  } catch {
    return null;
  }
}
