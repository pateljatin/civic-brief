import { getServerClient } from '@/lib/supabase';

export interface BudgetCheckResult {
  remaining: number;
  allowed: boolean;
}

export async function checkIngestionBudget(): Promise<BudgetCheckResult> {
  const limit = parseInt(process.env.INGESTION_DAILY_LIMIT ?? '50', 10);

  let db;
  try {
    db = getServerClient();
  } catch {
    // DB not configured: fail open to avoid blocking ingestion
    return { allowed: true, remaining: limit };
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await db
    .from('sources')
    .select('*', { count: 'exact', head: true })
    .not('ingested_by_feed_id', 'is', null)
    .gte('created_at', todayStart.toISOString());

  if (error) {
    console.error('[checkIngestionBudget] query failed:', error);
    // Fail open on query error, but log for observability
    return { allowed: true, remaining: limit };
  }

  const used = count ?? 0;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    remaining,
  };
}
