// 3-layer deduplication for feed items:
// 1. URL match (same document, same content)
// 2. URL match with hash change (document update)
// 3. Hash match at different URL (mirror/duplicate publication)

import { getServerClient } from '@/lib/supabase';

export interface DedupResult {
  isDuplicate: boolean;
  isUpdate: boolean;
  reason: 'duplicate_url' | 'duplicate_hash' | null;
  existingSourceId: string | null;
  previousBriefId: string | null;
}

const NOT_DUPLICATE: DedupResult = {
  isDuplicate: false,
  isUpdate: false,
  reason: null,
  existingSourceId: null,
  previousBriefId: null,
};

export async function checkFeedItemDuplicate(
  sourceUrl: string,
  contentHash: string,
): Promise<DedupResult> {
  let db;
  try {
    db = getServerClient();
  } catch {
    // DB unavailable: allow processing to continue rather than block ingestion
    return NOT_DUPLICATE;
  }

  // Layer 1 & 2: look up by URL
  const { data: urlMatch } = await db
    .from('sources')
    .select('id, content_hash')
    .eq('source_url', sourceUrl)
    .maybeSingle();

  if (urlMatch) {
    if (urlMatch.content_hash === contentHash) {
      // Same URL, same hash: exact duplicate
      return {
        isDuplicate: true,
        isUpdate: false,
        reason: 'duplicate_url',
        existingSourceId: urlMatch.id,
        previousBriefId: null,
      };
    }

    // Same URL, different hash: the document was updated. Find the English brief
    // for the old source so the pipeline can link the new version to it.
    // language_id=1 is English (seed data: languages.sql inserts 'en' first).
    const { data: brief } = await db
      .from('briefs')
      .select('id')
      .eq('source_id', urlMatch.id)
      .eq('language_id', 1)
      .maybeSingle();

    return {
      isDuplicate: false,
      isUpdate: true,
      reason: null,
      existingSourceId: urlMatch.id,
      previousBriefId: brief?.id ?? null,
    };
  }

  // Layer 3: look up by content hash (same document published at a different URL)
  const { data: hashMatch } = await db
    .from('sources')
    .select('id, source_url')
    .eq('content_hash', contentHash)
    .maybeSingle();

  if (hashMatch) {
    return {
      isDuplicate: true,
      isUpdate: false,
      reason: 'duplicate_hash',
      existingSourceId: hashMatch.id,
      previousBriefId: null,
    };
  }

  return NOT_DUPLICATE;
}
