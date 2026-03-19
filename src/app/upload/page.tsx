'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase';
import UploadForm from '@/components/UploadForm';
import CivicBrief from '@/components/CivicBrief';
import type { CivicContent, SummarizeResult } from '@/lib/types';
import type { User } from '@supabase/supabase-js';

type UploadResult = SummarizeResult;

export default function UploadPage() {
  const [result, setResult] = useState<UploadResult | null>(null);
  const [currentLang, setCurrentLang] = useState('en');
  const [langLoading, setLangLoading] = useState(false);
  const [translations, setTranslations] = useState<
    Record<string, { headline: string; content: CivicContent }>
  >({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number>(10);
  const [user, setUser] = useState<User | null>(null);
  const [duplicateRedirect, setDuplicateRedirect] = useState<string | null>(null);
  const router = useRouter();

  // Fetch daily limit and auth state on mount
  useEffect(() => {
    fetch('/api/limit')
      .then((r) => r.json())
      .then((data) => {
        setRemaining(data.remaining);
        setDailyLimit(data.dailyLimit);
      })
      .catch(() => {});

    // Check auth state
    try {
      const supabase = getBrowserClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        setUser(user ?? null);
      });
    } catch {
      // Supabase not configured
    }
  }, []);

  function handleResult(data: UploadResult) {
    if (data.duplicate && data.redirectUrl) {
      setDuplicateRedirect(data.redirectUrl);
      setTimeout(() => {
        router.push(data.redirectUrl);
      }, 2000);
      return;
    }
    setResult(data);
    setCurrentLang('en');
    // Decrement local remaining count
    if (remaining !== null && !data.duplicate) {
      setRemaining(Math.max(0, remaining - 1));
    }

    if (!data.duplicate && data.translations) {
      const cached: Record<string, { headline: string; content: CivicContent }> = {};
      for (const t of data.translations) {
        if (t.headline && t.content) {
          cached[t.language] = { headline: t.headline, content: t.content };
        }
      }
      setTranslations(cached);
    }
  }

  async function handleLanguageChange(lang: string) {
    if (lang === currentLang) return;

    if (lang === 'en' || translations[lang]) {
      setCurrentLang(lang);
      return;
    }

    if (!result?.briefId) {
      setCurrentLang(lang);
      return;
    }

    setLangLoading(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId: result.briefId,
          targetLanguage: lang,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTranslations((prev) => ({
          ...prev,
          [lang]: { headline: data.headline, content: data.content },
        }));
      }
    } catch {
      // Silently fail, user stays on current language
    } finally {
      setLangLoading(false);
      setCurrentLang(lang);
    }
  }

  const availableLanguages = ['en'];
  if (result && !result.duplicate && result.translations) {
    for (const t of result.translations) {
      if (!availableLanguages.includes(t.language)) {
        availableLanguages.push(t.language);
      }
    }
  }

  // Trigger progress bar fill animation
  useEffect(() => {
    if (duplicateRedirect) {
      requestAnimationFrame(() => {
        const el = document.querySelector('.dup-progress-fill') as HTMLElement;
        if (el) el.style.width = '100%';
      });
    }
  }, [duplicateRedirect]);

  const limitReached = remaining !== null && remaining <= 0;

  return (
    <div className="container-narrow" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <h1
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: '32px',
          fontWeight: 800,
          marginBottom: '8px',
        }}
      >
        Upload a document
      </h1>
      <p
        style={{
          fontSize: '16px',
          color: 'var(--muted)',
          marginBottom: '16px',
        }}
      >
        Drop a government PDF. Get a plain-language civic brief in seconds.
      </p>

      {/* Demo capacity indicator */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '8px',
          background: limitReached ? '#fee2e2' : 'var(--warm)',
          border: `1px solid ${limitReached ? '#fca5a5' : 'var(--border)'}`,
          fontSize: '13px',
          color: limitReached ? '#dc2626' : 'var(--muted)',
          marginBottom: '24px',
        }}
      >
        {remaining === null ? (
          'Loading...'
        ) : limitReached ? (
          <>Daily demo limit reached. Try again tomorrow.</>
        ) : (
          <>{remaining} of {dailyLimit} demo uses remaining today</>
        )}
      </div>

      {/* Sign-in nudge for anonymous users */}
      {!user && !limitReached && remaining !== null && (
        <div
          style={{
            fontSize: '13px',
            color: 'var(--muted)',
            marginBottom: '24px',
          }}
        >
          Sign in to track your briefs and get higher limits.
        </div>
      )}

      {limitReached ? (
        <div
          style={{
            padding: '32px',
            textAlign: 'center',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            background: 'var(--warm)',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>
            {'\u{1F512}'}
          </div>
          <p style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
            Daily limit reached
          </p>
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
            This is a free demo with {dailyLimit} documents per day to manage costs.
            Check back tomorrow, or{' '}
            <a
              href="/brief/demo"
              style={{ color: 'var(--civic)', fontWeight: 500 }}
            >
              view a sample brief
            </a>{' '}
            to see how it works.
          </p>
        </div>
      ) : (
        <UploadForm onResult={handleResult} />
      )}

      {duplicateRedirect && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            textAlign: 'center',
            padding: '0 16px',
          }}
          aria-live="polite"
          role="status"
        >
          <div style={{
            background: 'white',
            borderRadius: '16px',
            border: '1px solid var(--border, #e2ddd4)',
            padding: '48px 40px',
            maxWidth: '480px',
            width: '100%',
          }}>
            {/* Cycling civic icons */}
            <div style={{ fontSize: '48px', marginBottom: '20px', height: '56px' }}>
              <CivicIconCycle />
            </div>

            <h2 style={{
              fontFamily: "'Fraunces', serif",
              fontSize: '22px',
              fontWeight: 700,
              marginBottom: '12px',
            }}>
              This document already has a brief.
            </h2>

            {/* Progress bar */}
            <div style={{
              width: '100%',
              height: '4px',
              background: 'var(--border, #e2ddd4)',
              borderRadius: '2px',
              overflow: 'hidden',
              marginBottom: '16px',
            }}>
              <div className="dup-progress-fill" style={{
                height: '100%',
                background: 'var(--civic, #1e3a5f)',
                borderRadius: '2px',
                width: '0%',
                transition: 'width 2s linear',
              }} />
            </div>

            <p style={{
              fontSize: '14px',
              color: 'var(--muted, #8a8a92)',
              marginBottom: '16px',
            }}>
              Taking you there...
            </p>

            <a
              href={duplicateRedirect}
              onClick={(e) => { e.preventDefault(); router.push(duplicateRedirect); }}
              style={{
                color: 'var(--accent, #b44d12)',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Go now
            </a>
          </div>

          {/* Screen reader text */}
          <span className="sr-only">
            Redirecting to existing brief for this document.
          </span>
        </div>
      )}

      {result && !result.duplicate && result.brief && (
        <div style={{ marginTop: '48px' }}>
          <h2
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: '24px',
              fontWeight: 700,
              marginBottom: '20px',
            }}
          >
            Your Civic Brief
          </h2>
          <CivicBrief
            headline={result.brief.headline}
            content={result.brief.content}
            sourceUrl={
              (document.querySelector('#sourceUrl') as HTMLInputElement)?.value || '#'
            }
            confidenceScore={result.brief.confidence_score}
            confidenceLevel={result.brief.confidence_level}
            verification={result.verification}
            currentLanguage={currentLang}
            availableLanguages={availableLanguages}
            translations={translations}
            onLanguageChange={handleLanguageChange}
            languageLoading={langLoading}
          />
          {result.briefId && (
            <p
              style={{
                marginTop: '16px',
                fontSize: '14px',
                color: 'var(--muted)',
              }}
            >
              Shareable link:{' '}
              <a
                href={`/brief/${result.briefId}`}
                style={{ color: 'var(--civic)', fontWeight: 500 }}
              >
                /brief/{result.briefId}
              </a>
            </p>
          )}
        </div>
      )}

      <style>{`
        @keyframes civicPulse {
          0% { transform: scale(0.9); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
      `}</style>
    </div>
  );
}

function CivicIconCycle() {
  const [index, setIndex] = useState(0);
  const icons = ['\u2696\uFE0F', '\uD83C\uDFDB\uFE0F', '\uD83D\uDCDC', '\uD83D\uDD28', '\uD83D\uDCC4'];

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % icons.length);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      key={index}
      style={{
        display: 'inline-block',
        animation: 'civicPulse 0.4s ease-in-out',
      }}
    >
      {icons[index]}
    </span>
  );
}
