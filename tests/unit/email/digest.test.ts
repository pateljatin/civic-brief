import { describe, it, expect } from 'vitest';
import { buildDigestSummary, buildDigestHtml } from '@/lib/email/digest';
import { createMockFeed, createMockPollRun, createMockPollRunItem } from '../../helpers/factories';

describe('digest', () => {
  describe('buildDigestSummary', () => {
    it('aggregates run stats correctly', () => {
      const summary = buildDigestSummary({
        runs: [createMockPollRun({ status: 'completed' })],
        items: [
          createMockPollRunItem({
            items_processed: 5,
            items_skipped: 2,
            new_briefs_created: 3,
            skipped_formats: { 'text/html': 1, 'application/msword': 1 },
            errors: [{ message: 'test', timestamp: new Date().toISOString() }],
          }),
        ],
        feeds: [createMockFeed()],
        periodStart: '2026-03-14',
        periodEnd: '2026-03-21',
      });

      expect(summary.totalRuns).toBe(1);
      expect(summary.totalProcessed).toBe(5);
      expect(summary.totalSkipped).toBe(2);
      expect(summary.totalNewBriefs).toBe(3);
      expect(summary.totalErrors).toBe(1);
    });

    it('identifies top skipped format', () => {
      const summary = buildDigestSummary({
        runs: [],
        items: [
          createMockPollRunItem({ skipped_formats: { 'text/html': 5, 'application/msword': 2 } }),
        ],
        feeds: [],
        periodStart: '2026-03-14',
        periodEnd: '2026-03-21',
      });
      expect(summary.topSkippedFormat).toBe('text/html');
    });

    it('handles empty data', () => {
      const summary = buildDigestSummary({
        runs: [],
        items: [],
        feeds: [],
        periodStart: '2026-03-14',
        periodEnd: '2026-03-21',
      });
      expect(summary.totalRuns).toBe(0);
      expect(summary.totalProcessed).toBe(0);
      expect(summary.totalSkipped).toBe(0);
      expect(summary.totalNewBriefs).toBe(0);
      expect(summary.totalErrors).toBe(0);
      expect(summary.topSkippedFormat).toBeNull();
      expect(summary.feedHealth).toEqual([]);
    });

    it('marks feed as healthy when no items in period', () => {
      const summary = buildDigestSummary({
        runs: [],
        items: [],
        feeds: [createMockFeed({ name: 'Quiet Feed' })],
        periodStart: '2026-03-14',
        periodEnd: '2026-03-21',
      });
      expect(summary.feedHealth[0]).toEqual({ name: 'Quiet Feed', status: 'healthy' });
    });

    it('marks feed as degraded when <= 50% of items failed', () => {
      const feed = createMockFeed({ id: 'feed-aaa' });
      const summary = buildDigestSummary({
        runs: [],
        items: [
          createMockPollRunItem({ feed_id: 'feed-aaa', status: 'completed' }),
          createMockPollRunItem({ feed_id: 'feed-aaa', status: 'failed' }),
        ],
        feeds: [feed],
        periodStart: '2026-03-14',
        periodEnd: '2026-03-21',
      });
      expect(summary.feedHealth[0].status).toBe('degraded');
    });

    it('marks feed as failing when > 50% of items failed', () => {
      const feed = createMockFeed({ id: 'feed-bbb' });
      const summary = buildDigestSummary({
        runs: [],
        items: [
          createMockPollRunItem({ feed_id: 'feed-bbb', status: 'failed' }),
          createMockPollRunItem({ feed_id: 'feed-bbb', status: 'failed' }),
          createMockPollRunItem({ feed_id: 'feed-bbb', status: 'completed' }),
        ],
        feeds: [feed],
        periodStart: '2026-03-14',
        periodEnd: '2026-03-21',
      });
      expect(summary.feedHealth[0].status).toBe('failing');
    });

    it('aggregates skipped_formats across multiple items', () => {
      const summary = buildDigestSummary({
        runs: [],
        items: [
          createMockPollRunItem({ skipped_formats: { 'text/html': 3 } }),
          createMockPollRunItem({ skipped_formats: { 'text/html': 2, 'application/msword': 4 } }),
        ],
        feeds: [],
        periodStart: '2026-03-14',
        periodEnd: '2026-03-21',
      });
      // application/msword (4) > text/html (5)? No: html=5, msword=4 -> html wins
      expect(summary.topSkippedFormat).toBe('text/html');
    });
  });

  describe('buildDigestHtml', () => {
    it('returns valid HTML string with summary data', () => {
      const html = buildDigestHtml(
        {
          totalRuns: 7,
          totalProcessed: 42,
          totalSkipped: 8,
          totalErrors: 1,
          totalNewBriefs: 35,
          topSkippedFormat: 'text/html',
          feedHealth: [
            { name: 'Seattle Council', status: 'healthy' },
            { name: 'King County', status: 'degraded' },
          ],
        },
        '2026-03-14',
        '2026-03-21'
      );
      expect(html).toContain('Weekly Digest');
      expect(html).toContain('42');
      expect(html).toContain('text/html');
      expect(html).toContain('Seattle Council');
      expect(html).toContain('King County');
      expect(html).toContain('2026-03-14');
      expect(html).toContain('2026-03-21');
    });

    it('omits top skipped format line when null', () => {
      const html = buildDigestHtml(
        {
          totalRuns: 0,
          totalProcessed: 0,
          totalSkipped: 0,
          totalErrors: 0,
          totalNewBriefs: 0,
          topSkippedFormat: null,
          feedHealth: [],
        },
        '2026-03-14',
        '2026-03-21'
      );
      expect(html).not.toContain('Top skipped format');
    });

    it('includes all feed health rows', () => {
      const html = buildDigestHtml(
        {
          totalRuns: 1,
          totalProcessed: 10,
          totalSkipped: 0,
          totalErrors: 0,
          totalNewBriefs: 10,
          topSkippedFormat: null,
          feedHealth: [
            { name: 'Feed A', status: 'healthy' },
            { name: 'Feed B', status: 'failing' },
          ],
        },
        '2026-03-14',
        '2026-03-21'
      );
      expect(html).toContain('Feed A');
      expect(html).toContain('Feed B');
      expect(html).toContain('healthy');
      expect(html).toContain('failing');
    });
  });
});
