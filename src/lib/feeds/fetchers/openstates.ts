import type { Feed } from '@/lib/types';
import type { FetchResult, FeedItem } from '@/lib/feeds/types';
import type { FeedFetcher } from './index';
import { validateFetchTarget } from '@/lib/ssrf';

interface OpenStatesBillText {
  url: string;
  media_type: string;
  note: string;
}

interface OpenStatesBill {
  id: string;
  identifier: string;
  title: string;
  updated_at: string;
  texts: OpenStatesBillText[];
}

interface OpenStatesResponse {
  results: OpenStatesBill[];
  pagination: {
    total_items: number;
    page: number;
    max_page: number;
  };
}

/**
 * Fetches bills from the OpenStates v3 API.
 *
 * The feed_url stores the base query URL, e.g.:
 *   https://v3.openstates.org/bills?jurisdiction=wa&session=2025-2026
 *
 * We append &include=texts&per_page=N to retrieve PDF text links alongside
 * each bill. OpenStates does not support conditional requests (ETag/Last-Modified),
 * so was_modified is always true.
 */
export class OpenStatesFetcher implements FeedFetcher {
  async fetch(feed: Feed): Promise<FetchResult> {
    const limit = feed.max_items_per_poll;

    // Build the request URL, appending required parameters
    const url = new URL(feed.feed_url);
    url.searchParams.set('include', 'texts');
    url.searchParams.set('per_page', String(limit));

    const targetUrl = url.toString();

    // SSRF protection before making any external request
    const ssrfCheck = await validateFetchTarget(targetUrl);
    if (!ssrfCheck.valid) {
      throw new Error(`SSRF validation failed for OpenStates URL: ${ssrfCheck.error}`);
    }

    const apiKey = process.env.OPENSTATES_API_KEY ?? '';
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-API-Key': apiKey,
    };

    const response = await fetch(targetUrl, { headers });

    if (response.status === 429) {
      throw new Error(`OpenStates rate limit exceeded for feed ${feed.id}. Retry after cooling down.`);
    }

    if (!response.ok) {
      throw new Error(`OpenStates API error ${response.status} for feed ${feed.id}`);
    }

    const data = (await response.json()) as OpenStatesResponse;
    const bills = data.results ?? [];

    // Map bills to FeedItems, filtering to those with at least one PDF text
    const items: FeedItem[] = bills
      .slice(0, limit)
      .flatMap((bill): FeedItem[] => {
        const pdfText = bill.texts?.find(
          (t) => t.media_type === 'application/pdf' || t.url.toLowerCase().endsWith('.pdf')
        );
        if (!pdfText) return [];

        return [
          {
            guid: bill.id,
            title: bill.title,
            url: pdfText.url,
            published_at: bill.updated_at ?? null,
            content_type: 'application/pdf',
            metadata: {
              identifier: bill.identifier,
            },
          },
        ];
      });

    return {
      feed_id: feed.id,
      items,
      etag: null,
      last_modified: null,
      was_modified: true,
    };
  }
}
