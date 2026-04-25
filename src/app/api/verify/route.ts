import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/anthropic';
import { getServerClient } from '@/lib/supabase';
import { createAuthServerClient } from '@/lib/supabase-server';
import { CIVIC_VERIFY_SYSTEM, CIVIC_VERIFY_USER } from '@/lib/prompts/civic-verify';
import { rateLimitByUser, isValidUUID, safeErrorMessage } from '@/lib/security';
import type { VerificationResult } from '@/lib/types';

const MAX_SOURCE_TEXT = 100_000;

export async function POST(request: NextRequest) {
  // 1. Require authenticated session
  let userId: string;
  try {
    const authClient = await createAuthServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to verify briefs.' }, { status: 401 });
    }
    userId = user.id;
  } catch {
    return NextResponse.json({ error: 'Sign in to verify briefs.' }, { status: 401 });
  }

  // 2. Rate limit: 3 re-verifications per minute per user
  const rateLimitResponse = rateLimitByUser(userId, 3, 60_000);
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

    // 3. Validate and sanitize sourceText
    if (!sourceText || typeof sourceText !== 'string') {
      return NextResponse.json(
        {
          error:
            'Source text is required for re-verification. Civic Brief does not store original documents. Upload the document again or provide the extracted text.',
        },
        { status: 400 }
      );
    }

    if (sourceText.length > MAX_SOURCE_TEXT) {
      return NextResponse.json(
        { error: `Source text exceeds maximum length of ${MAX_SOURCE_TEXT} characters.` },
        { status: 400 }
      );
    }

    // Strip control characters while preserving newlines and tabs
    const verifySourceText = sourceText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim();

    const db = getServerClient();

    // 4. Fetch brief and source
    const { data: brief, error: fetchError } = await db
      .from('briefs')
      .select('content, source_id')
      .eq('id', briefId)
      .maybeSingle();

    if (fetchError || !brief) {
      return NextResponse.json({ error: 'Brief not found.' }, { status: 404 });
    }

    const summaryJson = JSON.stringify(brief.content, null, 2);

    // 5. Run LLM-as-Judge verification
    const verification = await generateJSON<VerificationResult>(
      CIVIC_VERIFY_SYSTEM,
      CIVIC_VERIFY_USER(verifySourceText, summaryJson)
    );

    // 6. Log re-verification as community_feedback (fire-and-forget)
    //    Only update sources.factuality_score if the new score is LOWER (trust degrades, never inflates)
    Promise.resolve(
      db.from('community_feedback').insert({
        brief_id: briefId,
        user_id: userId,
        feedback_type: 'reverification',
        details: null,
        metadata: {
          confidence_score: verification.confidence_score,
          confidence_level: verification.confidence_level,
          verified_claims_count: verification.verified_claims.length,
          unverified_claims_count: verification.unverified_claims.length,
        },
      })
    ).catch((err) => {
      console.error('Failed to log re-verification feedback:', err);
    });

    // 7. Fetch current source score; only write if new score is lower
    const { data: source } = await db
      .from('sources')
      .select('factuality_score')
      .eq('id', brief.source_id)
      .maybeSingle();

    const currentScore = source?.factuality_score ?? null;
    const shouldDegrade =
      currentScore === null || verification.confidence_score < currentScore;

    if (shouldDegrade) {
      Promise.resolve(
        db
          .from('sources')
          .update({
            factuality_score: verification.confidence_score,
            confidence_level: verification.confidence_level,
            requires_review: verification.confidence_level === 'low',
          })
          .eq('id', brief.source_id)
      ).catch((err) => {
        console.error('Failed to degrade source factuality score:', err);
      });
    }

    return NextResponse.json({
      briefId,
      verification,
    });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
