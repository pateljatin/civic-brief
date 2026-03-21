import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerClient } from '@/lib/supabase';
import type { Feed } from '@/lib/types';
import type { IngestFeedResponse } from '@/lib/feeds/types';

const MAX_TIMESTAMP_AGE_MS = 60_000; // 60 seconds

export async function POST(request: NextRequest): Promise<NextResponse<IngestFeedResponse | { error: string }>> {
  // 1. Validate HMAC secret is configured
  const secret = process.env.INGEST_HMAC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 401 });
  }

  // 2. Parse request body
  let body: { feed_id: string; run_id: string; timestamp: number; signature?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { feed_id, run_id, timestamp } = body;

  // 3. Validate signature header
  const headerSignature = request.headers.get('X-Ingest-Signature');
  if (!headerSignature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  // 4. Validate timestamp freshness
  const age = Math.abs(Date.now() - timestamp);
  if (age > MAX_TIMESTAMP_AGE_MS) {
    return NextResponse.json({ error: 'Timestamp expired' }, { status: 401 });
  }

  // 5. Compute expected HMAC and compare (timing-safe)
  // Payload format: {feed_id}:{run_id}:{timestamp} -- colon-separated to prevent concatenation attacks
  const payload = `${feed_id}:${run_id}:${timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Handle invalid hex gracefully: Buffer.from with 'hex' encoding silently truncates invalid chars,
  // so length check catches mismatched or malformed signatures before timingSafeEqual.
  const sigBuffer = Buffer.from(headerSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 6. Load feed from database
  let db;
  try {
    db = getServerClient();
  } catch {
    return NextResponse.json({ type: 'error', message: 'Database unavailable' } satisfies IngestFeedResponse, { status: 503 });
  }

  const { data: feed, error: feedError } = await db
    .from('feeds')
    .select('*')
    .eq('id', feed_id)
    .single();

  if (feedError || !feed) {
    return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
  }

  // 7. Check if feed is active
  if (!(feed as Feed).is_active) {
    return NextResponse.json({ type: 'skipped', reason: 'disabled' } satisfies IngestFeedResponse);
  }

  // 8. Stub: processing will be added in Task 11b
  return NextResponse.json({
    type: 'success',
    items_processed: 0,
    new_briefs: 0,
  } satisfies IngestFeedResponse);
}
