# C19 Retro: Human Feedback Loop Closure

**Date:** 2026-05-31
**PR:** #72 (merged c0acc75)
**Branch:** feature/c19-feedback-loop

---

## What We Built

When 2+ community members flag a civic brief as factually wrong (`factual_error` or `missing_info`), the system now automatically re-fetches the source PDF, re-runs the Claude factuality judge with the human flag context injected, and degrades the source score if warranted. Score changes are trust-degrades-only.

New files: `src/lib/reverify.ts`, `supabase/migrations/012_community_feedback_reverification_type.sql`, `docs/eval-strategy.md`

---

## What Went Well

- **Security review caught a real bug:** The DB CHECK constraint on `community_feedback.feedback_type` didn't include `'reverification'`, so the dedup marker row insert was always silently failing. Without the security review, this would have shipped with a broken once-only guard.
- **Code review caught real bugs:** The `isValidUUID` dead code guard (CLAUDE.md violation) and the `>= REVERIFY_THRESHOLD` re-trigger bug (every flag past 2 fires Claude again) were both caught before merge.
- **Five parallel review agents** surfaced issues the main context wouldn't have. Three of the five found real issues.
- **SSRF redirect protection held up:** The 5-hop per-redirect SSRF re-validation was flagged as "scope creep" by one reviewer but confirmed as a necessary security hardening by the security reviewer. The redirect loop was the right call.
- **Trust-degrades-only invariant correctly implemented** — confirmed clean by code comment compliance review.

## What Broke

- **Dedup guard was dead from day 1:** `'reverification'` wasn't in the DB CHECK constraint, so every fire-and-forget insert failed silently. The idempotency marker never landed. This was a compound failure: the type existed in `FEEDBACK_TYPES` (app layer) but not in the Postgres constraint (DB layer).
- **`'reverification'` in user-submittable allowlist:** An authenticated user could POST `feedbackType: 'reverification'` directly. Combined with the above, fixing #1 without #2 would have enabled users to permanently suppress re-verification for any brief by planting a fake marker row.

## Key Technical Decisions

- **Separate `UserFeedbackType` from `FeedbackType`:** The right long-term split. Route validation uses `USER_FEEDBACK_TYPES` (6 types), `FeedbackType` covers both user and system types. The DB constraint covers both.
- **Await the marker insert:** Changed from fire-and-forget to awaited for the reverification audit row so constraint violations surface immediately rather than being swallowed.
- **Re-fetch source URL in `reverify.ts`** (not store document): Consistent with the privacy posture — never store government documents, always re-fetch from the source.

## Engineering Lessons

1. **DB and app layer must stay in sync.** When you add a new enum value to a TypeScript union, also check the Postgres CHECK constraint. They're separate contracts.
2. **Type splitting for user vs system inputs is worth the extra lines.** A single `FEEDBACK_TYPES` constant serving both user validation and internal writes creates a supply-chain problem: any value added for internal use automatically becomes user-submittable.
3. **Security review is not just for auth and crypto.** The `reverification` type issue was a cost-amplification vector and a suppression attack surface — neither obvious without dedicated threat modeling.

## What We'd Do Differently

- Add a `system_feedback_types` column or a separate `reverification_log` table instead of overloading `community_feedback` with a mixed user/system type. The current approach works but is fragile.
- The spec should include a DB/app type sync checklist item whenever new `feedback_type` values are introduced.
