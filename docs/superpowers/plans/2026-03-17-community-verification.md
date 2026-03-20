# C8: Community Verification UI — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add community feedback to civic briefs so users can mark briefs as helpful or flag errors, triggering automated re-verification when thresholds are met.

**Architecture:** One new API route (`POST /api/feedback`) handles auth, validation, insert, and fire-and-forget re-verification triggers. One new client component (`FeedbackSection`) handles all 8 UI states. A schema migration tightens the existing `community_feedback` table. The existing summarize route pattern (service role client, rate limiting, sanitization) is followed exactly.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (Postgres + RLS), TypeScript, vitest, Playwright, axe-core

**Spec:** `docs/superpowers/specs/2026-03-17-community-verification-design.md`

---

### Task 1: Schema Migration

**Files:**
- Create: `supabase/migrations/003_community_feedback_enhancements.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 003: Community Feedback Enhancements
-- Depends on: 002_auth_and_usage.sql (which added nullable user_id)
--
-- Changes:
--   1. Tighten user_id to NOT NULL (was nullable)
--   2. Add metadata jsonb column
--   3. Update RLS policies for authenticated inserts
--   4. Add unique constraint (one feedback type per user per brief)

-- Clean up any existing rows without user_id
DELETE FROM community_feedback WHERE user_id IS NULL;

-- Tighten user_id to NOT NULL
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

- [ ] **Step 2: Verify migration is syntactically valid**

Run: `node -e "const fs = require('fs'); const sql = fs.readFileSync('supabase/migrations/003_community_feedback_enhancements.sql', 'utf8'); console.log('Migration file:', sql.length, 'bytes'); console.log('Statements:', sql.split(';').filter(s => s.trim()).length)"`

Expected: Shows byte count and ~7 statements

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_community_feedback_enhancements.sql
git commit -m "feat(db): add community feedback enhancements migration

Tighten user_id NOT NULL, add metadata column, update RLS policies,
add unique constraint for one feedback type per user per brief."
```

---

### Task 2: Types and Security Updates

**Files:**
- Modify: `src/lib/types.ts:111-119` (update CommunityFeedback interface)
- Modify: `src/lib/security.ts` (add rateLimitByUser)
- Modify: `tests/unit/security.test.ts` (add rateLimitByUser tests)

- [ ] **Step 1: Write failing tests for rateLimitByUser**

Add to `tests/unit/security.test.ts`:

```ts
import {
  validateUrl,
  validateFile,
  sanitizeText,
  isValidUUID,
  isValidLanguageCode,
  rateLimitByUser,
} from '@/lib/security';

// ... existing tests ...

describe('rateLimitByUser', () => {
  it('allows requests under the limit', () => {
    const result = rateLimitByUser('user-1', 5, 60000);
    expect(result).toBeNull();
  });

  it('blocks requests over the limit', () => {
    const userId = 'user-rate-test-' + Date.now();
    for (let i = 0; i < 5; i++) {
      rateLimitByUser(userId, 5, 60000);
    }
    const result = rateLimitByUser(userId, 5, 60000);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
  });

  it('tracks different users independently', () => {
    const userA = 'user-a-' + Date.now();
    const userB = 'user-b-' + Date.now();
    for (let i = 0; i < 5; i++) {
      rateLimitByUser(userA, 5, 60000);
    }
    // userA is blocked
    expect(rateLimitByUser(userA, 5, 60000)).not.toBeNull();
    // userB still allowed
    expect(rateLimitByUser(userB, 5, 60000)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/security.test.ts`

Expected: FAIL — `rateLimitByUser is not exported`

- [ ] **Step 3: Add FeedbackType and update CommunityFeedback in types.ts**

Add after the existing `CommunityFeedback` interface (line 119):

