import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import { createAuthServerClient } from '@/lib/supabase-server';
import { sanitizeText, isValidUUID, safeErrorMessage } from '@/lib/security';
import { rateLimitByUserId } from '@/lib/rate-limit';
import { FEEDBACK_TYPES } from '@/lib/types';
import type { FeedbackType } from '@/lib/types';

const REVERIFY_THRESHOLD = 2;
const RETRANSLATE_THRESHOLD = 2;
const REVERIFY_TYPES: FeedbackType[] = ['factual_error', 'missing_info'];

export async function POST(request: NextRequest) {
  // 1. Validate auth session
  let userId: string;
  try {
    const authClient = await createAuthServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Sign in to submit feedback.' },
        { status: 401 }
      );
    }
    userId = user.id;
  } catch {
    return NextResponse.json(
      { error: 'Sign in to submit feedback.' },
      { status: 401 }
    );
  }

  // 2. Rate limit per user
  const rateLimitResponse = await rateLimitByUserId(userId, 5, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { briefId, feedbackType, details } = body;

    // 3. Validate briefId
    if (!briefId || !isValidUUID(briefId)) {
      return NextResponse.json(
        { error: 'Valid brief ID is required.' },
        { status: 422 }
      );
    }

    // 4. Validate feedbackType
    if (!feedbackType || !FEEDBACK_TYPES.includes(feedbackType)) {
      return NextResponse.json(
        { error: `Invalid feedback type. Must be one of: ${FEEDBACK_TYPES.join(', ')}` },
        { status: 422 }
      );
    }

    // 5. Sanitize details
    const cleanDetails = details ? sanitizeText(details, 1000) : null;

    const db = getServerClient();

    // 6. Verify brief exists and is published
    const { data: brief, error: briefError } = await db
      .from('briefs')
      .select('id, version, language_id, source_id, languages(bcp47)')
      .eq('id', briefId)
      .eq('is_published', true)
      .single();

    if (briefError || !brief) {
      return NextResponse.json(
        { error: 'Brief not found.' },
        { status: 404 }
      );
    }

    // 7. Build metadata
    const briefData = brief as Record<string, unknown>;
    const langData = briefData.languages as { bcp47: string } | null;
    const metadata = {
      platform: 'web',
      language: langData?.bcp47 || 'en',
      version: briefData.version as number,
    };

    // 8. Insert feedback
    const { error: insertError } = await db
      .from('community_feedback')
      .insert({
        brief_id: briefId,
        user_id: userId,
        feedback_type: feedbackType,
        details: cleanDetails,
        metadata,
      });

    if (insertError) {
      // Unique constraint violation = duplicate
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'You have already submitted this type of feedback for this brief.' },
          { status: 409 }
        );
      }
      throw insertError;
    }

    // 9. Check re-verification threshold (fire-and-forget)
    if (REVERIFY_TYPES.includes(feedbackType as FeedbackType)) {
      checkAndTriggerReverification(db, briefId, brief.source_id).catch((err) => {
        console.error('Re-verification trigger failed:', err);
      });
    }

    // 10. Check re-translation threshold (fire-and-forget)
    if (feedbackType === 'translation_error') {
      checkAndTriggerRetranslation(db, briefId, brief.source_id).catch((err) => {
        console.error('Re-translation trigger failed:', err);
      });
    }

    // 11. Return success
    return NextResponse.json({ success: true, feedbackType });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

async function checkAndTriggerReverification(
  db: ReturnType<typeof getServerClient>,
  briefId: string,
  sourceId: string
) {
  const { count } = await db
    .from('community_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .in('feedback_type', REVERIFY_TYPES);

  if ((count || 0) >= REVERIFY_THRESHOLD) {
    const { data: flags } = await db
      .from('community_feedback')
      .select('feedback_type, details')
      .eq('brief_id', briefId)
      .in('feedback_type', REVERIFY_TYPES)
      .not('details', 'is', null);

    const flagContext = flags
      ?.map((f) => `[${f.feedback_type}]: ${f.details}`)
      .join('\n') || '';

    console.log(
      `Re-verification triggered for brief ${briefId} (${count} flags). Context: ${flagContext}`
    );
  }
}

async function checkAndTriggerRetranslation(
  db: ReturnType<typeof getServerClient>,
  briefId: string,
  sourceId: string
) {
  const { count } = await db
    .from('community_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .eq('feedback_type', 'translation_error');

  if ((count || 0) >= RETRANSLATE_THRESHOLD) {
    const { data: flags } = await db
      .from('community_feedback')
      .select('details')
      .eq('brief_id', briefId)
      .eq('feedback_type', 'translation_error')
      .not('details', 'is', null);

    const flagContext = flags
      ?.map((f) => f.details)
      .join('\n') || '';

    console.log(
      `Re-translation triggered for brief ${briefId} (${count} flags). Context: ${flagContext}`
    );
  }
}
