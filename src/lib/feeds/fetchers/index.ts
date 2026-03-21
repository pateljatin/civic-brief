import type { Feed, FeedType } from '@/lib/types';
import type { FetchResult } from '@/lib/feeds/types';
import { RssFetcher } from './rss';
import { OpenStatesFetcher } from './openstates';
import { LegistarFetcher } from './legistar';

export interface FeedFetcher {
  fetch(feed: Feed): Promise<FetchResult>;
}

/**
 * Factory that returns the appropriate fetcher for a given feed type.
 * RSS and Atom both use RssFetcher since rss-parser handles both formats.
 * Throws for unsupported types so callers can fail fast at configuration time.
 */
export function createFeedFetcher(feedType: FeedType | string): FeedFetcher {
  switch (feedType) {
    case 'rss':
    case 'atom':
      return new RssFetcher();
    case 'json_api':
      return new OpenStatesFetcher();
    case 'legistar':
      return new LegistarFetcher();
    default:
      throw new Error(`Unsupported feed type: ${feedType}`);
  }
}
