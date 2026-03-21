import type { Feed } from '@/lib/types';
import type { FeedFetcher } from './index';
import type { FetchResult, FeedItem } from '@/lib/feeds/types';
import { validateFetchTarget } from '@/lib/ssrf';

const USER_AGENT =
  'CivicBrief/1.0 (civic feed aggregator; https://civic-brief.vercel.app)';

interface LegistarMatter {
  MatterId: number;
  MatterGuid: string;
  MatterTitle: string;
  MatterLastModifiedUtc: string;
  MatterTypeName: string;
}

interface LegistarAttachment {
  MatterAttachmentId: number;
  MatterAttachmentName: string;
  MatterAttachmentHyperlink: string;
  MatterAttachmentMatterVersion: number;
}

/**
 * Extracts the city slug from a Legistar feed URL.
 * Accepts full API URLs like https://webapi.legistar.com/v1/seattle
 * or bare slugs like "seattle".
 */
function extractSlug(feedUrl: string): string {
  try {
    const url = new URL(feedUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? feedUrl;
  } catch {
    // feedUrl is already a bare slug
    return feedUrl.split('/').filter(Boolean).pop() ?? feedUrl;
  }
}

function isPdfAttachment(attachment: LegistarAttachment): boolean {
  const hyperlink = attachment.MatterAttachmentHyperlink?.toLowerCase() ?? '';
  const name = attachment.MatterAttachmentName?.toLowerCase() ?? '';
  return hyperlink.endsWith('.pdf') || name.endsWith('.pdf');
}

export class LegistarFetcher implements FeedFetcher {
  async fetch(feed: Feed): Promise<FetchResult> {
    const slug = extractSlug(feed.feed_url);
    const baseUrl = `https://webapi.legistar.com/v1/${slug}`;

    // SSRF validate the base API URL before any outbound request.
    const validation = await validateFetchTarget(baseUrl);
    if (!validation.valid) {
      throw new Error(`SSRF validation failed: ${validation.error}`);
    }

    // Respect max_items_per_poll (guard against 0 or negative)
    const limit = feed.max_items_per_poll > 0 ? feed.max_items_per_poll : 10;

    // Fetch the most recently modified matters
    const mattersUrl = `${baseUrl}/matters?$top=${limit}&$orderby=MatterLastModifiedUtc desc`;
    const mattersResponse = await fetch(mattersUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!mattersResponse.ok) {
      throw new Error(
        `Legistar matters fetch failed with HTTP ${mattersResponse.status}: ${mattersResponse.statusText}`
      );
    }

    const matters: LegistarMatter[] = await mattersResponse.json();

    if (matters.length === 0) {
      return {
        feed_id: feed.id,
        items: [],
        etag: null,
        last_modified: null,
        was_modified: true,
      };
    }

    // For each matter, fetch attachments and pick PDF URLs
    const items: FeedItem[] = [];

    for (const matter of matters.slice(0, limit)) {
      const attachmentsUrl = `${baseUrl}/matters/${matter.MatterId}/attachments`;
      const attachmentsResponse = await fetch(attachmentsUrl, {
        headers: { 'User-Agent': USER_AGENT },
      });

      if (!attachmentsResponse.ok) {
        // Non-fatal: skip this matter if attachments cannot be fetched
        continue;
      }

      const attachments: LegistarAttachment[] = await attachmentsResponse.json();
      const pdfAttachment = attachments.find(isPdfAttachment);

      if (!pdfAttachment) {
        // No PDF for this matter -- skip it
        continue;
      }

      items.push({
        guid: matter.MatterGuid,
        title: matter.MatterTitle,
        url: pdfAttachment.MatterAttachmentHyperlink,
        published_at: matter.MatterLastModifiedUtc,
        content_type: 'application/pdf',
        metadata: {
          matter_id: matter.MatterId,
          matter_type: matter.MatterTypeName,
          attachment_id: pdfAttachment.MatterAttachmentId,
          attachment_version: pdfAttachment.MatterAttachmentMatterVersion,
        },
      });
    }

    // Legistar has no conditional request support -- always report modified
    return {
      feed_id: feed.id,
      items,
      etag: null,
      last_modified: null,
      was_modified: true,
    };
  }
}
