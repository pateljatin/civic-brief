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
| Admin triage | Supabase dashboard | No custom admin UI in v1.1. Admin guide document for manual triage. |
| Naming | Keep `community_feedback` | Name becomes accurate as product grows toward community reviewer model. |
| Tracking | `metadata jsonb` column | Product context only (platform, language viewed, brief version). No PII, no device fingerprinting. Vercel Analytics handles traffic patterns. |

## Schema Migration

File: `supabase/migrations/003_community_feedback_user.sql`

```sql
-- Add user_id to community_feedback (required, ties to auth.users)
ALTER TABLE community_feedback
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id);

-- Add metadata for product context (not PII)
ALTER TABLE community_feedback
  ADD COLUMN metadata jsonb DEFAULT '{}';

-- Index for querying a user's feedback
CREATE INDEX community_feedback_user_id_idx ON community_feedback (user_id);

-- Update RLS: authenticated users can insert (their own), read all
DROP POLICY "Public insert feedback" ON community_feedback;
DROP POLICY "Public read feedback" ON community_feedback;

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
- `user_id` is NOT NULL (enforces auth at DB level)
- Unique index prevents same user flagging same type twice on a brief
- RLS ensures users can only insert rows with their own `user_id`
- Read remains public (feedback counts visible to everyone)

## API Route

File: `src/app/api/feedback/route.ts`

**Endpoint:** `POST /api/feedback`

**Request body:**
```ts
{
  briefId: string;       // UUID of the brief
  feedbackType: FeedbackType;  // one of 6 allowed values
  details?: string;      // optional free text
}
```

**Auth:** Required. Session cookie validated via Supabase server client.

**Rate limit:** 5 requests per minute per user.

**Flow:**
1. Validate auth session (401 if not signed in)
2. Rate limit check per user (429 if exceeded)
3. Validate `briefId` exists in `briefs` table and `is_published = true`
4. Validate `feedbackType` is one of: `factual_error`, `missing_info`, `misleading`, `translation_error`, `outdated`, `helpful`
5. Build metadata: `{ platform: "web", language: <brief's language>, brief_version: <brief's version> }`
6. Insert into `community_feedback` with `user_id` from session
7. If unique constraint violation: return `{ error: "duplicate" }` (409)
8. If `feedbackType` is `factual_error` or `missing_info`:
   - Count total flags of these types on this brief
   - If >= 2: trigger re-verification (call verify logic with source text + flagged details as context)
9. If `feedbackType` is `translation_error`:
   - Count total flags on this brief
   - If >= 2: trigger re-translation with feedback details as context
10. Return `{ success: true, helpfulCount: <updated count> }`

**Error responses:**
- 401: Not authenticated
- 404: Brief not found
- 409: Duplicate feedback
- 422: Invalid feedback type
- 429: Rate limited

## Component

File: `src/components/FeedbackSection.tsx`

**Props:**
```ts
interface FeedbackSectionProps {
  briefId: string;
  helpfulCount: number;     // pre-fetched from DB
  userFeedback?: string;    // user's existing feedback type, if any
}
```

**States:**
1. **Default** — "Helpful" button (green outline) + "Flag an issue" button (muted) + helpful count
2. **Not signed in** — clicking either button redirects to `/auth` with return URL
3. **Helpful submitted** — green confirmation bar, count increments optimistically
4. **Form expanded** — category selection with primary/secondary split, optional textarea, submit, close X
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

**Mobile (<640px):** Expanded form renders as bottom sheet (`position: fixed; bottom: 0`) with backdrop overlay. Same content, different positioning.

## Integration Points

### CivicBrief.tsx
Add `<FeedbackSection>` after the source link footer div, inside the brief card. Pass `briefId`, `helpfulCount`, and `userFeedback` as props.

### Brief page (src/app/brief/[id]/page.tsx)
Fetch from Supabase on page load:
- Count of `helpful` feedback for this brief
- Current user's existing feedback type (if signed in)

Pass both to `CivicBrief` which passes to `FeedbackSection`.

For the demo brief (mock mode), show the feedback UI in a disabled/preview state.

### Types (src/lib/types.ts)
Add:
```ts
type FeedbackType = 'factual_error' | 'missing_info' | 'misleading' | 'translation_error' | 'outdated' | 'helpful';
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/003_community_feedback_user.sql` | Create | Schema migration |
| `src/app/api/feedback/route.ts` | Create | POST handler with auth, validation, triggers |
| `src/components/FeedbackSection.tsx` | Create | Client component, all states |
| `src/components/CivicBrief.tsx` | Edit | Add FeedbackSection to footer |
| `src/app/brief/[id]/page.tsx` | Edit | Fetch feedback data, pass as props |
| `src/lib/types.ts` | Edit | Add FeedbackType |
| `docs/admin/supabase-feedback-guide.md` | Create | Step-by-step admin guide for triaging feedback via Supabase dashboard |

## Testing

**Unit tests (vitest):**
- API route: auth validation, rate limiting, input validation, duplicate handling
- API route: threshold logic (re-verify at 2 flags, re-translate at 2 flags)
- API route: metadata construction
- FeedbackSection: renders all 8 states correctly

**E2E tests (Playwright):**
- Submit "helpful" feedback (signed in)
- Submit "factual_error" with details (signed in)
- Redirect to sign-in when not authenticated
- Duplicate prevention (submit same type twice)
- Helpful count updates after submission

**Accessibility (axe-core):**
- Form labels and ARIA attributes
- Keyboard navigation through category selection
- Screen reader announcements for state changes
- Focus management when form expands/collapses

## Out of Scope (v1.1)
- Custom admin UI (use Supabase dashboard)
- Reputation system for verifiers (v2.0)
- Automated re-summarization from feedback
- Community translation review pipeline (#28, v2.0)
- Anonymous feedback
