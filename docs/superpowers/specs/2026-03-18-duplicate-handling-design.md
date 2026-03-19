# Duplicate Document Handling -- Design Spec

## Overview

Define how Civic Brief handles duplicate and updated documents across all user types. When a user uploads a PDF that was already processed, redirect them to the existing brief with a civic-themed animation. When the same URL appears with new content, treat it as a document update and link versions.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Same hash, any user | Redirect to existing brief | No wasted API calls. Same behavior for signed-in, anonymous, and demo users. |
| Same content, different URL | Redirect + store alternate URL | Preserves provenance without reprocessing. URL saved in `metadata.alternate_urls`. |
| Same URL, different hash | Process as update, link versions | Different content = new brief. Link via `previous_version_id`. |
| Both new | Full pipeline | Standard processing. |
| Duplicate count | Increment `duplicate_count` on source | Community interest signal. UI surfacing is #33 (v1.2). |
| Redirect UX | 2-second animated transition | Civic-themed icon cycle + progress bar. Not a generic spinner. |
| Redirect method | `router.push()` from `next/navigation` | Smoother than `window.location.href`. No popup blocker issues, no full page reload. |
| Concurrent uploads | Catch unique constraint violation, fall back to duplicate path | TOCTOU race condition handled via Postgres `23505` error code. |
| DB client for writes | Service role (bypasses RLS) | Consistent with existing summarize route pattern. `duplicate_count` increment uses service role. |
| Version history UI | Roadmap #31 (v1.2) | `previous_version_id` column already exists. UI surfaces later. |
| Diff summaries | Roadmap #32 (v2.0) | AI-generated "what changed" between versions. |

## Schema Migration

File: `supabase/migrations/004_duplicate_handling.sql`

```sql
-- Add duplicate upload count to sources (community interest signal)
-- Incremented via service role client only (no RLS update policy needed)
ALTER TABLE sources ADD COLUMN duplicate_count integer NOT NULL DEFAULT 0;

-- Index for URL-based update detection (same URL, different hash)
CREATE INDEX sources_source_url_idx ON sources (source_url);
```

Alternate URLs are stored in the existing `metadata` jsonb column on `sources`:
```json
{
  "alternate_urls": ["https://seattle.gov/alt-path/budget.pdf"]
}
```

No new column needed for alternate URLs. URLs normalized before storage: lowercase hostname, strip trailing slash, remove `www.` prefix.

## API Changes

File: `src/app/api/summarize/route.ts`

### Duplicate Response (same hash)

Current (minimal):
```ts
{ sourceId, briefId, duplicate: true, message }
```

New:
```ts
{
  duplicate: true,
  briefId: "existing-brief-uuid",
  sourceId: "existing-source-uuid",
  message: "This document was already processed.",
  redirectUrl: "/brief/existing-brief-uuid"
}
```

### Duplicate Detection Flow (replaces the `// 3. Check for duplicate` section)

```
1. Compute content hash
2. Query: SELECT id, source_url, metadata FROM sources WHERE content_hash = $hash
3. If match found:
   a. Increment: UPDATE sources SET duplicate_count = duplicate_count + 1 WHERE id = $id
   b. If uploaded URL differs from stored source_url:
      - Normalize URL (lowercase host, strip trailing slash, remove www.)
      - Append to metadata.alternate_urls if not already present
   c. Fetch briefId: SELECT id FROM briefs WHERE source_id = $id AND language_id = 1
   d. Return duplicate redirect response
4. If no hash match, check URL:
   a. Query: SELECT id FROM sources WHERE source_url = $uploadedUrl
   b. If URL match found (same URL, different hash = document update):
      - Process full pipeline (summarize, verify, translate)
      - Fetch old brief: SELECT id FROM briefs WHERE source_id = $oldSourceId AND language_id = 1
      - On brief insert, set previous_version_id to the old brief's id
   c. If no URL match: process as fresh document
5. If sources INSERT throws unique constraint (23505) on content_hash:
   - Another request processed the same document concurrently
   - Fall back to duplicate path (step 3)
```

### Update Response (same URL, different hash)

Standard full response, plus:
```ts
{
  sourceId: "new-source-uuid",
  briefId: "new-brief-uuid",
  brief: { ... },
  verification: { ... },
  translations: [...],
  previousVersionId: "old-brief-uuid"
}
```

