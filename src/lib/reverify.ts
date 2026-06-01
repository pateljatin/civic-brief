import { getServerClient } from '@/lib/supabase';
import { validateFetchTarget } from '@/lib/ssrf';
import { extractTextFromPDF } from '@/lib/pdf-extract';
import { generateJSON } from '@/lib/anthropic';
import { CIVIC_VERIFY_SYSTEM, CIVIC_VERIFY_USER } from '@/lib/prompts/civic-verify';
import type { VerificationResult } from '@/lib/types';

const MAX_SOURCE_TEXT = 100_000;

export async function reverifyBrief(briefId: string, flagContext: string): Promise<void> {
  try {
    const db = getServerClient();

    const { data: brief } = await db
      .from('briefs')
      .select('content, source_id')
      .eq('id', briefId)
      .maybeSingle();

    if (!brief) {
      console.error(`reverifyBrief: brief ${briefId} not found`);
      return;
    }

    const { data: source } = await db
      .from('sources')
      .select('source_url, factuality_score')
      .eq('id', brief.source_id)
      .maybeSingle();

    if (!source?.source_url) {
      console.error(`reverifyBrief: source for brief ${briefId} has no URL`);
      return;
    }

    const ssrf = await validateFetchTarget(source.source_url);
    if (!ssrf.valid) {
      console.error(`reverifyBrief: SSRF block for ${source.source_url}: ${ssrf.error}`);
      return;
    }

    const response = await fetch(source.source_url);
    if (!response.ok) {
      console.error(`reverifyBrief: fetch failed for ${source.source_url}: ${response.status}`);
      return;
    }
    const buffer = await response.arrayBuffer();
    const rawText = await extractTextFromPDF(buffer);
    const sourceText = rawText.slice(0, MAX_SOURCE_TEXT);

    const summaryJson = JSON.stringify(brief.content, null, 2);
    const verification = await generateJSON<VerificationResult>(
      CIVIC_VERIFY_SYSTEM,
      CIVIC_VERIFY_USER(sourceText, summaryJson, flagContext)
    );

    Promise.resolve(
      db.from('community_feedback').insert({
        brief_id: briefId,
        user_id: '00000000-0000-0000-0000-000000000000',
        feedback_type: 'reverification',
        details: null,
        metadata: {
          triggered_by: 'auto',
          confidence_score: verification.confidence_score,
          confidence_level: verification.confidence_level,
          flag_context_length: flagContext.length,
        },
      })
    ).catch((err: unknown) => console.error('reverifyBrief: failed to log feedback row:', err));

    const currentScore = source.factuality_score;
    const shouldDegrade = currentScore === null || verification.confidence_score < currentScore;

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
      ).catch((err: unknown) => console.error('reverifyBrief: failed to degrade score:', err));
    }
  } catch (err) {
    console.error('reverifyBrief: unexpected error:', err);
  }
}
