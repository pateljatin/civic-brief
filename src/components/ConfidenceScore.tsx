'use client';

import { getUIStrings } from '@/lib/ui-strings';

interface ConfidenceScoreProps {
  score: number;
  level: 'high' | 'medium' | 'low';
  lang?: string;
}

export default function ConfidenceScore({ score, level, lang = 'en' }: ConfidenceScoreProps) {
  const ui = getUIStrings(lang);
  const percentage = Math.round(score * 100);

  const config = {
    high: {
      bg: 'var(--green-light, #e9f5ec)',
      color: 'var(--green, #2d6a4f)',
      label: ui.highConfidence,
    },
    medium: {
      bg: '#fef3e2',
      color: 'var(--accent, #b44d12)',
      label: ui.mediumConfidence,
    },
    low: {
      bg: '#fee2e2',
      color: '#dc2626',
      label: ui.lowConfidence,
    },
  }[level];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        borderRadius: '20px',
        background: config.bg,
        color: config.color,
        fontSize: '13px',
        fontWeight: 600,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: config.color,
        }}
      />
      {percentage}% {config.label}
    </div>
  );
}
