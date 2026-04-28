-- C16: Eval scoring columns on briefs
-- Hybrid strategy: dedicated columns for queryable fields, JSONB for dimension details.

ALTER TABLE briefs ADD COLUMN eval_overall_score NUMERIC(4,2);
ALTER TABLE briefs ADD COLUMN eval_scored_at TIMESTAMPTZ;
ALTER TABLE briefs ADD COLUMN eval_details JSONB DEFAULT '{}';

-- Partial index: only index rows that have been scored
CREATE INDEX idx_briefs_eval_overall
  ON briefs (eval_overall_score)
  WHERE eval_overall_score IS NOT NULL;

COMMENT ON COLUMN briefs.eval_overall_score IS 'Composite quality score (0-1). Weighted: readability 40%, tone 35%, jargon 25%.';
COMMENT ON COLUMN briefs.eval_scored_at IS 'When the eval was last computed.';
COMMENT ON COLUMN briefs.eval_details IS 'Full eval dimension breakdown. Shape: {readabilityGrade, readabilityEase, toneScore, jargonScore, jargonTerms, provider}';