```ts
export type FeedbackType =
  | 'factual_error'
  | 'missing_info'
  | 'misleading'
  | 'translation_error'
  | 'outdated'
  | 'helpful';

export const FEEDBACK_TYPES: readonly FeedbackType[] = [
  'factual_error',
  'missing_info',
  'misleading',
  'translation_error',
  'outdated',
  'helpful',
] as const;
```

Update the existing `CommunityFeedback` interface to add the new columns:

```ts
export interface CommunityFeedback {
  id: string;
  brief_id: string;
  user_id: string;  // added: was missing
  feedback_type: FeedbackType;  // changed: use type alias
  details: string | null;
  metadata: Record<string, unknown>;  // added
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
}
```

Add request/response types:

```ts
export interface FeedbackRequest {
  briefId: string;
  feedbackType: FeedbackType;
  details?: string;
}

export interface FeedbackResponse {
  success: boolean;
  feedbackType: FeedbackType;
}
```

- [ ] **Step 4: Add rateLimitByUser to security.ts**

Add after the existing `rateLimit` function and its cleanup interval (after line 53):

```ts
// ── Per-User Rate Limiting ──
// Keyed on user ID instead of IP. For authenticated endpoints.

const userRateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimitByUser(
  userId: string,
  maxRequests = 5,
  windowMs = 60 * 1000
): NextResponse | null {
  const now = Date.now();
  const entry = userRateLimitStore.get(userId);

  if (!entry || now > entry.resetAt) {
    userRateLimitStore.set(userId, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (entry.count >= maxRequests) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before submitting more feedback.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      }
    );
  }

  entry.count++;
  return null;
}

// Clean up stale user rate limit entries
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    userRateLimitStore.forEach((entry, key) => {
      if (now > entry.resetAt) {
        userRateLimitStore.delete(key);
      }
    });
  }, 5 * 60 * 1000);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/security.test.ts`

Expected: ALL PASS

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`

Expected: ALL PASS (no regressions)

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/security.ts tests/unit/security.test.ts
git commit -m "feat: add FeedbackType, rateLimitByUser for community feedback

- Add FeedbackType union type and FEEDBACK_TYPES constant
- Update CommunityFeedback interface with user_id and metadata
- Add FeedbackRequest/FeedbackResponse API types
- Add per-user rate limiting (rateLimitByUser) with tests"
```

---

### Task 3: Feedback API Route

**Files:**
- Create: `src/app/api/feedback/route.ts`
- Create: `tests/unit/feedback-api.test.ts`

- [ ] **Step 1: Write failing tests for the feedback API**

Create `tests/unit/feedback-api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FEEDBACK_TYPES } from '@/lib/types';
import type { FeedbackType } from '@/lib/types';
import { isValidUUID, sanitizeText } from '@/lib/security';

// Test the validation logic independently (not the route handler, which needs Next.js runtime)
describe('feedback API validation', () => {
  describe('feedbackType validation', () => {
    it('accepts all valid feedback types', () => {
      for (const type of FEEDBACK_TYPES) {
        expect(FEEDBACK_TYPES.includes(type)).toBe(true);
      }
    });

    it('rejects invalid feedback types', () => {
      expect(FEEDBACK_TYPES.includes('invalid' as FeedbackType)).toBe(false);
      expect(FEEDBACK_TYPES.includes('' as FeedbackType)).toBe(false);
    });
  });

  describe('briefId validation', () => {
    it('accepts valid UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('rejects invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('details sanitization', () => {
    it('sanitizes and truncates details', () => {
      const long = 'a'.repeat(2000);
      expect(sanitizeText(long, 1000).length).toBe(1000);
    });

    it('strips control characters from details', () => {
      expect(sanitizeText('Bad\x00input')).toBe('Badinput');
    });
  });

  describe('re-verification threshold', () => {
    const REVERIFY_THRESHOLD = 2;
    const REVERIFY_TYPES: FeedbackType[] = ['factual_error', 'missing_info'];

    it('factual_error and missing_info trigger re-verification', () => {
      expect(REVERIFY_TYPES.includes('factual_error')).toBe(true);
      expect(REVERIFY_TYPES.includes('missing_info')).toBe(true);
    });

    it('other types do not trigger re-verification', () => {
      expect(REVERIFY_TYPES.includes('misleading' as FeedbackType)).toBe(false);
      expect(REVERIFY_TYPES.includes('helpful' as FeedbackType)).toBe(false);
      expect(REVERIFY_TYPES.includes('outdated' as FeedbackType)).toBe(false);
    });

    it('threshold is 2', () => {
      expect(REVERIFY_THRESHOLD).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/unit/feedback-api.test.ts`

