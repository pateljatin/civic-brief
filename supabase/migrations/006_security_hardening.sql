-- Migration 006: Security hardening
-- Fixes all warnings from Supabase Security Advisor (April 2026)
--
-- 1. Pin search_path on all functions (prevents search_path injection)
-- 2. Set daily_usage_summary view to SECURITY INVOKER (respects RLS)
-- 3. Move pg_trgm extension to 'extensions' schema

-- ─── 1. Pin search_path on all functions ──────────────────────────────────────

alter function public.search_briefs(text, text, uuid, text, text, int)
  set search_path = 'public';

alter function public.jurisdictions_at_point(double precision, double precision)
  set search_path = 'public';

alter function public.jurisdiction_ancestors(uuid)
  set search_path = 'public';

alter function public.briefs_for_location(uuid, text, int)
  set search_path = 'public';

alter function public.update_updated_at()
  set search_path = 'public';

-- handle_new_user() already has search_path = '' (correct for SECURITY DEFINER auth triggers)

alter function public.user_daily_usage(uuid)
  set search_path = 'public';

alter function public.user_can_summarize(uuid)
  set search_path = 'public';

alter function public.active_feeds()
  set search_path = 'public';

alter function public.finalize_poll_run(uuid)
  set search_path = 'public';

-- ─── 2. Fix view security ─────────────────────────────────────────────────────

alter view public.daily_usage_summary set (security_invoker = on);

-- ─── 3. Move pg_trgm to extensions schema ─────────────────────────────────────
-- Create extensions schema if it doesn't exist, then move the extension.
-- Note: Supabase projects typically have an 'extensions' schema already.

create schema if not exists extensions;

-- Drop and recreate pg_trgm in extensions schema.
-- This requires recreating any indexes that depend on it.
-- Since our only pg_trgm index is on jurisdictions.name, we handle that here.

drop index if exists idx_jurisdictions_name_trgm;
drop index if exists jurisdictions_name_trgm;
drop extension if exists pg_trgm;
create extension pg_trgm schema extensions;

-- Recreate the trigram index (now referencing extensions.pg_trgm operators)
create index idx_jurisdictions_name_trgm
  on jurisdictions using gin (name extensions.gin_trgm_ops);
