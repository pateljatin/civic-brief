import { notFound } from 'next/navigation';
import { getScenarioBySlug } from '@/lib/showcase';
import ScenarioHero from '@/components/ScenarioHero';
import CivicBrief from '@/components/CivicBrief';
import type { CivicContent } from '@/lib/types';

interface PageProps {
  params: Promise<{ scenario: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { scenario: slug } = await params;
  const config = getScenarioBySlug(slug);
  if (!config) return { title: 'Not Found | Civic Brief' };
  return {
    title: `${config.title} | Civic Brief Showcase`,
    description: config.narrative,
    openGraph: {
      title: `${config.title} | Civic Brief Showcase`,
      description: config.narrative,
      siteName: 'Civic Brief',
    },
  };
}

export default async function ShowcaseDetailPage({ params }: PageProps) {
  const { scenario: slug } = await params;
  const scenarioConfig = getScenarioBySlug(slug);

  if (!scenarioConfig) {
    notFound();
  }

  const backLink = (
    <a
      href="/showcase"
      style={{
        display: 'block',
        marginBottom: '24px',
        color: 'var(--muted)',
        textDecoration: 'none',
        fontSize: '14px',
      }}
    >
      ← Back to all stories
    </a>
  );

  // briefId is null until a real document is sourced and processed
  if (!scenarioConfig.briefId) {
    return (
      <div className="container-narrow" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
        {backLink}
        <ScenarioHero scenario={scenarioConfig} confidence={0} />
      </div>
    );
  }

  // Fetch brief from Supabase
  let brief: any = null;
  let availableLanguages: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let translationMap: Record<string, { headline: string; content: CivicContent }> = {};

  try {
    const { getServerClient } = await import('@/lib/supabase');
    const db = getServerClient();

    const { data } = await db
      .from('briefs')
      .select(`
        id,
        headline,
        summary,
        content,
        is_published,
        published_at,
        source_id,
        language_id,
        sources (
          id,
          source_url,
          title,
          factuality_score,
          confidence_level
        ),
        languages (
          bcp47,
          name
        )
      `)
      .eq('id', scenarioConfig.briefId)
      .maybeSingle();

    brief = data;

    if (brief) {
      const { data: translations } = await db
        .from('briefs')
        .select(`
          id,
          headline,
          content,
          languages (bcp47)
        `)
        .eq('source_id', brief.source_id);

      if (translations) {
        for (const t of translations as any[]) {
          const lang = t.languages?.bcp47 as string | undefined;
          if (lang) {
            availableLanguages.push(lang);
            if (lang !== brief.languages?.bcp47) {
              translationMap[lang] = {
                headline: t.headline,
                content: t.content as CivicContent,
              };
            }
          }
        }
      }
    }
  } catch {
    // Supabase not configured or fetch failed — render error state below
  }

  if (!brief) {
    return (
      <div className="container-narrow" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
        {backLink}
        <ScenarioHero scenario={scenarioConfig} confidence={0} />
      </div>
    );
  }

  const source = brief.sources as {
    source_url: string;
    title: string;
    factuality_score: number;
    confidence_level: 'high' | 'medium' | 'low';
  };

  return (
    <div className="container-narrow" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      {backLink}
      <ScenarioHero scenario={scenarioConfig} confidence={source.factuality_score} />
      <div style={{ borderTop: '1px solid var(--border)', margin: '32px 0' }} />
      <div className="showcase-brief-fade">
        <CivicBrief
          headline={brief.headline}
          content={brief.content as CivicContent}
          sourceUrl={source.source_url}
          sourceTitle={source.title}
          confidenceScore={source.factuality_score}
          confidenceLevel={source.confidence_level}
          currentLanguage={brief.languages?.bcp47 || 'en'}
          availableLanguages={availableLanguages}
          translations={translationMap}
          briefId={brief.id}
          helpfulCount={0}
          isSignedIn={false}
          isDemo={false}
        />
      </div>
    </div>
  );
}