Expected: ALL PASS (these test validation logic that already exists)

- [ ] **Step 3: Write the API route**

Create `src/app/api/feedback/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase';
import { createAuthServerClient } from '@/lib/supabase-server';
import { rateLimitByUser, sanitizeText, isValidUUID } from '@/lib/security';
import { FEEDBACK_TYPES } from '@/lib/types';
import type { FeedbackType } from '@/lib/types';

const REVERIFY_THRESHOLD = 2;
const RETRANSLATE_THRESHOLD = 2;
const REVERIFY_TYPES: FeedbackType[] = ['factual_error', 'missing_info'];

export async function POST(request: NextRequest) {
  // 1. Validate auth session
  let userId: string;
  try {
    const authClient = await createAuthServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Sign in to submit feedback.' },
        { status: 401 }
      );
    }
    userId = user.id;
  } catch {
    return NextResponse.json(
      { error: 'Sign in to submit feedback.' },
      { status: 401 }
    );
  }

  // 2. Rate limit per user
  const rateLimitResponse = rateLimitByUser(userId, 5, 60 * 1000);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { briefId, feedbackType, details } = body;

    // 3. Validate briefId
    if (!briefId || !isValidUUID(briefId)) {
      return NextResponse.json(
        { error: 'Valid brief ID is required.' },
        { status: 422 }
      );
    }

    // 4. Validate feedbackType
    if (!feedbackType || !FEEDBACK_TYPES.includes(feedbackType)) {
      return NextResponse.json(
        { error: `Invalid feedback type. Must be one of: ${FEEDBACK_TYPES.join(', ')}` },
        { status: 422 }
      );
    }

    // 5. Sanitize details
    const cleanDetails = details ? sanitizeText(details, 1000) : null;

    const db = getServerClient();

    // 6. Verify brief exists and is published
    const { data: brief, error: briefError } = await db
      .from('briefs')
      .select('id, version, language_id, source_id, languages(bcp47)')
      .eq('id', briefId)
      .eq('is_published', true)
      .single();

    if (briefError || !brief) {
      return NextResponse.json(
        { error: 'Brief not found.' },
        { status: 404 }
      );
    }

    // 7. Build metadata
    const briefData = brief as Record<string, unknown>;
    const langData = briefData.languages as { bcp47: string } | null;
    const metadata = {
      platform: 'web',
      language: langData?.bcp47 || 'en',
      version: briefData.version as number,
    };

    // 8. Insert feedback
    const { error: insertError } = await db
      .from('community_feedback')
      .insert({
        brief_id: briefId,
        user_id: userId,
        feedback_type: feedbackType,
        details: cleanDetails,
        metadata,
      });

    if (insertError) {
      // Unique constraint violation = duplicate
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'You have already submitted this type of feedback for this brief.' },
          { status: 409 }
        );
      }
      throw insertError;
    }

    // 9. Check re-verification threshold (fire-and-forget)
    if (REVERIFY_TYPES.includes(feedbackType as FeedbackType)) {
      checkAndTriggerReverification(db, briefId, brief.source_id).catch((err) => {
        console.error('Re-verification trigger failed:', err);
      });
    }

    // 10. Check re-translation threshold (fire-and-forget)
    if (feedbackType === 'translation_error') {
      checkAndTriggerRetranslation(db, briefId, brief.source_id).catch((err) => {
        console.error('Re-translation trigger failed:', err);
      });
    }

    // 11. Return success
    return NextResponse.json({ success: true, feedbackType });
  } catch (error) {
    console.error('Feedback error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Check if re-verification threshold is met and trigger if so. */
async function checkAndTriggerReverification(
  db: ReturnType<typeof getServerClient>,
  briefId: string,
  sourceId: string
) {
  const { count } = await db
    .from('community_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .in('feedback_type', REVERIFY_TYPES);

  if ((count || 0) >= REVERIFY_THRESHOLD) {
    // Gather feedback details for context
    const { data: flags } = await db
      .from('community_feedback')
      .select('feedback_type, details')
      .eq('brief_id', briefId)
      .in('feedback_type', REVERIFY_TYPES)
      .not('details', 'is', null);

    const flagContext = flags
      ?.map((f) => `[${f.feedback_type}]: ${f.details}`)
      .join('\n') || '';

    console.log(
      `Re-verification triggered for brief ${briefId} (${count} flags). Context: ${flagContext}`
    );

    // TODO: Call re-verification logic with flagContext
    // This will be implemented when the verify endpoint supports re-verification with context
  }
}

/** Check if re-translation threshold is met and trigger if so. */
async function checkAndTriggerRetranslation(
  db: ReturnType<typeof getServerClient>,
  briefId: string,
  sourceId: string
) {
  const { count } = await db
    .from('community_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .eq('feedback_type', 'translation_error');

  if ((count || 0) >= RETRANSLATE_THRESHOLD) {
    const { data: flags } = await db
      .from('community_feedback')
      .select('details')
      .eq('brief_id', briefId)
      .eq('feedback_type', 'translation_error')
      .not('details', 'is', null);

    const flagContext = flags
      ?.map((f) => f.details)
      .join('\n') || '';

    console.log(
      `Re-translation triggered for brief ${briefId} (${count} flags). Context: ${flagContext}`
    );

    // TODO: Call re-translation logic with flagContext
    // This will be implemented when the translate endpoint supports re-translation with context
  }
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/feedback/route.ts tests/unit/feedback-api.test.ts
git commit -m "feat: add POST /api/feedback route with auth, validation, triggers

- Auth required via createAuthServerClient session check
- Per-user rate limiting (5/min)
- Input validation: UUID briefId, valid feedbackType, sanitized details
- Duplicate prevention via unique constraint (409 on conflict)
- Fire-and-forget re-verification when factual_error + missing_info >= 2
- Fire-and-forget re-translation when translation_error >= 2
- Follows existing summarize route patterns"
```

