# C8: Community Verification UI — Design Spec

## Overview

Add a community feedback layer to civic briefs. Users can mark briefs as "helpful" or flag issues (factual errors, missing info, translation errors, misleading, outdated). Feedback that hits a threshold triggers automated re-verification or re-translation. This is Verification Layer 4 in the Civic Brief trust architecture.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth | Required (Google sign-in) | Quality over volume. Anonymous error reports are hard to act on. Reddit requires auth to vote. |
| Feedback types | All 6 from schema | `factual_error`, `missing_info`, `translation_error` (primary); `misleading`, `outdated` (secondary); `helpful` (positive signal) |
| Primary vs secondary | Primary = actionable errors, secondary = subjective | Primary categories are prominent in UI. Secondary are de-emphasized. |
| Re-verification trigger | `factual_error` + `missing_info` >= 2 flags | Triggers LLM-as-Judge re-run with flagged details as context |
| Re-translation trigger | `translation_error` >= 2 flags | Triggers re-translation with feedback context. Full community translation review pipeline is #28 (v2.0). |
| Other feedback types | Logged only | `misleading`, `outdated`, `helpful` are stored for metrics. No automated action. |
| UI placement | Bottom of brief card | Inline expand on desktop. Bottom sheet on mobile (<640px). |
| i18n | ALL text in the brief card must translate | Every static label, button, badge, and tooltip inside CivicBrief must use `ui-strings.ts` and respond to the active language. No hardcoded English inside the card boundary. |
| Admin triage | Supabase dashboard | No custom admin UI in v1.1. Admin guide document for manual triage. |
| Naming | Keep `community_feedback` | Name becomes accurate as product grows toward community reviewer model. |
| Tracking | `metadata jsonb` column | Product context only (platform, language viewed, brief version). No PII, no device fingerprinting. Vercel Analytics handles traffic patterns. |
| DB client | Service role for inserts | Follows existing API route pattern. RLS is defense-in-depth, not primary auth gate. |

## Schema Migration

File: `supabase/migrations/003_community_feedback_enhancements.sql`

Note: `user_id` column and index already exist from `002_auth_and_usage.sql` (nullable, `ON DELETE SET NULL`). This migration tightens the constraint and adds new columns.

```sql
-- Clean up any existing rows without user_id (if any)
DELETE FROM community_feedback WHERE user_id IS NULL;

-- Tighten user_id to NOT NULL (was nullable in 002)
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
```

Key constraints:
- `user_id` tightened to NOT NULL (was nullable in 002)
- `DROP POLICY IF EXISTS` for safe re-runs
- Index `community_feedback_user_id_idx` already exists from 002, not recreated
- Unique index prevents same user flagging same type twice on a brief
- RLS is defense-in-depth; API route uses service role client (bypasses RLS) but validates auth via session

## API Route

File: `src/app/api/feedback/route.ts`

**Endpoint:** `POST /api/feedback`

**Request body:**
```ts
{
  briefId: string;       // UUID of the brief
  feedbackType: FeedbackType;  // one of 6 allowed values
  details?: string;      // optional free text (max 1000 chars, sanitized)
}
```

**Auth:** Required. Session cookie validated via `createAuthServerClient()` from `src/lib/supabase.ts`. DB writes use service role client (existing pattern).

**Rate limit:** 5 requests per minute per user. Keyed on `user_id` (not IP). New `rateLimitByUser()` function in `src/lib/security.ts` using the same in-memory store pattern as the existing `rateLimit()`.

**Flow:**
1. Validate auth session via `createAuthServerClient()` (401 if not signed in)
2. Rate limit check per `user_id` (429 if exceeded)
3. Sanitize `details` field: `sanitizeText()` with 1000 char max
4. Validate `briefId` exists in `briefs` table and `is_published = true`
5. Validate `feedbackType` is one of: `factual_error`, `missing_info`, `misleading`, `translation_error`, `outdated`, `helpful`
6. Build metadata: `{ platform: "web", language: <brief's bcp47>, version: <brief's version number> }`
7. Insert into `community_feedback` via service role client with `user_id` from session
8. If unique constraint violation: return `{ error: "duplicate" }` (409)
9. If `feedbackType` is `factual_error` or `missing_info`:
   - Count total flags of these types on this brief
   - If >= 2: fire-and-forget async re-verification (do NOT await; log errors, do not roll back feedback)
10. If `feedbackType` is `translation_error`:
    - Count total flags on this brief
    - If >= 2: fire-and-forget async re-translation (do NOT await; log errors, do not roll back feedback)
11. Return `{ success: true, feedbackType: <submitted type> }`

**Re-verification/re-translation:** These are fire-and-forget promises. The feedback insert succeeds immediately. The LLM call runs in the background. If it fails, the error is logged via `console.error` but does not affect the user's feedback submission. The re-verified/re-translated brief is stored as a new version (existing `version` + `previous_version_id` columns in `briefs`).

**Error responses:**
- 401: Not authenticated
- 404: Brief not found
- 409: Duplicate feedback
- 422: Invalid feedback type or details too long
- 429: Rate limited

## Component

File: `src/components/FeedbackSection.tsx`

