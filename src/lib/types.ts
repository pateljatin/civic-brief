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

export interface CommunityFeedback {
  id: string;
  brief_id: string;
  feedback_type: 'factual_error' | 'missing_info' | 'misleading' | 'translation_error' | 'outdated' | 'helpful';
  details: string | null;
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

export interface SummarizeResponse {
  sourceId: string;
  briefId: string;
  brief: {
    headline: string;
    summary: string;
    content: CivicContent;
    confidence_score: number;
    confidence_level: string;
  };
  translations: {
    language: string;
    briefId: string;
  }[];
}

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
