'use client';

import { getUIStrings } from '@/lib/ui-strings';

interface EvalDetailsProps {
  readabilityGrade: number;
  readabilityEase: number;
  toneScore?: number;
  jargonScore?: number;
}

interface QualityBadgesProps {
  evalDetails: EvalDetailsProps | null;
  lang?: string;
}

function getReadabilityColor(grade: number) {
  if (grade <= 8) {
    return {
      bg: 'var(--green-light, #e9f5ec)',
      color: 'var(--green, #2d6a4f)',
    };
  }
  if (grade <= 10) {
    return {
      bg: '#fef3e2',
      color: 'var(--accent, #b44d12)',
    };
  }
  return {
    bg: '#fee2e2',
    color: '#dc2626',
  };
}

function getToneColor(score: number) {
  if (score >= 4) {
    return {
      bg: 'var(--green-light, #e9f5ec)',
      color: 'var(--green, #2d6a4f)',
    };
  }
  if (score >= 3) {
    return {
      bg: '#fef3e2',
      color: 'var(--accent, #b44d12)',
    };
  }
  return {
    bg: '#fee2e2',
    color: '#dc2626',
  };
}

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 14px',
  borderRadius: '20px',
  fontSize: '13px',
  fontWeight: 600,
} as const;

const dotStyle = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
} as const;

export default function QualityBadges({ evalDetails, lang = 'en' }: QualityBadgesProps) {
  if (!evalDetails) return null;

  const ui = getUIStrings(lang);
  const roundedGrade = Math.round(evalDetails.readabilityGrade);
  const readColor = getReadabilityColor(evalDetails.readabilityGrade);
  const hasTone = evalDetails.toneScore != null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {/* Reading Level Badge */}
      <div
        style={{
          ...badgeStyle,
          background: readColor.bg,
          color: readColor.color,
        }}
      >
        <span aria-hidden="true" style={{ ...dotStyle, background: readColor.color }} />
        Grade {roundedGrade} {ui.readingLevel}
      </div>

      {/* Tone Badge */}
      {hasTone ? (
        <div
          style={{
            ...badgeStyle,
            background: getToneColor(evalDetails.toneScore!).bg,
            color: getToneColor(evalDetails.toneScore!).color,
          }}
        >
          <span
            aria-hidden="true"
            style={{ ...dotStyle, background: getToneColor(evalDetails.toneScore!).color }}
          />
          {ui.plainLanguage}: {evalDetails.toneScore}/5
        </div>
      ) : (
        <div
          style={{
            ...badgeStyle,
            background: 'var(--warm, #f5f0e8)',
            color: 'var(--muted, #8a8a92)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          <span
            aria-hidden="true"
            style={{ ...dotStyle, background: 'var(--muted, #8a8a92)' }}
          />
          {ui.plainLanguage}: {ui.scoring}
        </div>
      )}
    </div>
  );
}
