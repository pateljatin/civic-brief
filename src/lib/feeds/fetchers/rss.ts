import Parser from 'rss-parser';
import type { Feed } from '@/lib/types';
import type { FeedFetcher } from './index';
import type { FetchResult, FeedItem } from '@/lib/feeds/types';
import { validateFetchTarget } from '@/lib/ssrf';

const MAX_FEED_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// rss-parser handles both RSS 2.0 and Atom formats
const parser = new Parser({
  timeout: 10_000,
  headers: {
    'User-Agent': 'CivicBrief/1.0 (civic feed aggregator; https://civic-brief.vercel.app)',
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8',
  },
});

export class RssFetcher implements FeedFetcher {
  async fetch(feed: Feed): Promise<FetchResult> {
    // SSRF validation before any outbound request.
    // Note: DNS rebinding (TOCTOU) is a known limitation; the resolved IP from
    // validateFetchTarget is not passed to fetch(). Vercel's egress controls
    // provide an additional layer of protection in production.
    const validation = await validateFetchTarget(feed.feed_url);
    if (!validation.valid) {
      throw new Error(`SSRF validation failed: ${validation.error}`);
    }

    // Build conditional request headers
    const headers: Record<string, string> = {
      'User-Agent': 'CivicBrief/1.0 (civic feed aggregator; https://civic-brief.vercel.app)',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8',
    };

    if (feed.etag) {
      headers['If-None-Match'] = feed.etag;
    }
    if (feed.last_modified) {
      headers['If-Modified-Since'] = feed.last_modified;
    }

    const response = await fetch(feed.feed_url, { headers });

    // 304 Not Modified -- nothing changed since last poll
    if (response.status === 304) {
      return {
        feed_id: feed.id,
        items: [],
        etag: feed.etag,
        last_modified: feed.last_modified,
        was_modified: false,
      };
    }

    // Reject non-2xx responses
    if (!response.ok) {
      throw new Error(`Feed fetch failed with HTTP ${response.status}: ${response.statusText}`);
    }

    // Check content-length header before reading body
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FEED_SIZE_BYTES) {
      throw new Error(`Feed size ${contentLength} bytes exceeds maximum allowed size of ${MAX_FEED_SIZE_BYTES} bytes`);
    }

    const text = await response.text();

    // Check actual body size after reading
    const bodySize = Buffer.byteLength(text, 'utf8');
    if (bodySize > MAX_FEED_SIZE_BYTES) {
      throw new Error(`Feed size ${bodySize} bytes exceeds maximum allowed size of ${MAX_FEED_SIZE_BYTES} bytes`);
    }

    // Parse RSS or Atom with rss-parser
    let parsed: Awaited<ReturnType<typeof parser.parseString>>;
    try {
      parsed = await parser.parseString(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse feed XML: ${message}`);
    }

    // Extract new etag and last-modified from response headers
    const newEtag = response.headers.get('etag');
    const newLastModified = response.headers.get('last-modified');

    // Map parsed items to our FeedItem shape, filtering out entries with no URL
    const allItems: FeedItem[] = (parsed.items ?? [])
      .map((item) => {
        // rss-parser normalizes link across RSS (<link>) and Atom (<link href="..."/>)
        const url = item.link ?? '';
        const guid = item.guid ?? item.id ?? url;

        return {
          guid,
          title: item.title ?? '',
          url,
          published_at: item.pubDate ?? item.isoDate ?? null,
          content_type: null, // determined at download time
          metadata: {},
        };
      })
      .filter((item) => item.url.length > 0);

    // Respect max_items_per_poll limit (guard against 0 or negative)
    const limit = feed.max_items_per_poll > 0 ? feed.max_items_per_poll : 10;
    const items = allItems.slice(0, limit);

    return {
      feed_id: feed.id,
      items,
      etag: newEtag,
      last_modified: newLastModified,
      was_modified: true,
    };
  }
}