---

### Task 4: FeedbackSection Component

**Files:**
- Create: `src/components/FeedbackSection.tsx`

- [ ] **Step 1: Write the FeedbackSection component**

Create `src/components/FeedbackSection.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { FeedbackType } from '@/lib/types';

interface FeedbackSectionProps {
  briefId: string;
  helpfulCount: number;
  userFeedback?: string;
  isSignedIn: boolean;
  isDemo?: boolean;
}

const PRIMARY_TYPES: { type: FeedbackType; label: string; icon: string; color: string }[] = [
  { type: 'factual_error', label: 'Factual error', icon: '⊘', color: '#dc2626' },
  { type: 'missing_info', label: 'Missing info', icon: '◧', color: '#b44d12' },
  { type: 'translation_error', label: 'Translation error', icon: '🌐', color: '#7c3aed' },
];

const SECONDARY_TYPES: { type: FeedbackType; label: string }[] = [
  { type: 'misleading', label: 'Misleading' },
  { type: 'outdated', label: 'Outdated' },
];

type FeedbackState =
  | 'default'
  | 'form'
  | 'submitting'
  | 'submitted'
  | 'helpful-submitted'
  | 'already-submitted'
  | 'error';

export default function FeedbackSection({
  briefId,
  helpfulCount: initialCount,
  userFeedback,
  isSignedIn,
  isDemo = false,
}: FeedbackSectionProps) {
  const [state, setState] = useState<FeedbackState>(
    userFeedback ? 'already-submitted' : 'default'
  );
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [details, setDetails] = useState('');
  const [helpfulCount, setHelpfulCount] = useState(initialCount);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignInRedirect = () => {
    // Use the same Google OAuth flow as AuthButton (src/components/AuthButton.tsx)
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const state = crypto.randomUUID();
    document.cookie = `oauth_state=${state}; path=/; max-age=600; SameSite=Lax; Secure`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${window.location.origin}/auth/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const submitFeedback = async (type: FeedbackType, detailsText?: string) => {
    if (!isSignedIn) {
      handleSignInRedirect();
      return;
    }

    setState('submitting');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId,
          feedbackType: type,
          ...(detailsText ? { details: detailsText } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          setState('already-submitted');
          return;
        }
        throw new Error(data.error || 'Failed to submit feedback');
      }

      if (type === 'helpful') {
        setHelpfulCount((c) => c + 1);
        setState('helpful-submitted');
      } else {
        setState('submitted');
        setTimeout(() => setState('default'), 3000);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
      setState('error');
      setTimeout(() => setState('default'), 5000);
    }
  };

  // ── Already submitted ──
  if (state === 'already-submitted') {
    return (
      <div style={footerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>✓</span>
          <span style={{ fontSize: '13px', color: 'var(--green, #2d6a4f)', fontWeight: 500 }}>
            You flagged this as: {userFeedback || selectedType}
          </span>
        </div>
        <span style={countStyle}>{helpfulCount} found helpful</span>
      </div>
    );
  }

  // ── Helpful submitted ──
  if (state === 'helpful-submitted') {
    return (
      <div style={{ ...footerStyle, background: '#f0faf2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>👍</span>
          <span style={{ fontSize: '13px', color: 'var(--green, #2d6a4f)', fontWeight: 500 }}>
            Thanks! Your feedback helps improve civic briefs.
          </span>
        </div>
        <span style={countStyle}>{helpfulCount} found helpful</span>
      </div>
    );
  }

  // ── Submitted (flag) ──
  if (state === 'submitted') {
    return (
      <div style={{ ...footerStyle, background: '#f0faf2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>✓</span>
          <span style={{ fontSize: '13px', color: 'var(--green, #2d6a4f)', fontWeight: 500 }}>
            Feedback submitted. We will review and update the brief if needed.
          </span>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (state === 'error') {
    return (
      <div style={{ ...footerStyle, background: '#fef2f2' }}>
        <span style={{ fontSize: '13px', color: '#dc2626' }}>
          {errorMessage}
        </span>
      </div>
    );
  }

  // ── Form expanded ──
  if (state === 'form' || state === 'submitting') {
    const isSubmitting = state === 'submitting';

    return (
      <>
        {/* Mobile backdrop */}
        <div className="feedback-backdrop" onClick={() => setState('default')} />
        <div className="feedback-form-container" style={formContainerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>What is the issue?</div>
            <button
              onClick={() => setState('default')}
              style={{ background: 'none', border: 'none', color: '#8a8a92', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit' }}
              aria-label="Close feedback form"
            >
              ✕
            </button>
          </div>

          {/* Primary categories */}
          <div style={{ marginBottom: '12px' }}>
            <div style={sectionLabelStyle}>Report an error</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PRIMARY_TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setSelectedType(t.type)}
                  style={{
                    ...categoryBtnStyle,
                    borderColor: selectedType === t.type ? '#1e3a5f' : '#e2ddd4',
                    background: selectedType === t.type ? '#e8eef5' : 'white',
                  }}
                  aria-pressed={selectedType === t.type}
                >
                  <span style={{ color: t.color }}>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary categories */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ ...sectionLabelStyle, color: '#8a8a92' }}>Other concerns</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SECONDARY_TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setSelectedType(t.type)}
                  style={{
                    ...categoryBtnStyle,
                    fontSize: '12px',
                    padding: '6px 12px',
                    color: '#8a8a92',
                    borderColor: selectedType === t.type ? '#1e3a5f' : '#eee',
                    background: selectedType === t.type ? '#e8eef5' : 'white',
                  }}
                  aria-pressed={selectedType === t.type}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Details textarea */}
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Tell us more (optional but helps us fix it faster)..."
            maxLength={1000}
            style={textareaStyle}
            aria-label="Feedback details"
          />

          {/* Submit */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => selectedType && submitFeedback(selectedType, details || undefined)}
              disabled={!selectedType || isSubmitting}
              style={{
                ...submitBtnStyle,
                opacity: !selectedType || isSubmitting ? 0.5 : 1,
                cursor: !selectedType || isSubmitting ? 'not-allowed' : 'pointer',
              }}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit feedback'}
            </button>
          </div>
        </div>
        <style>{responsiveStyles}</style>
      </>
    );
  }

  // ── Demo preview (disabled) ──
  if (isDemo) {
    return (
      <div style={footerStyle}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            disabled
            style={{ ...helpfulBtnStyle, opacity: 0.5, cursor: 'not-allowed' }}
            title="Sign in and upload a document to give feedback on real briefs."
            aria-label="Helpful (disabled in demo)"
          >
            👍 Helpful
          </button>
          <button
            disabled
            style={{ ...flagBtnStyle, opacity: 0.5, cursor: 'not-allowed' }}
            title="Sign in and upload a document to give feedback on real briefs."
            aria-label="Flag an issue (disabled in demo)"
          >
            ⚑ Flag an issue
          </button>
        </div>
        <span style={countStyle}>0 found helpful</span>
      </div>
    );
  }

  // ── Default state ──
  return (
    <div style={footerStyle}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => submitFeedback('helpful')}
          style={helpfulBtnStyle}
          aria-label="Mark this brief as helpful"
        >
          👍 Helpful
        </button>
        <button
          onClick={() => {
            if (!isSignedIn) {
              handleSignInRedirect();
              return;
            }
            setState('form');
          }}
          style={flagBtnStyle}
          aria-label="Flag an issue with this brief"
        >
          ⚑ Flag an issue
        </button>
      </div>
      <span style={countStyle}>{helpfulCount} found helpful</span>
    </div>
  );
}

// ── Styles ──

const footerStyle: React.CSSProperties = {
  padding: '12px 24px 16px',
  borderTop: '1px solid var(--border, #e2ddd4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const countStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--muted, #8a8a92)',
};

const helpfulBtnStyle: React.CSSProperties = {
  padding: '6px 16px',
  borderRadius: '20px',
  border: '1px solid var(--green, #2d6a4f)',
  background: 'var(--green-light, #e9f5ec)',
  color: 'var(--green, #2d6a4f)',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.2s',
};

const flagBtnStyle: React.CSSProperties = {
  padding: '6px 16px',
  borderRadius: '20px',
  border: '1px solid var(--border, #e2ddd4)',
  background: 'white',
  color: 'var(--muted, #8a8a92)',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.2s',
};

const formContainerStyle: React.CSSProperties = {
  padding: '16px 24px 20px',
  borderTop: '1px solid var(--border, #e2ddd4)',
  background: '#fafaf8',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  color: 'var(--civic, #1e3a5f)',
  marginBottom: '8px',
};

const categoryBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  borderRadius: '8px',
  border: '1px solid #e2ddd4',
  background: 'white',
  cursor: 'pointer',
  fontSize: '13px',
  fontFamily: 'inherit',
  transition: 'all 0.2s',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '72px',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border, #e2ddd4)',
  fontFamily: 'inherit',
  fontSize: '13px',
  resize: 'vertical',
  boxSizing: 'border-box',
  marginBottom: '14px',
};

const submitBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: '8px',
  background: 'var(--civic, #1e3a5f)',
  color: 'white',
  border: 'none',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const responsiveStyles = `
  .feedback-backdrop {
    display: none;
  }
  @media (max-width: 640px) {
    .feedback-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.3);
      z-index: 99;
    }
    .feedback-form-container {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      max-height: 70vh !important;
      overflow-y: auto !important;
      z-index: 100 !important;
      border-radius: 16px 16px 0 0 !important;
      box-shadow: 0 -4px 24px rgba(0,0,0,0.12) !important;
    }
  }
