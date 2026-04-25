import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import { timingSafeCompare } from '@/lib/ssrf';

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[keepalive] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!provided || !timingSafeCompare(provided, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getServerClient();

    // Real DB query so Supabase registers activity.
    // countries is seeded, tiny, always present.
    const { data, error } = await db
      .from('countries')
      .select('code')
      .limit(1);

    if (error) {
      console.error('[keepalive] Supabase query failed:', error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    console.log('[keepalive] Supabase alive:', data?.length, 'row(s)');
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      rows: data?.length ?? 0,
    });
  } catch (err) {
    console.error('[keepalive] Failed:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
