import { getServerClient } from '@/lib/supabase';

export interface BudgetCheckResult {
  remaining: number;
  allowed: boolean;
}

export async function checkIngestionBudget(): Promise<BudgetCheckResult> {
  const limit = parseInt(process.env.INGESTION_DAILY_LIMIT ?? '50', 10);

  try {
    const db = getServerClient();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { count } = await db
      .from('sources')
      .select('*', { count: 'exact', head: true })
      .not('ingested_by_feed_id', 'is', null)
      .gte('created_at', todayStart.toISOString());

    const used = count ?? 0;
    const remaining = Math.max(0, limit - used);

    return {
      allowed: used < limit,
      remaining,
    };
  } catch {
    // DB unavailable: fail open to avoid blocking ingestion
    return { allowed: true, remaining: limit };
  }
}
