-- Migration 013c: Code review fixes for 013/013b
-- 1. search_path on cleanup_rate_limits must use quoted form to satisfy the advisor
-- 2. Read sources policy adds explicit role guard on the submitted_by branch so anon
--    sessions never evaluate it (defense-in-depth); both auth calls use InitPlan form

ALTER FUNCTION public.cleanup_rate_limits() SET search_path = 'public';

DROP POLICY IF EXISTS "Read sources" ON public.sources;
CREATE POLICY "Read sources"
  ON public.sources FOR SELECT
  USING (
    status = 'processed'
    OR ((select auth.role()) = 'authenticated' AND submitted_by = (select auth.uid()))
  );
