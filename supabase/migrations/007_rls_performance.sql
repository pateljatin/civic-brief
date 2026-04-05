-- Migration 007: RLS performance optimization
-- Fixes all Supabase Performance Advisor warnings (April 2026)
--
-- 1. Wrap auth.uid() in (select ...) to evaluate once per query, not per row
-- 2. Drop redundant "Users read own submissions" policy on sources
--    (overlaps with "Public read sources" which already covers all roles)

-- ─── 1. Fix auth.uid() per-row re-evaluation ─────────────────────────────────
-- Pattern: replace `auth.uid()` with `(select auth.uid())` so Postgres
-- evaluates it once as a subquery, not for every row scanned.

-- profiles: read
drop policy if exists "Users read own profile" on profiles;
create policy "Users read own profile"
  on profiles for select
  using ((select auth.uid()) = id);

-- profiles: update
drop policy if exists "Users update own profile" on profiles;
create policy "Users update own profile"
  on profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- usage_events: read
drop policy if exists "Users read own usage" on usage_events;
create policy "Users read own usage"
  on usage_events for select
  using ((select auth.uid()) = user_id);

-- community_feedback: insert
drop policy if exists "Authenticated insert own feedback" on community_feedback;
create policy "Authenticated insert own feedback"
  on community_feedback for insert
  with check ((select auth.uid()) = user_id);

-- user_jurisdictions: manage
drop policy if exists "Users manage own jurisdictions" on user_jurisdictions;
create policy "Users manage own jurisdictions"
  on user_jurisdictions for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─── 2. Remove redundant overlapping policy on sources ────────────────────────
-- "Public read sources" allows SELECT where status='processed' for ALL roles.
-- "Users read own submissions" allows SELECT where submitted_by=auth.uid() OR status='processed'.
-- The second is redundant for the processed case and creates a duplicate permissive policy.
-- Drop it and replace with a narrower policy: users see their own unprocessed submissions.

drop policy if exists "Users read own submissions" on sources;
create policy "Users read own submissions"
  on sources for select
  to authenticated
  using (submitted_by = (select auth.uid()) and status != 'processed');
