-- 004: Duplicate Document Handling
-- Depends on: 001_initial.sql (sources table)
--
-- Changes:
--   1. Add duplicate_count column to sources
--   2. Add index on source_url for URL-based update detection

-- Track how many times the same document was uploaded (community interest signal)
-- Incremented via service role client only (no RLS update policy needed)
ALTER TABLE sources ADD COLUMN duplicate_count integer NOT NULL DEFAULT 0;

-- Index for URL-based update detection (same URL, different content hash)
CREATE INDEX sources_source_url_idx ON sources (source_url);
