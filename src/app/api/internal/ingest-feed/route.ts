import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerClient } from '@/lib/supabase';
import { createFeedFetcher } from '@/lib/feeds/fetchers';
import { checkFeedItemDuplicate } from '@/lib/feeds/dedup';
import { checkIngestionBudget } from '@/lib/budget';
import { processCivicDocument } from '@/lib/pipeline';
import { validateFetchTarget } from '@/lib/ssrf';
import { extractTextFromPDF, hashText } from '@/lib/pdf-extract';
import type { Feed } from '@/lib/types';
import type { IngestFeedResponse, SkippedItem } from '@/lib/feeds/types';

const MAX_TIMESTAMP_AGE_MS = 60_000; // 60 seconds
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest): Promise<NextResponse<IngestFeedResponse | { error: string }>> {
  const startTime = Date.now();

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
  const typedFeed = feed as Feed;
  if (!typedFeed.is_active) {
    return NextResponse.json({ type: 'skipped', reason: 'disabled' } satisfies IngestFeedResponse);
  }

  // ─── Task 11b: Per-item processing loop ───────────────────────────────────

  let itemsProcessed = 0;
  let newBriefsCount = 0;
  const skippedItems: SkippedItem[] = [];
  const errorLog: Array<{ message: string; item_url?: string; timestamp: string }> = [];
  const skippedFormatCounts: Record<string, number> = {};
  let fetchResult: Awaited<ReturnType<ReturnType<typeof createFeedFetcher>['fetch']>>;
  let fetcherError: Error | null = null;

  try {
    const fetcher = createFeedFetcher(typedFeed.feed_type);
    fetchResult = await fetcher.fetch(typedFeed);
  } catch (err) {
    fetcherError = err instanceof Error ? err : new Error(String(err));
    const newFailures = typedFeed.consecutive_failures + 1;
    const feedUpdate: Record<string, unknown> = {
      last_polled_at: new Date().toISOString(),
      consecutive_failures: newFailures,
    };

    if (newFailures >= 5) {
      feedUpdate.is_active = false;
      console.error(`[ingest-feed] Auto-disabling feed ${feed_id}: ${newFailures} consecutive failures`);
    } else if (newFailures >= 3) {
      // Stub: Task 13 will implement real email alerts
      console.warn(`[ingest-feed] WARNING: Feed ${feed_id} has ${newFailures} consecutive failures. Alert stub.`);
    }

    await Promise.resolve(
      db.from('feeds').update(feedUpdate).eq('id', feed_id)
    );

    // Write failed run item
    await Promise.resolve(
      db.from('feed_poll_run_items').insert({
        run_id,
        feed_id,
        status: 'failed',
        items_found: 0,
        items_processed: 0,
        items_skipped: 0,
        items_deferred: 0,
        new_briefs_created: 0,
        skipped_formats: {},
        errors: [{ message: fetcherError.message, timestamp: new Date().toISOString() }],
        duration_ms: Date.now() - startTime,
      })
    );

    return NextResponse.json(
      { type: 'error', message: fetcherError.message } satisfies IngestFeedResponse
    );
  }

  // Process up to max_items_per_poll items
  const maxItems = typedFeed.max_items_per_poll ?? 10;
  const itemsToProcess = fetchResult.items.slice(0, maxItems);
  let lastSeenGuid: string | null = typedFeed.last_seen_item_guid;
  let budgetExceeded = false;

  for (const item of itemsToProcess) {
    try {
      // Step 1: Initial dedup check (URL-based with placeholder hash)
      const initialDedup = await checkFeedItemDuplicate(item.url, '');
      if (initialDedup.isDuplicate && !initialDedup.isUpdate) {
        skippedItems.push({ url: item.url, reason: 'duplicate_url', format: null });
        continue;
      }

      // Step 2: SSRF validation
      const ssrfCheck = await validateFetchTarget(item.url);
      if (!ssrfCheck.valid) {
        skippedItems.push({ url: item.url, reason: 'ssrf_blocked', format: null });
        continue;
      }

      // Step 3: Domain match check
      if (typedFeed.expected_domain) {
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(item.url);
        } catch {
          skippedItems.push({ url: item.url, reason: 'domain_mismatch', format: null });
          continue;
        }
        if (!parsedUrl.hostname.endsWith(typedFeed.expected_domain)) {
          skippedItems.push({ url: item.url, reason: 'domain_mismatch', format: null });
          continue;
        }
      }

      // Step 4: HEAD request for Content-Type and Content-Length
      const headResponse = await fetch(item.url, { method: 'HEAD' });
      const contentType = headResponse.headers.get('content-type') ?? '';
      const contentLength = parseInt(headResponse.headers.get('content-length') ?? '0', 10);

      if (!contentType.includes('application/pdf') && !contentType.includes('application/octet-stream')) {
        const formatKey = contentType.split(';')[0].trim() || 'unknown';
        skippedFormatCounts[formatKey] = (skippedFormatCounts[formatKey] ?? 0) + 1;
        skippedItems.push({ url: item.url, reason: 'unsupported_format', format: formatKey });
        continue;
      }

      if (contentLength > MAX_PDF_BYTES) {
        skippedItems.push({ url: item.url, reason: 'too_large', format: null });
        continue;
      }

      // Step 5: Download PDF
      const getResponse = await fetch(item.url, { method: 'GET' });
      const buffer = await getResponse.arrayBuffer();

      // Enforce 10MB byte limit after download as well
      if (buffer.byteLength > MAX_PDF_BYTES) {
        skippedItems.push({ url: item.url, reason: 'too_large', format: null });
        continue;
      }

      // Step 6: Extract text and compute hash
      const extractedText = await extractTextFromPDF(buffer);
      const contentHash = await hashText(extractedText);

      // Step 7: Re-check dedup with actual content hash
      const finalDedup = await checkFeedItemDuplicate(item.url, contentHash);
      if (finalDedup.isDuplicate && !finalDedup.isUpdate) {
        skippedItems.push({ url: item.url, reason: finalDedup.reason === 'duplicate_hash' ? 'duplicate_hash' : 'duplicate_url', format: null });
        continue;
      }

      // Step 8: Budget check
      const budget = await checkIngestionBudget();
      if (!budget.allowed) {
        budgetExceeded = true;
        skippedItems.push({ url: item.url, reason: 'budget_exceeded', format: null });
        break;
      }

      // Step 9: Run pipeline
      const pipelineResult = await processCivicDocument({
        extractedText,
        contentHash,
        sourceUrl: item.url,
        jurisdictionId: typedFeed.jurisdiction_id,
        previousBriefId: finalDedup.previousBriefId,
        ingestedByFeedId: typedFeed.id,
      });

      // Step 10: Track results
      itemsProcessed++;
      newBriefsCount += pipelineResult.brief_ids.length;
      lastSeenGuid = item.guid;

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ingest-feed] Error processing item ${item.url}:`, message);
      errorLog.push({ message, item_url: item.url, timestamp: new Date().toISOString() });
      // Continue to next item -- one failure shouldn't abort the entire feed
    }
  }

  // ─── Task 11c: Post-processing and finalization ──────────────────────────

  const hasErrors = errorLog.length > 0;
  const allFailed = itemsToProcess.length > 0 && itemsProcessed === 0 && errorLog.length === itemsToProcess.length;

  // Update feed metadata
  const feedUpdateData: Record<string, unknown> = {
    last_polled_at: new Date().toISOString(),
  };

  if (fetchResult.etag) feedUpdateData.etag = fetchResult.etag;
  if (fetchResult.last_modified) feedUpdateData.last_modified = fetchResult.last_modified;
  if (lastSeenGuid && lastSeenGuid !== typedFeed.last_seen_item_guid) {
    feedUpdateData.last_seen_item_guid = lastSeenGuid;
  }

  if (!allFailed && itemsProcessed > 0) {
    // Success path: reset failure counter
    feedUpdateData.consecutive_failures = 0;
    feedUpdateData.last_successful_poll_at = new Date().toISOString();
  } else if (allFailed) {
    // All items failed: increment failure counter
    const newFailures = typedFeed.consecutive_failures + 1;
    feedUpdateData.consecutive_failures = newFailures;

    if (newFailures >= 5) {
      feedUpdateData.is_active = false;
      console.error(`[ingest-feed] Auto-disabling feed ${feed_id}: ${newFailures} consecutive failures`);
    } else if (newFailures >= 3) {
      // Stub: Task 13 will implement real email alerts
      console.warn(`[ingest-feed] WARNING: Feed ${feed_id} has ${newFailures} consecutive failures. Alert stub.`);
    }
  } else {
    // Partial success or no items: reset failures if we processed anything
    if (itemsProcessed > 0) {
      feedUpdateData.consecutive_failures = 0;
      feedUpdateData.last_successful_poll_at = new Date().toISOString();
    }
  }

  await Promise.resolve(
    db.from('feeds').update(feedUpdateData).eq('id', feed_id)
  );

  // Write poll run item record
  await Promise.resolve(
    db.from('feed_poll_run_items').insert({
      run_id,
      feed_id,
      status: hasErrors && itemsProcessed === 0 ? 'failed' : 'completed',
      items_found: fetchResult.items.length,
      items_processed: itemsProcessed,
      items_skipped: skippedItems.length,
      items_deferred: 0,
      new_briefs_created: newBriefsCount,
      skipped_formats: skippedFormatCounts,
      errors: errorLog,
      duration_ms: Date.now() - startTime,
    })
  );

  return NextResponse.json({
    type: 'success',
    items_processed: itemsProcessed,
    new_briefs: newBriefsCount,
  } satisfies IngestFeedResponse);
}
