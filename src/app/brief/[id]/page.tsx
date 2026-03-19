import { notFound } from 'next/navigation';
import CivicBrief from '@/components/CivicBrief';
import type { CivicContent, FeedbackType } from '@/lib/types';

// Mock data for when Supabase is not configured
const MOCK_BRIEF = {
  headline: 'Property Tax Increase of 8.2% for FY2026-27',
  content: {
    title: 'Property Tax Increase of 8.2% for FY2026-27',
    what_changed:
      'The proposed budget increases the property tax rate from 1.12 to 1.21 per $100 of assessed value, an 8.2% increase over FY2025-26. This is the first rate increase in three years.',
    who_affected:
      'All residential and commercial property owners within city limits. A home assessed at $300,000 would pay approximately $270 more per year.',
    what_to_do:
      'The public comment period is open until April 12. The budget hearing is April 18 at 7pm at City Hall. Written comments can be submitted to budget@cityname.gov.',
    money:
      '$4.1 million increase allocated to road repair and infrastructure. $2.3 million to school facility improvements. Public safety budget reduced by $890,000 due to deferred fleet replacement.',
    deadlines: [
      'April 12: Public comment period closes',
      'April 18, 7pm: Budget hearing at City Hall',
      'May 1: City Council final vote',
    ],
    context:
      'This budget follows two years of flat property tax rates. The road repair allocation responds to a 2025 infrastructure assessment that rated 34% of city roads as "poor" condition. The school facilities funding addresses overcrowding at three elementary schools.',
    key_quotes: [
      'The proposed rate of $1.21 per $100 assessed value represents a necessary investment in infrastructure that has been deferred for too long.',
      'Public Safety fleet replacement will be deferred to FY2027-28, saving $890,000 in the current cycle.',
    ],
    document_type: 'budget',
  } satisfies CivicContent,
  sourceUrl: '#',
  sourceTitle: 'Demo source (not a real document)',
  confidenceScore: 0.92,
  confidenceLevel: 'high' as const,
};

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getBrief(id: string) {
  // Try to fetch from Supabase
  try {
    const { getServerClient } = await import('@/lib/supabase');
    const db = getServerClient();

    const { data: brief } = await db
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
      .eq('id', id)
      .eq('is_published', true)
      .single();

    if (brief) {
      // Fetch all available translations for this source
      const { data: translations } = await db
        .from('briefs')
        .select(`
          id,
          headline,
          content,
          languages (bcp47)
        `)
        .eq('source_id', brief.source_id)
        .eq('is_published', true);

      return { brief, translations };
    }
  } catch {
    // Supabase not configured, fall through
  }

  // Return mock for demo / no-db mode
  if (id === 'demo' || id === 'test-id') {
    return { brief: null, translations: null, mock: true };
  }

  return null;
}

async function getFeedbackData(briefId: string) {
  try {
    const { getServerClient } = await import('@/lib/supabase');
    const db = getServerClient();

    const { count: helpfulCount } = await db
      .from('community_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('brief_id', briefId)
      .eq('feedback_type', 'helpful');

    let isSignedIn = false;
    let userFeedback: FeedbackType | undefined;

    try {
      const { createAuthServerClient } = await import('@/lib/supabase-server');
      const authClient = await createAuthServerClient();
      const { data: { user } } = await authClient.auth.getUser();
      if (user) {
        isSignedIn = true;
        const { data: existing } = await db
          .from('community_feedback')
          .select('feedback_type')
          .eq('brief_id', briefId)
          .eq('user_id', user.id)
          .neq('feedback_type', 'helpful')
          .limit(1)
          .maybeSingle();
        userFeedback = (existing?.feedback_type as FeedbackType) || undefined;
      }
    } catch {
      // Auth not available
    }

    return { helpfulCount: helpfulCount || 0, isSignedIn, userFeedback };
  } catch {
    return { helpfulCount: 0, isSignedIn: false, userFeedback: undefined };
  }
}

export default async function BriefPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getBrief(id);

  if (!result) {
    notFound();
  }

  // Use mock data if no DB
  if ('mock' in result && result.mock) {
    return (
      <div className="container-narrow" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '6px',
            background: 'var(--warm)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--accent)',
            marginBottom: '24px',
          }}
        >
          Demo brief (database not connected)
        </div>
        <CivicBrief
          headline={MOCK_BRIEF.headline}
          content={MOCK_BRIEF.content}
          sourceUrl={MOCK_BRIEF.sourceUrl}
          confidenceScore={MOCK_BRIEF.confidenceScore}
          confidenceLevel={MOCK_BRIEF.confidenceLevel}
          currentLanguage="en"
          availableLanguages={['en', 'es']}
          briefId="demo"
          helpfulCount={0}
          isSignedIn={false}
          isDemo={true}
        />
      </div>
    );
  }

  const { brief, translations } = result;

  // Build translations map
  const translationMap: Record<string, { headline: string; content: CivicContent }> = {};
  const availableLanguages: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const briefData = brief as any;

  if (translations) {
    for (const t of translations as any[]) {
      const lang = t.languages?.bcp47 as string | undefined;
      if (lang) {
        availableLanguages.push(lang);
        if (lang !== briefData.languages?.bcp47) {
          translationMap[lang] = {
            headline: t.headline,
            content: t.content as CivicContent,
          };
        }
      }
    }
  }

  const source = briefData.sources as {
    source_url: string;
    title: string;
    factuality_score: number;
    confidence_level: 'high' | 'medium' | 'low';
  };

  const feedbackData = await getFeedbackData(briefData.id || id);

  return (
    <div className="container-narrow" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <CivicBrief
        headline={briefData.headline}
        content={briefData.content as CivicContent}
        sourceUrl={source.source_url}
        sourceTitle={source.title}
        confidenceScore={source.factuality_score}
        confidenceLevel={source.confidence_level}
        currentLanguage={briefData.languages?.bcp47 || 'en'}
        availableLanguages={availableLanguages}
        translations={translationMap}
        briefId={briefData.id || id}
        helpfulCount={feedbackData.helpfulCount}
        userFeedback={feedbackData.userFeedback}
        isSignedIn={feedbackData.isSignedIn}
      />
    </div>
  );
}
