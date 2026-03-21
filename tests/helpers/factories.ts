import type { Feed, FeedPollRun, FeedPollRunItem } from '@/lib/types';
import type { FeedItem, FetchResult } from '@/lib/feeds/types';
import { TEST_JURISDICTION_ID, TEST_FEED_URL, TEST_FEED_ID } from './constants';

export function createMockFeed(overrides?: Partial<Feed>): Feed {
  return {
    id: TEST_FEED_ID,
    jurisdiction_id: TEST_JURISDICTION_ID,
    document_type_id: 2,  // 2 = 'legislation' per document-types.sql
    name: 'Test Feed',
    feed_url: TEST_FEED_URL,
    feed_type: 'rss',
    expected_domain: 'example.gov',
    is_active: true,
    last_polled_at: null,
    last_successful_poll_at: null,
    last_seen_item_guid: null,
    etag: null,
    last_modified: null,
    consecutive_failures: 0,
    max_items_per_poll: 10,
    metadata: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockFeedItem(overrides?: Partial<FeedItem>): FeedItem {
  return {
    guid: `item-${Date.now()}`,
    title: 'Test Government Document',
    url: 'https://example.gov/doc.pdf',
    published_at: new Date().toISOString(),
    content_type: 'application/pdf',
    metadata: {},
    ...overrides,
  };
}

export function createMockFetchResult(overrides?: Partial<FetchResult>): FetchResult {
  return {
    feed_id: TEST_FEED_ID,
    items: [createMockFeedItem()],
    etag: '"abc123"',
    last_modified: 'Thu, 21 Mar 2026 00:00:00 GMT',
    was_modified: true,
    ...overrides,
  };
}

export function createMockPollRun(overrides?: Partial<FeedPollRun>): FeedPollRun {
  return {
    id: '00000000-0000-0000-0000-runrunrunrun',
    started_at: new Date().toISOString(),
    completed_at: null,
    status: 'running',
    feeds_dispatched: 0,
    total_items_processed: 0,
    total_items_skipped: 0,
    total_errors: 0,
    total_new_briefs: 0,
    duration_ms: null,
    metadata: {},
    ...overrides,
  };
}

export function createMockPollRunItem(overrides?: Partial<FeedPollRunItem>): FeedPollRunItem {
  return {
    id: '00000000-0000-0000-0000-itemitemitem',
    run_id: '00000000-0000-0000-0000-runrunrunrun',
    feed_id: TEST_FEED_ID,
    status: 'pending',
    items_found: 0,
    items_processed: 0,
    items_skipped: 0,
    items_deferred: 0,
    new_briefs_created: 0,
    skipped_formats: {},
    errors: [],
    duration_ms: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