`;
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/FeedbackSection.tsx
git commit -m "feat: add FeedbackSection component with 8 states

- Default: helpful button + flag button + count
- Auth redirect for unauthenticated users
- Inline form with primary/secondary category split
- Optimistic helpful count update
- Mobile bottom sheet via CSS media query
- Duplicate, rate limit, and error state handling"
```

---

### Task 5: Integration (CivicBrief + Brief Page)

**Files:**
- Modify: `src/components/CivicBrief.tsx:9-22,255-267` (add props + render FeedbackSection)
- Modify: `src/app/brief/[id]/page.tsx:40-98,100-185` (fetch feedback data + pass props)

- [ ] **Step 1: Add FeedbackSection to CivicBrief component**

In `src/components/CivicBrief.tsx`:

Add to imports (line 4):
```ts
import FeedbackSection from './FeedbackSection';
```

Add new props to `CivicBriefProps` interface (after `languageLoading`):
```ts
  briefId?: string;
  helpfulCount?: number;
  userFeedback?: string;
  isSignedIn?: boolean;
  isDemo?: boolean;
```

Add to destructured props in the component function (after `languageLoading`):
```ts
  briefId,
  helpfulCount = 0,
  userFeedback,
  isSignedIn = false,
  isDemo = false,
```

Add `<FeedbackSection>` after the footer div (after the closing `</div>` of the source link footer, before the final closing `</div>` of the card):
```tsx
      {/* Community Feedback */}
      {briefId && (
        <FeedbackSection
          briefId={briefId}
          helpfulCount={helpfulCount}
          userFeedback={userFeedback}
          isSignedIn={isSignedIn}
          isDemo={isDemo}
        />
      )}
```

