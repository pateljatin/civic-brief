import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/anthropic';
import { getServerClient } from '@/lib/supabase';
import { CIVIC_VERIFY_SYSTEM, CIVIC_VERIFY_USER } from '@/lib/prompts/civic-verify';
import { rateLimit, isValidUUID } from '@/lib/security';
import type { VerificationResult } from '@/lib/types';

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { briefId, sourceText } = body;

    if (!briefId) {
      return NextResponse.json(
        { error: 'briefId is required.' },
        { status: 400 }
      );
    }

    if (!isValidUUID(briefId)) {
      return NextResponse.json({ error: 'Invalid briefId format.' }, { status: 400 });
    }

    const db = safeGetDb();

    // If we have a database, fetch the brief content
    let summaryJson: string;
    let verifySourceText: string | undefined = sourceText;

    if (db) {
      const { data: brief, error: fetchError } = await db
        .from('briefs')
        .select('content, source_id')
        .eq('id', briefId)
        .single();

      if (fetchError || !brief) {
        return NextResponse.json({ error: 'Brief not found.' }, { status: 404 });
      }

      summaryJson = JSON.stringify(brief.content, null, 2);

      // We cannot re-verify without source text since we don't store documents.
      // The caller must provide sourceText for re-verification.
      if (!verifySourceText) {
        return NextResponse.json(
          {
            error:
              'Source text is required for re-verification. Civic Brief does not store original documents. Upload the document again or provide the extracted text.',
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Database not configured.' },
        { status: 503 }
      );
    }

    // Run verification
    const verification = await generateJSON<VerificationResult>(
      CIVIC_VERIFY_SYSTEM,
      CIVIC_VERIFY_USER(verifySourceText, summaryJson)
    );

    // Update source confidence score
    if (db) {
      const { data: brief } = await db
        .from('briefs')
        .select('source_id')
        .eq('id', briefId)
        .single();

      if (brief) {
        await db
          .from('sources')
          .update({
            factuality_score: verification.confidence_score,
            confidence_level: verification.confidence_level,
            requires_review: verification.confidence_level === 'low',
          })
          .eq('id', brief.source_id);
      }
    }

    return NextResponse.json({
      briefId,
      verification,
    });
  } catch (error) {
    console.error('Verify error:', error);
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function safeGetDb() {
  try {
    return getServerClient();
  } catch {
    return null;
  }
}
