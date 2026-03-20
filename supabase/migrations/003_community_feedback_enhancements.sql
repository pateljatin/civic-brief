-- 003: Community Feedback Enhancements
-- Depends on: 002_auth_and_usage.sql (which added nullable user_id)
--
-- Changes:
--   1. Tighten user_id to NOT NULL (was nullable)
--   2. Add metadata jsonb column
--   3. Update RLS policies for authenticated inserts
--   4. Add unique constraint (one feedback type per user per brief)

-- Clean up any existing rows without user_id
DELETE FROM community_feedback WHERE user_id IS NULL;

-- Tighten user_id to NOT NULL
ALTER TABLE community_feedback ALTER COLUMN user_id SET NOT NULL;

-- Add metadata for product context (not PII)
ALTER TABLE community_feedback
  ADD COLUMN metadata jsonb DEFAULT '{}';

-- Update RLS: require auth for inserts, keep public reads
DROP POLICY IF EXISTS "Public insert feedback" ON community_feedback;
DROP POLICY IF EXISTS "Public read feedback" ON community_feedback;

CREATE POLICY "Authenticated insert own feedback"
  ON community_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read feedback"
  ON community_feedback FOR SELECT
  USING (true);

-- Prevent duplicate feedback: one user, one type per brief
CREATE UNIQUE INDEX community_feedback_unique_user_type
  ON community_feedback (brief_id, user_id, feedback_type);
