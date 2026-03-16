'use client';

import { useState } from 'react';
import UploadForm from '@/components/UploadForm';
import CivicBrief from '@/components/CivicBrief';
import type { CivicContent, VerificationResult } from '@/lib/types';

interface UploadResult {
  sourceId: string | null;
  briefId: string | null;
  brief: {
    headline: string;
    summary: string;
    content: CivicContent;
    confidence_score: number;
    confidence_level: 'high' | 'medium' | 'low';
  };
  verification: VerificationResult;
  translations: Array<{
    language: string;
    briefId: string | null;
    headline?: string;
    content?: CivicContent;
  }>;
  duplicate?: boolean;
}

export default function UploadPage() {
  const [result, setResult] = useState<UploadResult | null>(null);
  const [currentLang, setCurrentLang] = useState('en');
  const [langLoading, setLangLoading] = useState(false);
  const [translations, setTranslations] = useState<
    Record<string, { headline: string; content: CivicContent }>
  >({});

  function handleResult(data: UploadResult) {
    setResult(data);
    setCurrentLang('en');

    // Populate cached translations from the response
    const cached: Record<string, { headline: string; content: CivicContent }> = {};
    for (const t of data.translations) {
      if (t.headline && t.content) {
        cached[t.language] = { headline: t.headline, content: t.content };
      }
    }
    setTranslations(cached);
  }

  async function handleLanguageChange(lang: string) {
    if (lang === currentLang) return;

    // If we already have it cached, just switch
    if (lang === 'en' || translations[lang]) {
      setCurrentLang(lang);
      return;
    }

    // Otherwise, fetch the translation
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

  // Build available languages
  const availableLanguages = ['en'];
  if (result) {
    for (const t of result.translations) {
      if (!availableLanguages.includes(t.language)) {
        availableLanguages.push(t.language);
      }
    }
  }

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
          marginBottom: '32px',
        }}
      >
        Drop a government PDF. Get a plain-language civic brief in seconds.
      </p>

      <UploadForm onResult={handleResult} />

      {/* Show result */}
      {result && (
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
    </div>
  );
}
