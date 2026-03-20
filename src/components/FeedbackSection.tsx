'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FeedbackType } from '@/lib/types';

interface FeedbackSectionProps {
  briefId: string;
  helpfulCount: number;
  userFeedback?: FeedbackType;
  isSignedIn: boolean;
  isDemo?: boolean;
}

type FeedbackState =
  | 'default'
  | 'form'
  | 'submitting'
  | 'submitted'
  | 'helpful-submitted'
  | 'already-submitted'
  | 'error'
  | 'demo-preview';

interface CategoryOption {
  type: FeedbackType;
  label: string;
  icon: string;
}

const PRIMARY_CATEGORIES: (CategoryOption & { color: string })[] = [
  { type: 'factual_error', label: 'Factual error', icon: '\u2717', color: '#dc2626' },
  { type: 'missing_info', label: 'Missing info', icon: '\u2026', color: '#d97706' },
  { type: 'translation_error', label: 'Translation error', icon: '\uD83C\uDF10', color: '#7c3aed' },
];

const SECONDARY_CATEGORIES: CategoryOption[] = [
  { type: 'misleading', label: 'Misleading', icon: '\u26A0' },
  { type: 'outdated', label: 'Outdated', icon: '\uD83D\uDD52' },
];

const DEMO_TOOLTIP = 'Sign in and upload a document to give feedback on real briefs.';

