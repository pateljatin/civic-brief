import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerClient } from '@/lib/supabase';
import type { Feed } from '@/lib/types';

// Stale run threshold: runs >30min still marked 'running' are considered stuck.
const STALE_RUN_THRESHOLD_MS = 30 * 60 * 1000;

// ─── Timing-safe CRON_SECRET comparison ───────────────────────────────────────

function validateCronSecret(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  // Pad both to the same length to prevent length-based timing leaks.
  const a = Buffer.from(provided.padEnd(64, '\0'));
  const b = Buffer.from(expected.padEnd(64, '\0'));
  // Buffers must be the same length for timingSafeEqual.
  return crypto.timingSafeEqual(a.subarray(0, 64), b.subarray(0, 64)) && provided === expected;
}

// ─── HMAC payload + signature (must match ingest-feed worker) ─────────────────

function signFeedDispatch(feedId: string, runId: string, timestamp: number, secret: string): string {
  const payload = `${feedId}:${runId}:${timestamp}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Validate CRON_SECRET (Vercel sends Authorization: Bearer <CRON_SECRET>)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!validateCronSecret(providedSecret, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hmacSecret = process.env.INGEST_HMAC_SECRET;
  if (!hmacSecret) {
    return NextResponse.json({ error: 'Server misconfiguration: INGEST_HMAC_SECRET not set' }, { status: 500 });
  }

  let db;
  try {
    db = getServerClient();
  } catch {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // 2. Clean up stale runs: any run still 'running' after 30min is stuck.
  const staleThreshold = new Date(Date.now() - STALE_RUN_THRESHOLD_MS).toISOString();
  await db
    .from('feed_poll_runs')
    .update({ status: 'failed', completed_at: new Date().toISOString() })
    .eq('status', 'running')
    .lt('started_at', staleThreshold);

  // 3. Overlap guard: abort if a run started in the last 30min is still running.
  const { data: activeRuns } = await db
    .from('feed_poll_runs')
    .select('id')
    .eq('status', 'running')
    .gte('started_at', staleThreshold);

  if (activeRuns && activeRuns.length > 0) {
    return NextResponse.json({ skipped: true, reason: 'overlap' });
  }

  // 4. Create the poll run record.
  const { data: runRow, error: runError } = await db
    .from('feed_poll_runs')
    .insert({
      status: 'running',
      started_at: new Date().toISOString(),
      feeds_dispatched: 0,
      total_items_processed: 0,
      total_items_skipped: 0,
      total_errors: 0,
      total_new_briefs: 0,
      metadata: {},
    })
    .select('id')
    .single();

  if (runError || !runRow) {
    console.error('Failed to create feed_poll_run:', runError);
    return NextResponse.json({ error: 'Failed to create poll run' }, { status: 500 });
  }

  const runId: string = runRow.id;

  // 5. Load all active feeds.
  const { data: feeds, error: feedsError } = await db
    .from('feeds')
    .select('*')
    .eq('is_active', true);

  if (feedsError) {
    console.error('Failed to load feeds:', feedsError);
    // Mark run as failed before returning.
    await Promise.resolve(
      db
        .from('feed_poll_runs')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .match({ id: runId })
    );
    return NextResponse.json({ error: 'Failed to load feeds' }, { status: 500 });
  }

  const activeFeeds: Feed[] = feeds || [];

  // Determine worker base URL. VERCEL_URL does not include protocol.
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  const workerUrl = `${baseUrl}/api/internal/ingest-feed`;

  // 6. For each feed: create run item + fire-and-forget worker dispatch.
  let feedsDispatched = 0;

  for (const feed of activeFeeds) {
    // a. Create run item row (status: pending).
    await db.from('feed_poll_run_items').insert({
      run_id: runId,
      feed_id: feed.id,
      status: 'pending',
      items_found: 0,
      items_processed: 0,
      items_skipped: 0,
      items_deferred: 0,
      new_briefs_created: 0,
      skipped_formats: {},
      errors: [],
    });

    // b. Generate HMAC signature for this dispatch.
    const timestamp = Date.now();
    const signature = signFeedDispatch(feed.id, runId, timestamp, hmacSecret);

    const body = JSON.stringify({ feed_id: feed.id, run_id: runId, timestamp, signature });

    // c. Fire-and-forget: dispatch worker without awaiting.
    Promise.resolve(
      fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ingest-Signature': signature,
        },
        body,
      })
    ).catch((err) => {
      console.error(`Worker dispatch failed for feed ${feed.id}:`, err);
    });

    feedsDispatched++;
  }

  // 7. Update run with dispatched count.
  await Promise.resolve(
    db
      .from('feed_poll_runs')
      .update({ feeds_dispatched: feedsDispatched })
      .match({ id: runId })
  );

  return NextResponse.json({ run_id: runId, feeds_dispatched: feedsDispatched });
}
