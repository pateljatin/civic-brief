#!/usr/bin/env npx tsx
/**
 * Rate limit load test.
 *
 * Fires N concurrent requests at a target endpoint and reports how many
 * were allowed vs blocked. Use against the deployed Vercel URL to verify
 * that the persistent rate limiter works across isolates.
 *
 * Usage:
 *   npx tsx scripts/test-rate-limit.ts [base-url]
 *
 * Defaults to http://localhost:3000 if no URL is provided.
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const ENDPOINT = '/api/limit'; // GET, no auth needed, rate-limited
const CONCURRENCY = 15; // more than the 10/min limit
const DELAY_BETWEEN_BATCHES_MS = 200;

interface Result {
  status: number;
  body: string;
  latencyMs: number;
}

async function fireRequest(url: string): Promise<Result> {
  const start = Date.now();
  const res = await fetch(url);
  const body = await res.text();
  return { status: res.status, body, latencyMs: Date.now() - start };
}

async function main() {
  console.log(`Rate limit load test against ${BASE_URL}${ENDPOINT}`);
  console.log(`Firing ${CONCURRENCY} concurrent requests...\n`);

  // Batch 1: fire all at once
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      fireRequest(`${BASE_URL}${ENDPOINT}`)
    )
  );

  const allowed = results.filter((r) => r.status === 200);
  const blocked = results.filter((r) => r.status === 429);
  const errors = results.filter((r) => r.status !== 200 && r.status !== 429);

  console.log(`Batch 1 (${CONCURRENCY} concurrent):`);
  console.log(`  Allowed (200): ${allowed.length}`);
  console.log(`  Blocked (429): ${blocked.length}`);
  if (errors.length > 0) {
    console.log(`  Errors:        ${errors.length}`);
    errors.forEach((e) => console.log(`    ${e.status}: ${e.body.slice(0, 100)}`));
  }

  // Wait briefly, then fire another batch to confirm we're still blocked
  await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));

  const results2 = await Promise.all(
    Array.from({ length: 5 }, () =>
      fireRequest(`${BASE_URL}${ENDPOINT}`)
    )
  );

  const allowed2 = results2.filter((r) => r.status === 200);
  const blocked2 = results2.filter((r) => r.status === 429);

  console.log(`\nBatch 2 (5 follow-up after ${DELAY_BETWEEN_BATCHES_MS}ms):`);
  console.log(`  Allowed (200): ${allowed2.length}`);
  console.log(`  Blocked (429): ${blocked2.length}`);

  // Verdict
  const totalBlocked = blocked.length + blocked2.length;
  console.log('\n---');
  if (totalBlocked > 0) {
    console.log(`PASS: Rate limiter blocked ${totalBlocked} requests out of ${CONCURRENCY + 5} total.`);
  } else {
    console.log('WARN: No requests were blocked. Rate limiter may not be active.');
    console.log('      (Expected if running locally without Supabase — in-memory limiter resets per isolate.)');
  }

  // Latency stats
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  console.log(`\nLatency: p50=${latencies[Math.floor(latencies.length * 0.5)]}ms p99=${latencies[Math.floor(latencies.length * 0.99)]}ms`);
}

main().catch(console.error);
