'use client';

import ScrollFadeIn from '@/components/ScrollFadeIn';
import ConfidenceCountUp from '@/components/ConfidenceCountUp';
import type { ScenarioConfig } from '@/lib/showcase';

interface ScenarioCardProps {
  scenario: ScenarioConfig;
  confidence: number | null;
  index: number;
}

export default function ScenarioCard({ scenario, confidence, index }: ScenarioCardProps) {
  const { slug, title, icon, color, jurisdiction, narrative, briefId } = scenario;

  const isComingSoon = briefId === null;
  const isUnavailable = confidence === null && !isComingSoon;

  const iconPanelStyle: React.CSSProperties = {
    width: '80px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(135deg, ${color}, #111)`,
    fontSize: '36px',
    lineHeight: 1,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: 0,
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: "'Fraunces', serif",
    fontWeight: 700,
    fontSize: '17px',
    color: 'var(--ink)',
    margin: 0,
  };

  const bodyTextStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--muted)',
    lineHeight: 1.5,
    margin: 0,
  };

  const bottomRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '2px',
  };

  const jurisdictionBadgeStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--muted)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px 7px',
    lineHeight: 1.6,
  };

  const cardInnerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    background: 'var(--paper)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    overflow: 'hidden',
    textDecoration: 'none',
    position: 'relative',
  };

  // Determine body text
  let bodyContent: React.ReactNode;
  if (isComingSoon) {
    bodyContent = <p style={bodyTextStyle}>Coming soon</p>;
  } else if (isUnavailable) {
    bodyContent = <p style={bodyTextStyle}>Brief unavailable</p>;
  } else {
    bodyContent = <p style={bodyTextStyle}>{narrative}</p>;
  }

  return (
    <ScrollFadeIn delay={index * 100}>
      <a
        href={`/showcase/${slug}`}
        className="scenario-card-link"
        aria-label={`Read about ${title} - ${jurisdiction}`}
        style={cardInnerStyle}
      >
        <div style={iconPanelStyle}>
          <span>{icon}</span>
        </div>

        <div style={contentStyle}>
          <h2 style={titleStyle}>{title}</h2>
          {bodyContent}
          <div style={bottomRowStyle}>
            <span style={jurisdictionBadgeStyle}>{jurisdiction}</span>
            {confidence !== null && <ConfidenceCountUp value={confidence} />}
          </div>
        </div>

        <span
          className="scenario-card-arrow"
          style={{ color: 'var(--muted)', fontSize: '22px', alignSelf: 'center', paddingRight: '16px' }}
          aria-hidden="true"
        >
          →
        </span>
      </a>
    </ScrollFadeIn>
  );
}
