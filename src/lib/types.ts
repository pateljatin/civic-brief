// ─── Database Row Types ───

export interface Country {
  id: number;
  iso_alpha2: string;
  iso_alpha3: string;
  iso_numeric: string;
  name: string;
  official_name: string | null;
  identifier_system: string | null;
}

export interface JurisdictionLevel {
  id: number;
  country_id: number;
  slug: string;
  name: string;
  depth: number;
}

export interface Jurisdiction {
  id: string;
  parent_id: string | null;
  level_id: number;
  country_id: number;
  name: string;
  slug: string;
  ocd_id: string | null;
  fips_code: string | null;
  iso_3166_2: string | null;
  geonames_id: number | null;
  external_ids: Record<string, string> | null;
  population: number | null;
  timezone: string | null;
  website_url: string | null;
  valid_from: string | null;
  valid_until: string | null;
  successor_id: string | null;
  created_at: string;
}

export interface Language {
  id: number;
  bcp47: string;
  name: string;
  native_name: string;
  pg_config: string;
}

export interface Topic {
  id: number;
  parent_id: number | null;
  slug: string;
  name: string;
  description: string | null;
}

export interface DocumentType {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

export interface Source {
  id: string;
  jurisdiction_id: string;
  document_type_id: number;
  title: string;
  source_url: string;
  archive_url: string | null;
  content_hash: string;
  published_at: string | null;
  language_id: number | null;
  factuality_score: number | null;
  confidence_level: 'high' | 'medium' | 'low' | null;
  requires_review: boolean;
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'retracted';
  metadata: Record<string, unknown> | null;
  duplicate_count: number;
  created_at: string;
  updated_at: string;
}

export interface Brief {
  id: string;
  source_id: string;
  language_id: number;
  headline: string;
  summary: string;
  content: CivicContent;
  who_affected: string | null;
  what_action: string | null;
  deadline: string | null;
  is_published: boolean;
  published_at: string | null;
  version: number;
  previous_version_id: string | null;
  tags: string[];
  model_used: string;
  prompt_version: string;
  created_at: string;
}

export interface BriefTopic {
  brief_id: string;
  topic_id: number;
  confidence: number;
  assigned_by: 'ai' | 'human';
}

export type FeedbackType =
  | 'factual_error'
  | 'missing_info'
  | 'misleading'
  | 'translation_error'
  | 'outdated'
  | 'helpful';

export const FEEDBACK_TYPES: readonly FeedbackType[] = [
  'factual_error',
  'missing_info',
  'misleading',
  'translation_error',
  'outdated',
  'helpful',
] as const;

export interface CommunityFeedback {
  id: string;
  brief_id: string;
  user_id: string;
  feedback_type: FeedbackType;
  details: string | null;
  metadata: Record<string, unknown>;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
}

// ─── Civic Content (the structured JSON output from Claude) ───

export interface CivicContent {
  title: string;
  what_changed: string;
  who_affected: string;
  what_to_do: string;
  money: string | null;
  deadlines: string[];
  context: string;
  key_quotes: string[];
  document_type: string;
}

// ─── Verification Output ───

export interface VerificationResult {
  confidence_score: number;
  confidence_level: 'high' | 'medium' | 'low';
  verified_claims: string[];
  unverified_claims: string[];
  omitted_info: string[];
  reasoning: string;
}

// ─── Translation Output ───

export interface TranslatedContent extends CivicContent {
  original_language: string;
  target_language: string;
}

// ─── API Request/Response Types ───

export interface SummarizeRequest {
  sourceUrl: string;
  jurisdictionId?: string;
  documentTypeSlug?: string;
}

export type SummarizeResult =
  | {
      duplicate: true;
      sourceId: string;
      briefId: string | null;
      redirectUrl: string;
      message: string;
    }
  | {
      duplicate?: false;
      sourceId: string | null;
      briefId: string | null;
      brief: {
        headline: string;
        summary: string;
        content: CivicContent;
        confidence_score: number;
        confidence_level: 'high' | 'medium' | 'low';
      };
      verification?: VerificationResult;
      translations: {
        language: string;
        briefId: string | null;
        headline?: string;
        content?: CivicContent;
      }[];
      previousVersionId?: string;
    };

/** @deprecated Use SummarizeResult instead */
export type SummarizeResponse = SummarizeResult;

export interface TranslateRequest {
  briefId: string;
  targetLanguage: string;
}

export interface TranslateResponse {
  briefId: string;
  language: string;
  headline: string;
  content: CivicContent;
}

export interface VerifyRequest {
  briefId: string;
}

export interface VerifyResponse {
  briefId: string;
  verification: VerificationResult;
}

export interface FeedbackRequest {
  briefId: string;
  feedbackType: FeedbackType;
  details?: string;
}

export interface FeedbackResponse {
  success: boolean;
  feedbackType: FeedbackType;
}

// ─── Pipeline Status (for progress UI) ───

export type PipelineStep =
  | 'extracting'
  | 'summarizing'
  | 'verifying'
  | 'translating'
  | 'saving'
  | 'complete'
  | 'error';

export interface PipelineStatus {
  step: PipelineStep;
  message: string;
}

// ─── Feed Ingestion Types (C7) ───

export interface Feed {
  id: string;
  jurisdiction_id: string;
  document_type_id: number | null;
  name: string;
  feed_url: string;
  feed_type: FeedType;
  expected_domain: string | null;
  is_active: boolean;
  last_polled_at: string | null;
  last_successful_poll_at: string | null;
  last_seen_item_guid: string | null;
  etag: string | null;
  last_modified: string | null;
  consecutive_failures: number;
  max_items_per_poll: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type FeedType = 'rss' | 'atom' | 'json_api' | 'legistar';
export const FEED_TYPES: readonly FeedType[] = ['rss', 'atom', 'json_api', 'legistar'] as const;

export type PollRunStatus = 'running' | 'completed' | 'partial' | 'failed';
export const POLL_RUN_STATUSES: readonly PollRunStatus[] = ['running', 'completed', 'partial', 'failed'] as const;

export interface FeedPollRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: PollRunStatus;
  feeds_dispatched: number;
  total_items_processed: number;
  total_items_skipped: number;
  total_errors: number;
  total_new_briefs: number;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
}

export interface FeedPollRunItem {
  id: string;
  run_id: string;
  feed_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  items_found: number;
  items_processed: number;
  items_skipped: number;
  items_deferred: number;
  new_briefs_created: number;
  skipped_formats: Record<string, number>;
  errors: Array<{ message: string; item_url?: string; timestamp: string }>;
  duration_ms: number | null;
  created_at: string;
}

export interface UserJurisdiction {
  user_id: string;
  jurisdiction_id: string;
  is_primary: boolean;
  notify: boolean;
  created_at: string;
}
