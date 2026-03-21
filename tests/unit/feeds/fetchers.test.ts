import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FeedFetcher } from '@/lib/feeds/fetchers';
import { createFeedFetcher } from '@/lib/feeds/fetchers';
import { createMockFeed } from '../../helpers/factories';
import {
  MOCK_RSS_FEED,
  MOCK_ATOM_FEED,
  MOCK_RSS_MIXED_FORMATS,
} from '../../helpers/mocks';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock SSRF validation to always pass in tests
vi.mock('@/lib/ssrf', () => ({
  validateFetchTarget: vi.fn().mockResolvedValue({ valid: true }),
}));

describe('fetchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createFeedFetcher', () => {
    it('returns fetcher for rss type', () => {
      const fetcher = createFeedFetcher('rss');
      expect(fetcher).toBeDefined();
      expect(fetcher.fetch).toBeInstanceOf(Function);
    });

    it('returns fetcher for atom type', () => {
      const fetcher = createFeedFetcher('atom');
      expect(fetcher).toBeDefined();
    });

    it('throws for unsupported feed type', () => {
      expect(() => createFeedFetcher('unknown' as any)).toThrow();
    });
  });

  describe('RssFetcher', () => {
    it('parses valid RSS 2.0 feed into FeedItem[]', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'application/rss+xml',
          'etag': '"rss-etag"',
          'last-modified': 'Thu, 21 Mar 2026 00:00:00 GMT',
        }),
        text: () => Promise.resolve(MOCK_RSS_FEED),
      });

      const fetcher = createFeedFetcher('rss');
      const feed = createMockFeed({ feed_type: 'rss' });
      const result = await fetcher.fetch(feed);

      expect(result.was_modified).toBe(true);
      expect(result.items.length).toBe(1);
      expect(result.items[0].guid).toBe('res-32145');
      expect(result.items[0].title).toBe('Resolution 32145');
      expect(result.items[0].url).toContain('resolution-32145.pdf');
      expect(result.etag).toBe('"rss-etag"');
    });

    it('parses valid Atom feed into FeedItem[]', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/atom+xml' }),
        text: () => Promise.resolve(MOCK_ATOM_FEED),
      });

      const fetcher = createFeedFetcher('atom');
      const feed = createMockFeed({ feed_type: 'atom' });
      const result = await fetcher.fetch(feed);

      expect(result.was_modified).toBe(true);
      expect(result.items.length).toBe(1);
      expect(result.items[0].title).toBe('Ordinance 19876');
    });

    it('returns was_modified: false on 304 Not Modified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 304,
        headers: new Headers({}),
        text: () => Promise.resolve(''),
      });

      const fetcher = createFeedFetcher('rss');
      const feed = createMockFeed({ etag: '"old-etag"' });
      const result = await fetcher.fetch(feed);

      expect(result.was_modified).toBe(false);
      expect(result.items).toEqual([]);
    });

    it('sends If-None-Match when feed has etag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 304,
        headers: new Headers({}),
        text: () => Promise.resolve(''),
      });

      const fetcher = createFeedFetcher('rss');
      const feed = createMockFeed({ etag: '"existing-etag"' });
      await fetcher.fetch(feed);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'If-None-Match': '"existing-etag"',
          }),
        })
      );
    });

    it('sends If-Modified-Since when feed has last_modified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 304,
        headers: new Headers({}),
        text: () => Promise.resolve(''),
      });

      const fetcher = createFeedFetcher('rss');
      const feed = createMockFeed({ last_modified: 'Thu, 20 Mar 2026 00:00:00 GMT' });
      await fetcher.fetch(feed);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'If-Modified-Since': 'Thu, 20 Mar 2026 00:00:00 GMT',
          }),
        })
      );
    });

    it('rejects XML exceeding 5MB', async () => {
      const largeXml = '<rss>' + 'x'.repeat(6 * 1024 * 1024) + '</rss>';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': String(largeXml.length) }),
        text: () => Promise.resolve(largeXml),
      });

      const fetcher = createFeedFetcher('rss');
      const feed = createMockFeed();
      await expect(fetcher.fetch(feed)).rejects.toThrow(/size/i);
    });

    it('handles malformed XML gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({}),
        text: () => Promise.resolve('<rss><broken'),
      });

      const fetcher = createFeedFetcher('rss');
      const feed = createMockFeed();
      await expect(fetcher.fetch(feed)).rejects.toThrow();
    });

    it('handles HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({}),
        text: () => Promise.resolve('Server Error'),
      });

      const fetcher = createFeedFetcher('rss');
      const feed = createMockFeed();
      await expect(fetcher.fetch(feed)).rejects.toThrow(/500/);
    });

    it('respects max_items_per_poll limit', async () => {
      // RSS with 3 items but max_items_per_poll = 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({}),
        text: () => Promise.resolve(MOCK_RSS_MIXED_FORMATS),
      });

      const fetcher = createFeedFetcher('rss');
      const feed = createMockFeed({ max_items_per_poll: 1 });
      const result = await fetcher.fetch(feed);

      expect(result.items.length).toBeLessThanOrEqual(1);
    });
  });
});
