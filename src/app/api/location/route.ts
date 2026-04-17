import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';

/**
 * GET /api/location?q=Seattle&limit=10
 *
 * Fuzzy search jurisdictions by name using pg_trgm similarity().
 * Returns matches ranked by similarity and population, with hierarchy
 * context and brief counts.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const limit = Math.min(Number(searchParams.get('limit') ?? 10), 25);

  if (!q || q.trim().length === 0) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  const query = q.trim();

  try {
    const db = getServerClient();

    // Fuzzy search with pg_trgm similarity, weighted by population
    // Uses the existing GIN trigram index on jurisdictions.name
    const { data: matches, error } = await db.rpc('search_jurisdictions', {
      search_query: query,
      result_limit: limit,
    });

    if (error) {
      // If the RPC doesn't exist yet, fall back to a basic ilike search
      const { data: fallback, error: fallbackError } = await db
        .from('jurisdictions')
        .select(`
          id, name, slug, population, level_id, parent_id, ocd_id, fips_code,
          jurisdiction_levels!inner(name, depth)
        `)
        .ilike('name', `%${query}%`)
        .order('population', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (fallbackError) {
        return NextResponse.json(
          { error: 'Search failed. Please try again.' },
          { status: 500 }
        );
      }

      // Build results with hierarchy for fallback
      const results = await buildResults(db, fallback ?? []);
      return NextResponse.json({ results });
    }

    const results = await buildResults(db, matches ?? []);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: 'Search failed. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Build LocationSearchResult[] from raw jurisdiction rows.
 * Adds hierarchy breadcrumb and brief count for each match.
 */
async function buildResults(
  db: ReturnType<typeof getServerClient>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jurisdictions: any[]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const results = [];

  for (const j of jurisdictions) {
    // Get hierarchy (ancestors)
    const { data: ancestors } = await db.rpc('jurisdiction_ancestors', {
      jurisdiction_uuid: j.id,
    });

    const hierarchy = (ancestors ?? []).map((a: { name: string; level_name: string; depth: number }) => ({
      name: a.name,
      level_name: a.level_name,
      depth: a.depth,
    }));

    // Get brief count
    const { count } = await db
      .from('brief_jurisdictions')
      .select('id', { count: 'exact', head: true })
      .eq('jurisdiction_id', j.id);

    const levelData = j.jurisdiction_levels ?? {};

    results.push({
      jurisdiction: {
        id: j.id,
        name: j.name,
        slug: j.slug,
        population: j.population,
        level_name: levelData.name ?? null,
        depth: levelData.depth ?? null,
        ocd_id: j.ocd_id,
        fips_code: j.fips_code,
      },
      hierarchy,
      brief_count: count ?? 0,
      similarity: j.similarity ?? null,
    });
  }

  return results;
}
