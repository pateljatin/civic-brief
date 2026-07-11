-- Migration 013b: Fix sources RLS policy to avoid per-row auth.uid() evaluation
-- Wrapping auth.uid() in (select ...) creates an InitPlan evaluated once per query

DROP POLICY IF EXISTS "Read sources" ON public.sources;
CREATE POLICY "Read sources"
  ON public.sources FOR SELECT
  USING (
    status = 'processed'
    OR submitted_by = (select auth.uid())
  );