**Props:**
```ts
interface FeedbackSectionProps {
  briefId: string;
  helpfulCount: number;     // pre-fetched from DB
  userFeedback?: string;    // user's existing feedback type, if any
  isSignedIn: boolean;      // from auth session check
}
```

**States:**
1. **Default** — "Helpful" button (green outline) + "Flag an issue" button (muted) + helpful count
2. **Not signed in** — clicking either button redirects to Google OAuth with return URL (uses existing `AuthButton` redirect pattern, not a separate `/auth` page)
3. **Helpful submitted** — green confirmation bar, count increments optimistically
4. **Form expanded** — category selection with primary/secondary split, optional textarea (1000 char max), submit, close X
5. **Submitting** — submit button disabled with spinner
6. **Submitted** — green confirmation, collapses after 3 seconds
7. **Already submitted** — shows "You flagged this as [type]" instead of form
8. **Error** — inline error message (rate limited, network failure, duplicate)

**Category layout in expanded form:**
- "Report an error" heading (bold, civic blue):
  - `factual_error` — "Factual error" with red icon
  - `missing_info` — "Missing info" with amber icon
  - `translation_error` — "Translation error" with purple icon
- "Other concerns" heading (muted):
  - `misleading` — smaller, muted style
  - `outdated` — smaller, muted style

**Mobile (<640px):** Expanded form renders as bottom sheet (`position: fixed; bottom: 0; max-height: 70vh; overflow-y: auto`) with backdrop overlay. Handles keyboard visibility on mobile.

**Demo brief:** FeedbackSection renders in preview mode: buttons are visible but disabled, tooltip says "Sign in and upload a document to give feedback on real briefs."

## Integration Points

### CivicBrief.tsx
Add `<FeedbackSection>` after the source link footer div, inside the brief card. New props added to `CivicBriefProps`: `briefId`, `helpfulCount`, `userFeedback`, `isSignedIn`.

### Brief page (src/app/brief/[id]/page.tsx)
Fetch from Supabase on page load using service role client:
- Count of `helpful` feedback for this brief: `SELECT count(*) FROM community_feedback WHERE brief_id = $1 AND feedback_type = 'helpful'`
- Attempt to get auth session via `createAuthServerClient()` (wrapped in try/catch, returns null if not signed in)
- If signed in: fetch user's existing feedback type on this brief

Pass `briefId`, `helpfulCount`, `userFeedback`, and `isSignedIn` to `CivicBrief` which passes to `FeedbackSection`.

### Types (src/lib/types.ts)
Add `FeedbackType` type alias. Update existing `CommunityFeedback` interface to include `user_id: string` and `metadata: Record<string, unknown>`.

```ts
type FeedbackType = 'factual_error' | 'missing_info' | 'misleading' | 'translation_error' | 'outdated' | 'helpful';
```

### Security (src/lib/security.ts)
Add `rateLimitByUser(userId: string, limit?: number, windowMs?: number)` using the same in-memory Map pattern as existing `rateLimit()`, keyed on `user_id` instead of IP.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/003_community_feedback_enhancements.sql` | Create | Tighten user_id NOT NULL, add metadata, update RLS, unique constraint |
| `src/app/api/feedback/route.ts` | Create | POST handler with auth, validation, fire-and-forget triggers |
| `src/components/FeedbackSection.tsx` | Create | Client component, all 8 states, mobile bottom sheet |
| `src/components/CivicBrief.tsx` | Edit | Add FeedbackSection to footer, new props |
| `src/app/brief/[id]/page.tsx` | Edit | Fetch feedback data + auth session, pass as props |
| `src/lib/types.ts` | Edit | Add FeedbackType, update CommunityFeedback interface |
| `src/lib/security.ts` | Edit | Add rateLimitByUser() function |
| `docs/admin/supabase-feedback-guide.md` | Create | Step-by-step guide: query unresolved flags, filter by type/brief, mark resolved, view trends |

## Testing

**Unit tests (vitest):**
- API route: auth validation (reject unauthenticated)
- API route: input validation (invalid type, missing briefId, details too long)
- API route: rate limiting per user
- API route: duplicate handling (409 on unique constraint)
- API route: threshold logic (re-verify fires at 2 flags, not at 1)
- API route: re-verification is fire-and-forget (feedback succeeds even if LLM fails)
- API route: details sanitization
- FeedbackSection: renders all 8 states correctly
- rateLimitByUser: window expiry, limit enforcement

**E2E tests (Playwright):**
- Submit "helpful" feedback (signed in) — count updates
- Submit "factual_error" with details (signed in) — confirmation shown
- Redirect to sign-in when not authenticated — return URL preserved
- Duplicate prevention (submit same type twice) — error message shown
- Demo brief — feedback buttons disabled with tooltip

**Accessibility (axe-core):**
- Form labels and ARIA attributes on all interactive elements
- Keyboard navigation through category selection (tab + enter)
- Screen reader announcements for state changes (aria-live region)
- Focus management when form expands/collapses
- Mobile bottom sheet: focus trap, escape to close

## Out of Scope (v1.1)
- Custom admin UI (use Supabase dashboard + guide)
- Reputation system for verifiers (v2.0)
- Automated re-summarization from feedback
- Community translation review pipeline (#28, v2.0)
- Anonymous feedback