export default function FeedbackSection({
  briefId,
  helpfulCount: initialHelpfulCount,
  userFeedback,
  isSignedIn,
  isDemo = false,
}: FeedbackSectionProps) {
  const [state, setState] = useState<FeedbackState>(() => {
    if (isDemo) return 'demo-preview';
    if (userFeedback) return 'already-submitted';
    return 'default';
  });
  const [helpfulCount, setHelpfulCount] = useState(initialHelpfulCount);
  const [selectedCategory, setSelectedCategory] = useState<FeedbackType | null>(null);
  const [details, setDetails] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Auto-collapse after submission
  useEffect(() => {
    if (state === 'submitted' || state === 'helpful-submitted') {
      const timer = setTimeout(() => setState('already-submitted'), 3000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  // Auto-dismiss error
  useEffect(() => {
    if (state === 'error') {
      const timer = setTimeout(() => setState('default'), 5000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const handleSignIn = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    // CSRF protection: random state stored in a cookie, verified in callback
    const csrfState = crypto.randomUUID();
    document.cookie = `oauth_state=${csrfState}; path=/; max-age=600; SameSite=Lax; Secure`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${window.location.origin}/auth/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state: csrfState,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }, []);

  const submitFeedback = useCallback(
    async (feedbackType: FeedbackType, feedbackDetails?: string) => {
      setState('submitting');

      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            briefId,
            feedbackType,
            ...(feedbackDetails ? { details: feedbackDetails } : {}),
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }

        if (feedbackType === 'helpful') {
          setState('helpful-submitted');
        } else {
          setState('submitted');
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        setState('error');
      }
    },
    [briefId],
  );

  const handleHelpful = useCallback(() => {
    if (!isSignedIn) {
      handleSignIn();
      return;
    }
    // Optimistic update
    setHelpfulCount((c) => c + 1);
    submitFeedback('helpful');
  }, [isSignedIn, handleSignIn, submitFeedback]);

  const handleReportIssue = useCallback(() => {
    if (!isSignedIn) {
      handleSignIn();
      return;
    }
    setSelectedCategory(null);
    setDetails('');
    setState('form');
  }, [isSignedIn, handleSignIn]);

  const handleSubmitReport = useCallback(() => {
    if (!selectedCategory) return;
    submitFeedback(selectedCategory, details.trim() || undefined);
  }, [selectedCategory, details, submitFeedback]);

  // ── Demo preview: disabled buttons with tooltip ──
  if (state === 'demo-preview') {
    return (
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border, #e2ddd4)' }}>
        <style>{feedbackSheetStyles}</style>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            disabled
            title={DEMO_TOOLTIP}
            style={{
              ...buttonBase,
              opacity: 0.5,
              cursor: 'not-allowed',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: '14px' }}>{'\uD83D\uDC4D'}</span>
            Helpful ({helpfulCount})
          </button>
          <button
            disabled
            title={DEMO_TOOLTIP}
            style={{
              ...buttonBase,
              opacity: 0.5,
              cursor: 'not-allowed',
            }}
          >
            Report issue
          </button>
        </div>
      </div>
    );
  }

  // ── Already submitted ──
  if (state === 'already-submitted') {
    return (
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border, #e2ddd4)' }}>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--muted, #8a8a92)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span aria-hidden="true">{'\u2713'}</span>
          {userFeedback === 'helpful'
            ? `You found this helpful. (${helpfulCount})`
            : 'Thanks for your feedback.'}
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (state === 'error') {
    return (
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border, #e2ddd4)' }}>
        <div
          style={{
            fontSize: '13px',
            color: '#b91c1c',
            background: '#fef2f2',
            padding: '10px 14px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span aria-hidden="true">{'\u26A0'}</span>
          {errorMessage}
        </div>
      </div>
    );
  }

  // ── Submitted confirmation ──
  if (state === 'submitted' || state === 'helpful-submitted') {
    return (
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border, #e2ddd4)' }}>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--green, #2d6a4f)',
            background: 'var(--green-light, #e9f5ec)',
            padding: '10px 14px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span aria-hidden="true">{'\u2713'}</span>
          {state === 'helpful-submitted'
            ? `Glad this was helpful! (${helpfulCount})`
            : 'Thanks for reporting. We\'ll review this.'}
        </div>
      </div>
    );
  }

  // ── Submitting state ──
  if (state === 'submitting') {
    return (
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border, #e2ddd4)' }}>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--muted, #8a8a92)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              border: '2px solid var(--border, #e2ddd4)',
              borderTopColor: 'var(--civic, #1e3a5f)',
              borderRadius: '50%',
              animation: 'feedback-spin 0.6s linear infinite',
            }}
          />
          Submitting...
        </div>
        <style>{`@keyframes feedback-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Form state: category picker + optional details ──
  if (state === 'form') {
    return (
      <>
        <style>{feedbackSheetStyles}</style>
        <div className="feedback-sheet" data-testid="feedback-form">
          <div
            style={{
              padding: '20px 24px',
              borderTop: '1px solid var(--border, #e2ddd4)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--civic, #1e3a5f)',
                }}
              >
                Report an error
              </div>
              <button
                onClick={() => setState('default')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted, #8a8a92)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '0 4px',
                  fontFamily: 'inherit',
                  lineHeight: 1,
                }}
                aria-label="Close feedback form"
              >
                {'\u2715'}
              </button>
            </div>

            {/* Primary categories */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {PRIMARY_CATEGORIES.map((cat) => (
                <button
                  key={cat.type}
                  onClick={() => setSelectedCategory(cat.type)}
                  style={{
                    ...categoryButtonStyle,
                    border: selectedCategory === cat.type
                      ? '2px solid var(--civic, #1e3a5f)'
                      : '1px solid var(--border, #e2ddd4)',
                    background: selectedCategory === cat.type
                      ? 'var(--civic-light, #e8eef5)'
                      : 'white',
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: '14px', color: cat.color }}>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Secondary categories (de-emphasized) */}
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted, #8a8a92)', marginBottom: '8px' }}>
              Other concerns
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {SECONDARY_CATEGORIES.map((cat) => (
                <button
                  key={cat.type}
                  onClick={() => setSelectedCategory(cat.type)}
                  style={{
                    ...categoryButtonStyle,
                    fontSize: '12px',
                    padding: '12px 10px',
                    color: 'var(--muted, #8a8a92)',
                    border: selectedCategory === cat.type
                      ? '2px solid var(--civic, #1e3a5f)'
                      : '1px solid var(--border, #e2ddd4)',
                    background: selectedCategory === cat.type
                      ? 'var(--civic-light, #e8eef5)'
                      : 'white',
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: '12px' }}>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Optional details */}
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Optional: tell us more..."
              maxLength={1000}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border, #e2ddd4)',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {/* Submit */}
            <button
              onClick={handleSubmitReport}
              disabled={!selectedCategory}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                background: selectedCategory ? 'var(--civic, #1e3a5f)' : 'var(--border, #e2ddd4)',
                color: selectedCategory ? 'white' : 'var(--muted, #8a8a92)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: selectedCategory ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              Submit report
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Default state: helpful + report buttons ──
  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border, #e2ddd4)' }}>
      <style>{feedbackSheetStyles}</style>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleHelpful}
          style={buttonBase}
        >
          <span aria-hidden="true" style={{ fontSize: '14px' }}>{'\uD83D\uDC4D'}</span>
          Helpful ({helpfulCount})
        </button>
        <button
          onClick={handleReportIssue}
          style={{
            ...buttonBase,
            color: 'var(--muted, #8a8a92)',
          }}
        >
          Report issue
        </button>
      </div>
    </div>
  );
}

// ── Shared inline style objects ──

const buttonBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '12px 14px',
  borderRadius: '8px',
  border: '1px solid var(--border, #e2ddd4)',
  background: 'white',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.2s',
  color: 'var(--ink, #1a1a1a)',
};

const categoryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.15s',
  color: 'var(--ink, #1a1a1a)',
  background: 'white',
  border: '1px solid var(--border, #e2ddd4)',
};

// ── CSS for responsive bottom sheet on mobile ──

const feedbackSheetStyles = `
  @media (max-width: 640px) {
    .feedback-sheet {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      max-height: 70vh !important;
      overflow-y: auto !important;
      background: white !important;
      border-radius: 16px 16px 0 0 !important;
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15) !important;
      z-index: 300 !important;
    }
  }
`;