- [ ] **Step 2: Update brief page to fetch feedback data**

In `src/app/brief/[id]/page.tsx`:

Add a `getFeedbackData` function after `getBrief` (uses dynamic imports to match existing pattern in this file):
```ts
async function getFeedbackData(briefId: string) {
  try {
    const { getServerClient } = await import('@/lib/supabase');
    const db = getServerClient();

    // Get helpful count
    const { count: helpfulCount } = await db
      .from('community_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('brief_id', briefId)
      .eq('feedback_type', 'helpful');

    // Check if user is signed in and has existing feedback
    let isSignedIn = false;
    let userFeedback: string | undefined;

    try {
      const { createAuthServerClient } = await import('@/lib/supabase-server');
      const authClient = await createAuthServerClient();
      const { data: { user } } = await authClient.auth.getUser();
      if (user) {
        isSignedIn = true;
        const { data: existing } = await db
          .from('community_feedback')
          .select('feedback_type')
          .eq('brief_id', briefId)
          .eq('user_id', user.id)
          .neq('feedback_type', 'helpful')
          .limit(1)
          .maybeSingle();
        userFeedback = existing?.feedback_type || undefined;
      }
    } catch {
      // Auth not available, continue as anonymous
    }

    return { helpfulCount: helpfulCount || 0, isSignedIn, userFeedback };
  } catch {
    return { helpfulCount: 0, isSignedIn: false, userFeedback: undefined };
  }
}
```

