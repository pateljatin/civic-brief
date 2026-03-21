import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerClient } from '@/lib/supabase';
import { buildDigestSummary, buildDigestHtml } from '@/lib/email/digest';

export async function GET(request: NextRequest) {
  // 1. Validate CRON_SECRET (timing-safe)
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get('x-vercel-cron-secret');

  if (!cronSecret || !headerSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expectedBuf = Buffer.from(cronSecret);
  const actualBuf = Buffer.from(headerSecret);
  if (
    expectedBuf.length !== actualBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, actualBuf)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Query data from past 7 days
  let db;
  try {
    db = getServerClient();
  } catch {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const periodStart = weekAgo.toISOString().split('T')[0];
  const periodEnd = new Date().toISOString().split('T')[0];

  const [runsResult, itemsResult, feedsResult] = await Promise.all([
    db.from('feed_poll_runs').select('*').gte('started_at', weekAgo.toISOString()),
    db.from('feed_poll_run_items').select('*').gte('created_at', weekAgo.toISOString()),
    db.from('feeds').select('*').eq('is_active', true),
  ]);

  const summary = buildDigestSummary({
    runs: runsResult.data || [],
    items: itemsResult.data || [],
    feeds: feedsResult.data || [],
    periodStart,
    periodEnd,
  });

  const html = buildDigestHtml(summary, periodStart, periodEnd);

  // 3. Send email if configured
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (apiKey && adminEmail) {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const { error: sendError } = await resend.emails.send({
      from: 'Civic Brief <digest@civic-brief.vercel.app>',
      to: adminEmail,
      subject: `Civic Brief Weekly Digest: ${periodStart} to ${periodEnd}`,
      html,
    });

    if (sendError) {
      console.error('[digest] Failed to send digest email:', sendError);
    }
  } else {
    console.warn('[digest] RESEND_API_KEY or ADMIN_EMAIL not configured, skipping email send');
  }

  return NextResponse.json({ ...summary, periodStart, periodEnd });
}
