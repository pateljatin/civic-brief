import { describe, it, expect } from 'vitest';
import {
  FEED_TYPES,
  POLL_RUN_STATUSES,
} from '@/lib/types';
import type {
  Feed,
  FeedType,
  FeedPollRun,
  FeedPollRunItem,
  PollRunStatus,
} from '@/lib/types';
import type {
  FeedItem,
  FetchResult,
  SkippedItem,
  PipelineResult,
  IngestFeedResponse,
} from '@/lib/feeds/types';

describe('feed types', () => {
  describe('FEED_TYPES', () => {
    it('contains all supported feed types', () => {
      expect(FEED_TYPES).toContain('rss');
      expect(FEED_TYPES).toContain('atom');
      expect(FEED_TYPES).toContain('json_api');
      expect(FEED_TYPES).toContain('legistar');
      expect(FEED_TYPES).toHaveLength(4);
    });
  });

  describe('POLL_RUN_STATUSES', () => {
    it('contains all poll run statuses', () => {
      expect(POLL_RUN_STATUSES).toContain('running');
      expect(POLL_RUN_STATUSES).toContain('completed');
      expect(POLL_RUN_STATUSES).toContain('partial');
      expect(POLL_RUN_STATUSES).toContain('failed');
      expect(POLL_RUN_STATUSES).toHaveLength(4);
    });
  });

  describe('IngestFeedResponse discriminated union', () => {
    it('narrows on type field', () => {
      const success: IngestFeedResponse = { type: 'success', items_processed: 3, new_briefs: 3 };
      const skipped: IngestFeedResponse = { type: 'skipped', reason: 'not_modified' };
      const error: IngestFeedResponse = { type: 'error', message: 'timeout' };

      expect(success.type).toBe('success');
      expect(skipped.type).toBe('skipped');
      expect(error.type).toBe('error');
    });
  });

  describe('SkippedItem reasons', () => {
    it('accepts all valid skip reasons', () => {
      const reasons: SkippedItem['reason'][] = [
        'unsupported_format', 'ssrf_blocked', 'domain_mismatch',
        'too_large', 'duplicate_url', 'duplicate_hash', 'budget_exceeded',
      ];
      expect(reasons).toHaveLength(7);
    });
  });
});
