'use client';

import { useState } from 'react';
import type { CivicContent, FeedbackType, VerificationResult } from '@/lib/types';
import ConfidenceScore from './ConfidenceScore';
import SourceLink from './SourceLink';
import LanguageToggle from './LanguageToggle';
import FeedbackSection from './FeedbackSection';

interface CivicBriefProps {
  headline: string;
  content: CivicContent;
  sourceUrl: string;
  sourceTitle?: string;
  confidenceScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  verification?: VerificationResult;
  currentLanguage: string;
  availableLanguages: string[];
  translations?: Record<string, { headline: string; content: CivicContent }>;
  onLanguageChange?: (language: string) => void;
  languageLoading?: boolean;
  briefId?: string;
  helpfulCount?: number;
  userFeedback?: FeedbackType;
  isSignedIn?: boolean;
  isDemo?: boolean;
}

interface BriefSectionProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  children: React.ReactNode;
}

function BriefSection({ icon, iconBg, iconColor, label, children }: BriefSectionProps) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: iconBg,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--muted, #8a8a92)',
            marginBottom: '4px',
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: '15px', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

export default function CivicBrief({
  headline,
  content,
  sourceUrl,
  sourceTitle,
  confidenceScore,
  confidenceLevel,
  verification,
  currentLanguage,
  availableLanguages,
  translations,
  onLanguageChange,
  languageLoading,
  briefId,
  helpfulCount = 0,
  userFeedback,
  isSignedIn = false,
  isDemo = false,
}: CivicBriefProps) {
  const [showVerification, setShowVerification] = useState(false);

  // Use translated content if available
  const activeContent =
    currentLanguage !== 'en' && translations?.[currentLanguage]
      ? translations[currentLanguage].content
      : content;
  const activeHeadline =
    currentLanguage !== 'en' && translations?.[currentLanguage]
      ? translations[currentLanguage].headline
      : headline;

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        border: '1px solid var(--border, #e2ddd4)',
        overflow: 'hidden',
        maxWidth: '640px',
        position: 'relative',
      }}
    >
      {/* Demo watermark */}
      {isDemo && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-30deg)',
            fontSize: '64px',
            fontWeight: 800,
            fontFamily: "'Fraunces', serif",
            color: 'rgba(0, 0, 0, 0.04)',
            letterSpacing: '8px',
            textTransform: 'uppercase',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 1,
            whiteSpace: 'nowrap',
          }}
        >
          DEMO
        </div>
      )}
      {/* Header */}
      <div style={{ padding: '24px 24px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <ConfidenceScore score={confidenceScore} level={confidenceLevel} />
          {availableLanguages.length > 1 && (onLanguageChange || translations) && (
            <LanguageToggle
              current={currentLanguage}
              available={availableLanguages}
              onChange={onLanguageChange || (() => {})}
              loading={languageLoading}
            />
          )}
        </div>
        <h2
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '24px',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: '20px',
          }}
        >
          {activeHeadline}
        </h2>
      </div>

      {/* Sections */}
      <div style={{ padding: '0 24px' }}>
        <BriefSection icon="&#916;" iconBg="#fef3e2" iconColor="var(--accent, #b44d12)" label="What changed">
          {activeContent.what_changed}
        </BriefSection>

        <BriefSection icon="&#128100;" iconBg="var(--civic-light, #e8eef5)" iconColor="var(--civic, #1e3a5f)" label="Who is affected">
          {activeContent.who_affected}
        </BriefSection>

        <BriefSection icon="&#10003;" iconBg="var(--green-light, #e9f5ec)" iconColor="var(--green, #2d6a4f)" label="What you can do">
          {activeContent.what_to_do}
        </BriefSection>

        {activeContent.money && (
          <BriefSection icon="$" iconBg="#fef3e2" iconColor="var(--accent, #b44d12)" label="Where the money goes">
            {activeContent.money}
          </BriefSection>
        )}

        {activeContent.deadlines && activeContent.deadlines.length > 0 && (
          <BriefSection icon="&#128197;" iconBg="var(--civic-light, #e8eef5)" iconColor="var(--civic, #1e3a5f)" label="Key deadlines">
            <ul style={{ margin: 0, paddingLeft: '16px' }}>
              {activeContent.deadlines.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </BriefSection>
        )}

        {activeContent.context && (
          <BriefSection icon="&#128218;" iconBg="#f3e8ff" iconColor="#7c3aed" label="Context">
            {activeContent.context}
          </BriefSection>
        )}

        {activeContent.key_quotes && activeContent.key_quotes.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            {activeContent.key_quotes.map((q, i) => (
              <blockquote
                key={i}
                style={{
                  margin: '0 0 8px 0',
                  padding: '12px 16px',
                  borderLeft: '3px solid var(--accent, #b44d12)',
                  background: 'var(--warm, #f5f0e8)',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '14px',
                  fontStyle: 'italic',
                  color: 'var(--muted, #8a8a92)',
                }}
              >
                &ldquo;{q}&rdquo;
              </blockquote>
            ))}
          </div>
        )}
      </div>

      {/* Verification details (expandable) */}
      {verification && (
        <div style={{ padding: '0 24px' }}>
          <button
            onClick={() => setShowVerification(!showVerification)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted, #8a8a92)',
              fontSize: '13px',
              cursor: 'pointer',
              padding: '8px 0',
              fontFamily: 'inherit',
            }}
          >
            {showVerification ? 'Hide' : 'Show'} verification details
          </button>
          {showVerification && (
            <div
              style={{
                fontSize: '13px',
                color: 'var(--muted, #8a8a92)',
                lineHeight: 1.6,
                padding: '12px',
                background: '#fafafa',
                borderRadius: '8px',
                marginBottom: '12px',
              }}
            >
              <p style={{ marginBottom: '8px' }}>{verification.reasoning}</p>
              {verification.unverified_claims.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Unverified claims:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {verification.unverified_claims.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {verification.omitted_info.length > 0 && (
                <div>
                  <strong>Not included in summary:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {verification.omitted_info.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          padding: '16px 24px 24px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <SourceLink url={sourceUrl} title={sourceTitle} isDemo={isDemo} />
      </div>

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
    </div>
  );
}
