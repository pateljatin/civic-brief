# Supabase Feedback Triage Guide

Step-by-step guide for reviewing and resolving community feedback on civic briefs using the Supabase dashboard.

## Accessing the Dashboard

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select the **civic-brief** project
3. Click **Table Editor** in the left sidebar
4. Select the **community_feedback** table

## Viewing Unresolved Feedback

### All unresolved flags (excludes "helpful")

1. In Table Editor, click **community_feedback**
2. Click **Filter** (top bar)
3. Add filter: `feedback_type` **is not** `helpful`
4. Add filter: `resolved_at` **is** `NULL`
5. Click **Apply**

You will see all unresolved error reports, sorted by `created_at` (newest first by default).

### Filter by feedback type

To see only factual errors:
1. Click **Filter**
2. Add filter: `feedback_type` **is** `factual_error`
3. Add filter: `resolved_at` **is** `NULL`
4. Click **Apply**

Replace `factual_error` with any of: `missing_info`, `misleading`, `translation_error`, `outdated`.

### Filter by specific brief

1. Copy the brief's UUID from the brief page URL (`/brief/<uuid>`)
2. Click **Filter**
3. Add filter: `brief_id` **is** `<paste UUID>`
4. Click **Apply**

## Resolving Feedback

When you have reviewed a flag and taken action (or determined no action is needed):

1. Click the row to edit it
2. Set `resolution` to a short description of what you did:
   - `"Verified correct, no change needed"`
   - `"Updated property tax figure from 8.2% to 8.4%"`
   - `"Re-ran translation with improved context"`
   - `"Dismissed: subjective concern, summary is factually accurate"`
3. Set `resolved_at` to the current timestamp:
   - Click the field, select **now()** or paste: `2026-03-17T00:00:00Z` (use current date)
4. Click **Save**

## Checking Feedback Trends

### Count by type (SQL Editor)

Go to **SQL Editor** in the sidebar and run:

```sql
SELECT
  feedback_type,
  count(*) as total,
  count(*) FILTER (WHERE resolved_at IS NULL) as unresolved
FROM community_feedback
WHERE feedback_type != 'helpful'
GROUP BY feedback_type
ORDER BY unresolved DESC;
```

### Briefs with most flags

```sql
SELECT
  cf.brief_id,
  b.headline,
  count(*) as flag_count,
  array_agg(DISTINCT cf.feedback_type) as types
FROM community_feedback cf
JOIN briefs b ON b.id = cf.brief_id
WHERE cf.feedback_type != 'helpful'
  AND cf.resolved_at IS NULL
GROUP BY cf.brief_id, b.headline
ORDER BY flag_count DESC
LIMIT 20;
```

### Helpful count per brief

```sql
SELECT
  cf.brief_id,
  b.headline,
  count(*) as helpful_count
FROM community_feedback cf
JOIN briefs b ON b.id = cf.brief_id
WHERE cf.feedback_type = 'helpful'
GROUP BY cf.brief_id, b.headline
ORDER BY helpful_count DESC
LIMIT 20;
```

## Re-verification Status

When 2+ `factual_error` or `missing_info` flags accumulate on a brief, re-verification is triggered automatically. Check the server logs (Vercel > Deployments > Functions) for:

```
Re-verification triggered for brief <uuid> (N flags)
```

To manually re-verify a brief, use the `/api/verify` endpoint:

```bash
curl -X POST https://civic-brief.vercel.app/api/verify \
  -H "Content-Type: application/json" \
  -d '{"briefId": "<uuid>"}'
```

## Daily Routine

1. Check unresolved flags (filter: `resolved_at IS NULL`, `feedback_type != helpful`)
2. Prioritize `factual_error` flags (these indicate incorrect civic information)
3. Review `translation_error` flags (these affect multilingual access)
4. Resolve or dismiss each flag with a clear resolution note
5. Run the "briefs with most flags" query to spot patterns
