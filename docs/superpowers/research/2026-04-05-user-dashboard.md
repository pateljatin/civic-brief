# User Dashboard: Research Report

**Date:** 2026-04-05
**Status:** Research complete, ready for spec writing

---

## Current Auth System

**Architecture:** Next.js-managed Google OAuth with Supabase session storage.

### Flow
1. `AuthButton.tsx` constructs Google OAuth URL, sets CSRF cookie, redirects
2. `src/app/auth/callback/route.ts` exchanges code for tokens, calls `supabase.auth.signInWithIdToken()`
3. `src/proxy.ts` refreshes auth tokens via cookie manipulation on every request
4. `src/lib/supabase-server.ts` provides `createAuthServerClient()` for Server Components

**Note:** Sign-in flow is duplicated in `AuthButton.tsx` and `FeedbackSection.tsx`. Needs consolidation before dashboard.

---

## Current User Model

### profiles table (migration 002 + 005)
- id, display_name, avatar_url, preferred_language_id
- daily_limit (default 3), role (citizen/reviewer/admin)
- contribution_score, badges (jsonb), streak_current/longest (gamification, unpopulated)
- home_jurisdiction_id, last_active_at
- Auto-created via `on_auth_user_created` trigger from Google metadata

### user_jurisdictions table (migration 005)
- user_id + jurisdiction_id (composite PK)
- is_primary, notify (boolean)
- Currently unused by any UI

### usage_events table (migration 002)
- Tracks summarize, translate, verify, view_brief events
- Links to user_id, source_id, brief_id, tokens_used, latency_ms

### User-linked columns
- `sources.submitted_by` (nullable UUID)
- `community_feedback.user_id` (NOT NULL UUID)

---

## Dashboard Data Availability

| Section | Table(s) | Index Exists | Currently Populated |
|---------|----------|-------------|-------------------|
| My Briefs | sources + briefs via submitted_by | Yes | Yes (when authed) |
| My Feedback | community_feedback via user_id | Yes | Yes |
| My Jurisdictions | user_jurisdictions | Yes | No (table empty) |
| Usage Stats | usage_events | Yes | Yes |
| Profile | profiles | Yes | Yes (auto-created) |
| Gamification | profiles columns | N/A | No (all defaults) |
| Saved Briefs | (table doesn't exist) | N/A | N/A |

---

## Dashboard Scope

### What's useful NOW (data exists)
- **My Briefs:** documents uploaded by the user, with brief headline, confidence score, date
- **My Feedback:** feedback submissions with resolution status
- **Profile:** name, avatar, preferred language, daily limit remaining

### What's useful SOON (depends on other features)
- **My Jurisdictions:** requires "Jurisdiction Following" feature to populate user_jurisdictions
- **Gamification:** requires v1.2 gamification feature to populate scores/badges/streaks
- **Saved Briefs:** requires new `user_bookmarks` table

### Recommendation
Ship dashboard with My Briefs + My Feedback + Profile/Settings. Leave jurisdiction and gamification sections as placeholders for their respective features.

---

## Privacy Considerations

- All dashboard data is user-controlled (they chose to upload, give feedback, etc.)
- No PII beyond Google profile (name, email, avatar) + user-configured preferences
- Usage events store `ip_hash` (SHA-256) for anonymous users, `user_id` for authenticated
- Feedback is publicly readable by RLS policy (user should know)
- **Recommend:** Include "Your data" section showing what's stored + account deletion option

---

## Implementation Notes

### Route: `/dashboard`
- Client component (interactive tabs)
- Auth guard needed (no route protection exists currently)
- Redirect to home or sign-in prompt if unauthenticated

### New API routes needed
- `GET /api/dashboard/briefs` -- user's submitted docs with brief data
- `GET /api/dashboard/feedback` -- user's feedback history
- `GET /api/dashboard/stats` -- usage summary
- Profile updates: use Supabase client directly (RLS allows self-update)

### UI
- Use `container-narrow` (720px) layout
- Tab-based: My Briefs, My Feedback, Settings
- Card-based list items matching scenario card / brief card patterns
- Define all 5 states per section: default, loading, empty, error, demo

### Nav integration
- `AuthButton.tsx` dropdown (currently just "Sign out") should add "Dashboard" link

### Dependencies
- Consolidate duplicated auth sign-in logic before building dashboard
- Jurisdiction Following feature feeds into My Jurisdictions section
- Gamification feature feeds into profile badges/streaks