## Client UX

File: `src/app/upload/page.tsx`

### Redirect Flow for Duplicates

When `handleResult` receives `{ duplicate: true, redirectUrl }`:

1. Set `duplicateRedirect` state
2. Hide upload form, show redirect animation
3. After 2 seconds, `router.push(redirectUrl)` (using `useRouter` from `next/navigation`)

### Redirect Animation

A centered card matching the site's design language:
- **Cycling civic icons**: scales of justice, government building, scroll, gavel, then a document/redirect arrow icon at the end. Each fades in/out every 400ms with a subtle scale pulse (0.9 -> 1.1 -> 1.0).
- **Headline**: "This document already has a brief." (Fraunces serif)
- **Progress bar**: Civic blue (`var(--civic)`), fills left-to-right over 2 seconds via CSS transition
- **Subtitle**: "Taking you there..." (Outfit, muted)
- **Skip link**: "Go now" in accent color
- **Accessibility**: `aria-live="polite"` region wrapping the animation, descriptive text for screen readers: "Redirecting to existing brief for this document."

No external libraries. Unicode icons + CSS keyframes.

### Render Guards

The render path that displays brief content (`result.brief.headline`, etc.) must guard against the duplicate response which has no `brief` field:

```tsx
{result && !result.duplicate && result.brief && (
  <CivicBrief ... />
)}
```

This prevents crashes if the redirect is delayed (popup blocker, tab backgrounded, CSP restriction).

### State Changes in handleResult

```ts
function handleResult(data: UploadResult) {
  if (data.duplicate && data.redirectUrl) {
    setDuplicateRedirect(data.redirectUrl);
    setTimeout(() => {
      router.push(data.redirectUrl);
    }, 2000);
    return;
  }
  // ... existing logic for fresh results
}
```

## Types

File: `src/lib/types.ts`

Use a discriminated union for type safety:

```ts
export type SummarizeResult =
  | {
      duplicate: true;
      sourceId: string;
      briefId: string | null;
      redirectUrl: string;
      message: string;
    }
  | {
      duplicate?: false;
      sourceId: string | null;
      briefId: string | null;
      brief: {
        headline: string;
        summary: string;
        content: CivicContent;
        confidence_score: number;
        confidence_level: string;
      };
      verification: VerificationResult;
      translations: {
        language: string;
        briefId: string | null;
        headline?: string;
        content?: CivicContent;
      }[];
      previousVersionId?: string;
    };
```

The `UploadResult` type in `upload/page.tsx` should use this union. The discriminant `duplicate: true` gives compile-time safety: accessing `result.brief` is a type error when `result.duplicate === true`.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/004_duplicate_handling.sql` | Create | Add `duplicate_count` column + `source_url` index |
| `src/app/api/summarize/route.ts` | Edit | Enrich duplicate response, increment count, alternate URLs, URL-based update detection, race condition handling |
| `src/app/upload/page.tsx` | Edit | Redirect flow with civic animation, render guards, `router.push` |
| `src/lib/types.ts` | Edit | Discriminated union `SummarizeResult` replacing `SummarizeResponse` |

## Testing

**Unit tests (vitest):**
- Duplicate detection: same hash returns redirect response with `redirectUrl`
- Duplicate count increments on each hit
- Alternate URL stored when source URL differs (normalized)
- Same URL + different hash: `previous_version_id` set on new brief
- Both new: standard processing, no version link
- URL normalization: www removal, trailing slash, case

**Integration tests:**
- POST same document twice: second call returns `{ duplicate: true, redirectUrl }`
- POST same content with different URL: second call returns redirect + URL stored in metadata
- POST same URL with different content: processes as new, links to old brief
- Concurrent duplicate POST: unique constraint caught, falls back to redirect

**E2E tests (Playwright):**
- Upload duplicate: redirect animation appears, civic icons cycle, lands on brief page
- Redirect animation accessible (`aria-live` region, screen reader text)
- "Go now" link works
- Render guard: no crash if redirect is slow

## Out of Scope
- Version history UI (#31, v1.2)
- Diff summaries between versions (#32, v2.0)
- Community interest badges on briefs (#33, v1.2)
- Fuzzy content matching (only exact hash match)
- Distinguishing user vs. automated duplicate counts (#33 note)
