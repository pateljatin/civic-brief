-- Rate limit tracking table
-- Replaces the in-memory Map in src/lib/security.ts that resets on Vercel cold starts
-- and cannot share state across parallel isolates.
--
-- Key format: 'ip:1.2.3.4' or 'user:uuid'
-- Each row represents one sliding window for one key.

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_ms INTEGER NOT NULL DEFAULT 60000
);

-- Index for periodic cleanup of expired windows
CREATE INDEX idx_rate_limits_window ON rate_limits (window_start);

-- Cleanup function: called opportunistically by the application
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE window_start + (window_ms || ' milliseconds')::interval < NOW();
END;
$$ LANGUAGE plpgsql;

-- RLS: enabled with no public policies.
-- Only the service-role key (used by API routes) can read/write.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
