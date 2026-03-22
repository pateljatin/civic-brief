'use client';

import ConfidenceScore from '@/components/ConfidenceScore';
import type { ScenarioConfig } from '@/lib/showcase';

interface ScenarioHeroProps {
  scenario: ScenarioConfig;
  confidence: number; // 0-1 float (from Supabase sources.factuality_score)
}

function confidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

export default function ScenarioHero({ scenario, confidence }: ScenarioHeroProps) {
  return (
    <div className="scenario-hero-animate" data-testid="scenario-hero">
      {/* Icon */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            fontSize: '48px',
            lineHeight: 1,
            background: `linear-gradient(135deg, ${scenario.color}, ${scenario.color}cc)`,
            borderRadius: '16px',
            padding: '20px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {scenario.icon}
        </div>
      </div>

      {/* Title */}
      <h1
        style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontWeight: 800,
          fontSize: '32px',
          color: 'var(--ink)',
          margin: '0 0 16px 0',
        }}
      >
        {scenario.title}
      </h1>

      {/* Story */}
      <p
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 300,
          fontSize: '17px',
          lineHeight: 1.65,
          color: 'var(--muted)',
          margin: '0 0 24px 0',
        }}
      >
        {scenario.story}
      </p>

      {/* Conditional: metadata + confidence + source OR error state */}
      {!confidence ? (
        <p
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: '15px',
            color: 'var(--muted)',
          }}
        >
          This brief is currently unavailable. Please try again later.
        </p>
      ) : (
        <>
          {/* Metadata row */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            {/* Jurisdiction badge */}
            <span
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                border: '1px solid var(--border, #e2ddd4)',
                borderRadius: '4px',
                padding: '2px 8px',
                fontFamily: "'Outfit', sans-serif",
                color: 'var(--ink)',
              }}
            >
              {scenario.jurisdiction}
            </span>

            {/* Document title */}
            <span
              style={{
                fontSize: '13px',
                color: 'var(--muted)',
                fontStyle: 'italic',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              {scenario.documentTitle}
            </span>
          </div>

          {/* Confidence score */}
          <div style={{ marginBottom: '20px' }}>
            <ConfidenceScore score={confidence} level={confidenceLevel(confidence)} />
          </div>

          {/* Source link */}
          <a
            href={scenario.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              border: '1px solid var(--border, #e2ddd4)',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
              color: 'var(--civic, #1e3a5f)',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            View original document →
          </a>
        </>
      )}
    </div>
  );
}
