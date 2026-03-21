import type { Feed, FeedPollRun, FeedPollRunItem } from '@/lib/types';

export interface DigestData {
  runs: FeedPollRun[];
  items: FeedPollRunItem[];
  feeds: Feed[];
  periodStart: string;
  periodEnd: string;
}

export interface DigestSummary {
  totalRuns: number;
  totalProcessed: number;
  totalSkipped: number;
  totalErrors: number;
  totalNewBriefs: number;
  topSkippedFormat: string | null;
  feedHealth: { name: string; status: 'healthy' | 'degraded' | 'failing' }[];
}

/**
 * Build digest summary stats from raw data.
 */
export function buildDigestSummary(data: DigestData): DigestSummary {
  const { runs, items, feeds } = data;

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalNewBriefs = 0;
  const formatCounts: Record<string, number> = {};

  for (const item of items) {
    totalProcessed += item.items_processed;
    totalSkipped += item.items_skipped;
    totalErrors += item.errors.length;
    totalNewBriefs += item.new_briefs_created;

    for (const [format, count] of Object.entries(item.skipped_formats)) {
      formatCounts[format] = (formatCounts[format] || 0) + count;
    }
  }

  const topSkippedFormat =
    Object.entries(formatCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  // Build per-feed health based on run items in this period
  const feedItemMap = new Map<string, FeedPollRunItem[]>();
  for (const item of items) {
    const existing = feedItemMap.get(item.feed_id) || [];
    existing.push(item);
    feedItemMap.set(item.feed_id, existing);
  }

  const feedHealth = feeds.map(feed => {
    const feedItems = feedItemMap.get(feed.id) || [];
    const failCount = feedItems.filter(i => i.status === 'failed').length;
    const totalCount = feedItems.length;

    let status: 'healthy' | 'degraded' | 'failing';
    if (totalCount === 0 || failCount === 0) status = 'healthy';
    else if (failCount / totalCount > 0.5) status = 'failing';
    else status = 'degraded';

    return { name: feed.name, status };
  });

  return {
    totalRuns: runs.length,
    totalProcessed,
    totalSkipped,
    totalErrors,
    totalNewBriefs,
    topSkippedFormat,
    feedHealth,
  };
}

/**
 * Build HTML email from digest summary.
 */
export function buildDigestHtml(
  summary: DigestSummary,
  periodStart: string,
  periodEnd: string
): string {
  const statusLabel = { healthy: '[OK]', degraded: '[WARN]', failing: '[FAIL]' };

  const feedRows = summary.feedHealth
    .map(
      f =>
        `<tr><td>${statusLabel[f.status]}</td><td>${f.name}</td><td>${f.status}</td></tr>`
    )
    .join('\n');

  return `
    <h2>Civic Brief Weekly Digest</h2>
    <p>${periodStart} to ${periodEnd}</p>

    <h3>Summary</h3>
    <ul>
      <li><strong>Poll runs:</strong> ${summary.totalRuns}</li>
      <li><strong>Documents processed:</strong> ${summary.totalProcessed}</li>
      <li><strong>New briefs created:</strong> ${summary.totalNewBriefs}</li>
      <li><strong>Items skipped:</strong> ${summary.totalSkipped}</li>
      <li><strong>Errors:</strong> ${summary.totalErrors}</li>
      ${summary.topSkippedFormat ? `<li><strong>Top skipped format:</strong> ${summary.topSkippedFormat}</li>` : ''}
    </ul>

    <h3>Feed Health</h3>
    <table>
      <tr><th></th><th>Feed</th><th>Status</th></tr>
      ${feedRows}
    </table>
  `.trim();
}