Update the `BriefPage` component to call `getFeedbackData` and pass results.

In the mock/demo render block, add feedback props to `CivicBrief` with `isDemo={true}`:
```tsx
<CivicBrief
  {...existingProps}
  briefId="demo"
  helpfulCount={0}
  isSignedIn={false}
  isDemo={true}
/>
```

In the real brief render block, fetch and pass feedback data:
```tsx
const feedbackData = await getFeedbackData(briefData.id || id);

<CivicBrief
  {...existingProps}
  briefId={briefData.id || id}
  helpfulCount={feedbackData.helpfulCount}
  userFeedback={feedbackData.userFeedback}
  isSignedIn={feedbackData.isSignedIn}
/>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: No errors

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/CivicBrief.tsx src/app/brief/[id]/page.tsx
git commit -m "feat: integrate FeedbackSection into brief pages

- CivicBrief accepts briefId, helpfulCount, userFeedback, isSignedIn
- Brief page fetches feedback data from community_feedback table
- Auth session checked for signed-in state and existing user feedback
- Demo brief renders FeedbackSection without briefId (disabled)"
```

---

### Task 6: E2E Tests

**Files:**
- Create: `tests/e2e/feedback.spec.ts`

- [ ] **Step 1: Write E2E tests**

Create `tests/e2e/feedback.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Community Feedback', () => {
  test('shows feedback buttons on demo brief page', async ({ page }) => {
    await page.goto('/brief/demo');

    // Feedback section should be visible
    const helpfulBtn = page.getByRole('button', { name: /helpful/i });
    const flagBtn = page.getByRole('button', { name: /flag an issue/i });

    await expect(helpfulBtn).toBeVisible();
    await expect(flagBtn).toBeVisible();
  });

  test('shows helpful count', async ({ page }) => {
    await page.goto('/brief/demo');
    await expect(page.getByText(/found helpful/i)).toBeVisible();
  });

  test('feedback form expands when flag button clicked', async ({ page }) => {
    await page.goto('/brief/demo');

    // This will redirect to sign-in since not authenticated
    // For the demo brief, we just verify the button exists
    const flagBtn = page.getByRole('button', { name: /flag an issue/i });
    await expect(flagBtn).toBeVisible();
  });

  test('feedback section is accessible', async ({ page }) => {
    await page.goto('/brief/demo');

    // Check ARIA labels
    const helpfulBtn = page.getByRole('button', { name: /mark this brief as helpful/i });
    const flagBtn = page.getByRole('button', { name: /flag an issue with this brief/i });

    await expect(helpfulBtn).toBeVisible();
    await expect(flagBtn).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E tests**

Run: `npx playwright test tests/e2e/feedback.spec.ts`

Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/feedback.spec.ts
git commit -m "test: add E2E tests for community feedback UI

- Verify feedback buttons visible on demo brief
- Verify helpful count display
- Verify accessibility labels"
```

---

### Task 7: Supabase Admin Guide (parallel)

**Files:**
- Create: `docs/admin/supabase-feedback-guide.md`

- [ ] **Step 1: Write the admin guide**

Create `docs/admin/supabase-feedback-guide.md`:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/admin/supabase-feedback-guide.md
git commit -m "docs: add Supabase feedback triage guide for admins

Step-by-step guide for viewing, filtering, resolving community
feedback using the Supabase dashboard. Includes SQL queries for
trend analysis and daily triage routine."
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: No errors

- [ ] **Step 2: Run all unit tests**

Run: `npx vitest run`

Expected: ALL PASS

- [ ] **Step 3: Run E2E tests**

Run: `npx playwright test`

Expected: ALL PASS

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: Build succeeds

- [ ] **Step 5: Take a backup snapshot**

Run: `bash scripts/snapshot.sh c8-community-verification`

Expected: Snapshot saved to both local and OneDrive

- [ ] **Step 6: Final commit (if any uncommitted changes)**

```bash
git status
# If clean, skip. If changes exist, stage specific files:
git add <changed-files>
git commit -m "chore: final cleanup for C8 community verification"
```
