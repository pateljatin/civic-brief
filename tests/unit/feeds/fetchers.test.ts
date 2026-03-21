import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FeedFetcher } from '@/lib/feeds/fetchers';
import { createFeedFetcher } from '@/lib/feeds/fetchers';
import { createMockFeed } from '../../helpers/factories';
import {
  MOCK_RSS_FEED,
  MOCK_ATOM_FEED,
  MOCK_RSS_MIXED_FORMATS,
  mockLegistarMattersResponse,
  mockLegistarAttachmentsResponse,
  mockOpenStatesResponse,
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

  describe('OpenStatesFetcher', () => {
    const openStatesUrl = 'https://v3.openstates.org/bills?jurisdiction=wa&session=2025-2026';

    it('maps OpenStates bills JSON to FeedItem[]', async () => {
      const response = mockOpenStatesResponse(2);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(response),
      });

      const fetcher = createFeedFetcher('json_api');
      const feed = createMockFeed({ feed_type: 'json_api', feed_url: openStatesUrl });
      const result = await fetcher.fetch(feed);

      expect(result.was_modified).toBe(true);
      expect(result.items.length).toBe(2);
      expect(result.items[0].guid).toBe('ocd-bill/wa-0');
      expect(result.items[0].title).toBe('An act relating to civic transparency 0');
      expect(result.items[0].url).toContain('HB1000.pdf');
      expect(result.items[0].metadata).toMatchObject({ identifier: 'HB 1000' });
    });

    it('extracts PDF URLs from bill texts array', async () => {
      const response = mockOpenStatesResponse(1);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(response),
      });

      const fetcher = createFeedFetcher('json_api');
      const feed = createMockFeed({ feed_type: 'json_api', feed_url: openStatesUrl });
      const result = await fetcher.fetch(feed);

      expect(result.items[0].url).toMatch(/\.pdf$/i);
      expect(result.items[0].content_type).toBe('application/pdf');
    });

    it('passes API key in X-API-Key header', async () => {
      process.env.OPENSTATES_API_KEY = 'test-api-key-123';
      const response = mockOpenStatesResponse(1);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(response),
      });

      const fetcher = createFeedFetcher('json_api');
      const feed = createMockFeed({ feed_type: 'json_api', feed_url: openStatesUrl });
      await fetcher.fetch(feed);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key-123',
          }),
        })
      );
      delete process.env.OPENSTATES_API_KEY;
    });

    it('handles rate limit (429) response with appropriate error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({}),
        json: () => Promise.resolve({ error: 'rate limited' }),
      });

      const fetcher = createFeedFetcher('json_api');
      const feed = createMockFeed({ feed_type: 'json_api', feed_url: openStatesUrl });
      await expect(fetcher.fetch(feed)).rejects.toThrow(/rate limit/i);
    });

    it('handles empty response (no bills)', async () => {
      const response = mockOpenStatesResponse(0);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(response),
      });

      const fetcher = createFeedFetcher('json_api');
      const feed = createMockFeed({ feed_type: 'json_api', feed_url: openStatesUrl });
      const result = await fetcher.fetch(feed);

      expect(result.items).toEqual([]);
      expect(result.was_modified).toBe(true);
    });

    it('factory returns OpenStatesFetcher for feed_type json_api', () => {
      const fetcher = createFeedFetcher('json_api');
      expect(fetcher).toBeDefined();
      expect(fetcher.fetch).toBeInstanceOf(Function);
    });

    it('respects max_items_per_poll limit', async () => {
      const response = mockOpenStatesResponse(5);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(response),
      });

      const fetcher = createFeedFetcher('json_api');
      const feed = createMockFeed({ feed_type: 'json_api', feed_url: openStatesUrl, max_items_per_poll: 2 });
      const result = await fetcher.fetch(feed);

      expect(result.items.length).toBeLessThanOrEqual(2);
    });
  });

  describe('LegistarFetcher', () => {
    const legistarUrl = 'https://webapi.legistar.com/v1/seattle';

    it('maps Legistar matters JSON to FeedItem[]', async () => {
      const matters = mockLegistarMattersResponse(2);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(matters),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockLegistarAttachmentsResponse(1000)),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockLegistarAttachmentsResponse(1001)),
      });

      const fetcher = createFeedFetcher('legistar');
      const feed = createMockFeed({ feed_type: 'legistar', feed_url: legistarUrl });
      const result = await fetcher.fetch(feed);

      expect(result.was_modified).toBe(true);
      expect(result.items.length).toBe(2);
      expect(result.items[0].guid).toBe('matter-guid-0');
      expect(result.items[0].title).toBe('Ordinance 2026100');
      expect(result.items[0].url).toContain('Ordinance_1000.pdf');
    });

    it('extracts PDF URLs from MatterAttachmentHyperlink', async () => {
      const matters = mockLegistarMattersResponse(1);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({}),
        json: () => Promise.resolve(matters),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({}),
        json: () => Promise.resolve(mockLegistarAttachmentsResponse(1000)),
      });

      const fetcher = createFeedFetcher('legistar');
      const feed = createMockFeed({ feed_type: 'legistar', feed_url: legistarUrl });
      const result = await fetcher.fetch(feed);

      expect(result.items[0].url).toBe(
        'https://seattle.legistar.com/docs/Ordinance_1000.pdf'
      );
    });

    it('handles empty matters response (returns empty items)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({}),
        json: () => Promise.resolve([]),
      });

      const fetcher = createFeedFetcher('legistar');
      const feed = createMockFeed({ feed_type: 'legistar', feed_url: legistarUrl });
      const result = await fetcher.fetch(feed);

      expect(result.items).toEqual([]);
      expect(result.was_modified).toBe(true);
    });

    it('factory returns LegistarFetcher for feed_type legistar', () => {
      const fetcher = createFeedFetcher('legistar');
      expect(fetcher).toBeDefined();
      expect(fetcher.fetch).toBeInstanceOf(Function);
    });

    it('respects max_items_per_poll limit', async () => {
      const matters = mockLegistarMattersResponse(3);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({}),
        json: () => Promise.resolve(matters),
      });
      for (const matter of matters) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({}),
          json: () => Promise.resolve(mockLegistarAttachmentsResponse(matter.MatterId)),
        });
      }

      const fetcher = createFeedFetcher('legistar');
      const feed = createMockFeed({
        feed_type: 'legistar',
        feed_url: legistarUrl,
        max_items_per_poll: 2,
      });
      const result = await fetcher.fetch(feed);

      expect(result.items.length).toBeLessThanOrEqual(2);
    });
  });
});
