import { scenarios } from '@/lib/showcase';
import { getServerClient } from '@/lib/supabase';
import ScenarioCard from '@/components/ScenarioCard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Showcase | Civic Brief',
  description: 'Five real government documents, summarized for five communities.',
};

export default async function ShowcasePage() {
  const validBriefIds = scenarios.filter((s) => s.briefId).map((s) => s.briefId as string);
  let briefMap = new Map<string, { factuality_score: number }>();

  if (validBriefIds.length > 0) {
    try {
      const supabase = getServerClient();
      const { data } = await supabase
        .from('briefs')
        .select('id, source_id, sources(factuality_score)')
        .in('id', validBriefIds);

      if (data) {
        for (const brief of data) {
          const score = (brief as any).sources?.factuality_score ?? null;
          briefMap.set(brief.id, { factuality_score: score });
        }
      }
    } catch {
      // Supabase credentials not available (e.g. CI build); fall back to static config scores
    }
  }

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '80px 24px 120px',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-fraunces, serif)',
          fontWeight: 800,
          fontSize: 'clamp(30px, 4vw, 44px)',
          textAlign: 'center',
          margin: '0 0 16px',
        }}
      >
        Five Stories. Five Communities.
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-outfit, sans-serif)',
          fontWeight: 300,
          fontSize: '17px',
          color: 'var(--muted)',
          textAlign: 'center',
          marginBottom: '48px',
        }}
      >
        Real government documents, summarized for the people they affect.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {scenarios.map((s, i) => {
          const confidence = briefMap.get(s.briefId ?? '')?.factuality_score ?? null;
          const confidencePercent = confidence !== null ? Math.round(confidence * 100) : null;
          return (
            <ScenarioCard key={s.slug} scenario={s} confidence={confidencePercent} index={i} />
          );
        })}
      </div>
    </div>
  );
}
