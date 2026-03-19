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
| Version history UI | Roadmap #31 (v1.2) | `previous_version_id` column already exists. UI surfaces later. |
| Diff summaries | Roadmap #32 (v2.0) | AI-generated "what changed" between versions. |

## Schema Migration

File: `supabase/migrations/004_duplicate_handling.sql`

```sql
-- Add duplicate upload count to sources (community interest signal)
ALTER TABLE sources ADD COLUMN duplicate_count integer NOT NULL DEFAULT 0;
```

Alternate URLs are stored in the existing `metadata` jsonb column on `sources`:
```json
{
  "alternate_urls": ["https://seattle.gov/alt-path/budget.pdf"]
}
```

No new column needed for alternate URLs. Convention only.

## API Changes

File: `src/app/api/summarize/route.ts`

### Duplicate Response (same hash)

Current (broken):
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

### Duplicate Detection Flow (replaces current lines 116-139)

```
1. Compute content hash
2. Query: SELECT id, source_url, metadata FROM sources WHERE content_hash = $hash
3. If match found:
   a. Increment: UPDATE sources SET duplicate_count = duplicate_count + 1 WHERE id = $id
   b. If uploaded URL differs from stored source_url:
      - Append to metadata.alternate_urls (deduplicated)
   c. Fetch briefId: SELECT id FROM briefs WHERE source_id = $id AND language_id = 1
   d. Return duplicate redirect response
4. If no hash match, check URL:
   a. Query: SELECT id FROM sources WHERE source_url = $uploadedUrl
   b. If URL match found (same URL, different hash = document update):
      - Process full pipeline (summarize, verify, translate)
      - On brief insert, set previous_version_id to the old brief's id
   c. If no URL match: process as fresh document
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
3. After 2 seconds, `window.location.href = redirectUrl`

### Redirect Animation

A centered card matching the site's design language:
- **Cycling civic icons**: scales of justice, government building, scroll, gavel, checkmark. Each fades in/out every 400ms with a subtle scale pulse (0.9 -> 1.1 -> 1.0). Final icon is always the checkmark.
- **Headline**: "This document already has a brief." (Fraunces serif)
- **Progress bar**: Civic blue (`var(--civic)`), fills left-to-right over 2 seconds via CSS transition
- **Subtitle**: "Taking you there..." (Outfit, muted)
- **Skip link**: "Go now" in accent color

No external libraries. Unicode icons + CSS keyframes.

### State Changes in handleResult

```ts
function handleResult(data: UploadResult) {
  if (data.duplicate && data.redirectUrl) {
    setDuplicateRedirect(data.redirectUrl);
    setTimeout(() => {
      window.location.href = data.redirectUrl;
    }, 2000);
    return;
  }
  // ... existing logic for fresh results
}
```

## Types

File: `src/lib/types.ts`

Update `SummarizeResponse` to include duplicate fields:
```ts
export interface SummarizeResponse {
  sourceId: string | null;
  briefId: string | null;
  duplicate?: boolean;
  redirectUrl?: string;
  message?: string;
  previousVersionId?: string;
  brief?: { ... };
  verification?: VerificationResult;
  translations?: { ... }[];
}
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/004_duplicate_handling.sql` | Create | Add `duplicate_count` column |
| `src/app/api/summarize/route.ts` | Edit | Enrich duplicate response, increment count, alternate URLs, URL-based update detection |
| `src/app/upload/page.tsx` | Edit | Redirect flow with civic animation for duplicates |
| `src/lib/types.ts` | Edit | Update SummarizeResponse with duplicate/redirect fields |

## Testing

**Unit tests (vitest):**
- Duplicate detection: same hash returns redirect response
- Duplicate count increments on each hit
- Alternate URL stored when source URL differs
- Same URL + different hash: `previous_version_id` set on new brief
- Both new: standard processing, no version link

**Integration tests:**
- POST same document twice: second call returns `{ duplicate: true, redirectUrl }`
- POST same content with different URL: second call returns redirect + URL stored in metadata
- POST same URL with different content: processes as new, links to old brief

**E2E tests (Playwright):**
- Upload duplicate: redirect animation appears, civic icons cycle, lands on brief page
- Redirect animation accessible (aria-live, meaningful alt text)
- "Go now" link works

## Out of Scope
- Version history UI (#31, v1.2)
- Diff summaries between versions (#32, v2.0)
- Community interest badges on briefs (#33, v1.2)
- Fuzzy content matching (only exact hash match)
