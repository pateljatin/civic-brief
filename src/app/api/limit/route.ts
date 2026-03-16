import { NextResponse } from 'next/server';

const DAILY_LIMIT = parseInt(process.env.DEMO_DAILY_LIMIT || '10', 10);

function safeGetDb() {
  try {
    // Dynamic import to avoid build errors when env vars are missing
    const { getServerClient } = require('@/lib/supabase');
    return getServerClient();
  } catch {
    return null;
  }
}

export async function GET() {
  const db = safeGetDb();
  if (!db) {
    return NextResponse.json({ dailyLimit: DAILY_LIMIT, used: 0, remaining: DAILY_LIMIT });
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count } = await db
    .from('sources')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString());

  const used = count || 0;
  const remaining = Math.max(0, DAILY_LIMIT - used);

  return NextResponse.json({ dailyLimit: DAILY_LIMIT, used, remaining });
}
