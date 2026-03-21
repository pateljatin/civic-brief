// Feed-specific types for the C7 ingestion system.
// DB model types live in src/lib/types.ts.

export interface FeedItem {
  guid: string;
  title: string;
  url: string;
  published_at: string | null;
  content_type: string | null;
  metadata: Record<string, unknown>;
}

export interface FetchResult {
  feed_id: string;
  items: FeedItem[];
  etag: string | null;
  last_modified: string | null;
  was_modified: boolean;
}

export interface SkippedItem {
  url: string;
  reason: 'unsupported_format' | 'ssrf_blocked' | 'domain_mismatch'
        | 'too_large' | 'duplicate_url' | 'duplicate_hash' | 'budget_exceeded';
  format: string | null;
}

export interface PipelineResult {
  source_id: string;
  brief_ids: { language: string; brief_id: string }[];
  verification: { confidence_score: number; confidence_level: string };
  previous_version_id: string | null;
}

export interface IngestFeedRequest {
  feed_id: string;
  run_id: string;
  timestamp: number;
  signature: string;
}

export type IngestFeedResponse =
  | { type: 'success'; items_processed: number; new_briefs: number }
  | { type: 'skipped'; reason: 'not_modified' | 'budget_exceeded' | 'disabled' }
  | { type: 'error'; message: string };
