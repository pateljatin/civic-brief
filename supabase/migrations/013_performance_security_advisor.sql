-- Migration 013: Performance Advisor + Security Advisor fixes
-- Resolves Supabase advisor findings from #37 (July 2026)

-- ============================================================
-- SECURITY FIXES
-- ============================================================

-- ERROR: brief_jurisdictions has RLS disabled (public table exposed via PostgREST)
ALTER TABLE public.brief_jurisdictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read brief_jurisdictions"
  ON public.brief_jurisdictions FOR SELECT USING (true);

-- WARN: cleanup_rate_limits has mutable search_path (SQL injection risk)
ALTER FUNCTION public.cleanup_rate_limits() SET search_path = 'public';

-- WARN: handle_new_user() is a trigger function but callable by anon/authenticated via REST
-- It should only fire via trigger, never directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- ============================================================
-- PERFORMANCE FIXES
-- ============================================================

-- WARN: Merge two permissive SELECT policies on sources into one
-- Before: "Public read sources" (status='processed') OR "Users read own submissions" (submitted_by=uid AND status!='processed')
-- After: single policy, semantically identical, avoids double evaluation per query
DROP POLICY IF EXISTS "Public read sources" ON public.sources;
DROP POLICY IF EXISTS "Users read own submissions" ON public.sources;
CREATE POLICY "Read sources"
  ON public.sources FOR SELECT
  USING (
    status = 'processed'
    OR ((select auth.role()) = 'authenticated' AND submitted_by = (select auth.uid()))
  );

-- INFO: Add missing indexes on foreign key columns
-- These prevent sequential scans on FK lookups during joins

-- brief_topics
CREATE INDEX IF NOT EXISTS idx_brief_topics_topic_id ON public.brief_topics(topic_id);

-- briefs
CREATE INDEX IF NOT EXISTS idx_briefs_previous_version_id ON public.briefs(previous_version_id);

-- feed_poll_run_items
CREATE INDEX IF NOT EXISTS idx_feed_poll_run_items_feed_id ON public.feed_poll_run_items(feed_id);

-- feeds
CREATE INDEX IF NOT EXISTS idx_feeds_document_type_id ON public.feeds(document_type_id);

-- jurisdiction_languages
CREATE INDEX IF NOT EXISTS idx_jurisdiction_languages_language_id ON public.jurisdiction_languages(language_id);

-- jurisdictions
CREATE INDEX IF NOT EXISTS idx_jurisdictions_level_id ON public.jurisdictions(level_id);
CREATE INDEX IF NOT EXISTS idx_jurisdictions_successor_id ON public.jurisdictions(successor_id);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_home_jurisdiction_id ON public.profiles(home_jurisdiction_id);
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_language_id ON public.profiles(preferred_language_id);

-- sources
CREATE INDEX IF NOT EXISTS idx_sources_document_type_id ON public.sources(document_type_id);
CREATE INDEX IF NOT EXISTS idx_sources_language_id ON public.sources(language_id);

-- topics
CREATE INDEX IF NOT EXISTS idx_topics_parent_id ON public.topics(parent_id);

-- usage_events
CREATE INDEX IF NOT EXISTS idx_usage_events_brief_id ON public.usage_events(brief_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_source_id ON public.usage_events(source_id);

-- user_jurisdictions
CREATE INDEX IF NOT EXISTS idx_user_jurisdictions_jurisdiction_id ON public.user_jurisdictions(jurisdiction_id);
