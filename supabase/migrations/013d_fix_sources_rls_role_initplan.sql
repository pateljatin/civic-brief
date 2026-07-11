-- Migration 013d: Wrap auth.role() in (select ...) to fix initplan warning on sources
-- auth.role() without (select ...) was re-evaluated per row; now evaluated once per query

DROP POLICY IF EXISTS "Read sources" ON public.sources;
CREATE POLICY "Read sources"
  ON public.sources FOR SELECT
  USING (
    status = 'processed'
    OR ((select auth.role()) = 'authenticated' AND submitted_by = (select auth.uid()))
  );
