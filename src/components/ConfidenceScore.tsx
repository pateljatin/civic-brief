'use client';

interface ConfidenceScoreProps {
  score: number;
  level: 'high' | 'medium' | 'low';
}

export default function ConfidenceScore({ score, level }: ConfidenceScoreProps) {
  const percentage = Math.round(score * 100);

  const config = {
    high: {
      bg: 'var(--green-light, #e9f5ec)',
      color: 'var(--green, #2d6a4f)',
      label: 'High confidence',
    },
    medium: {
      bg: '#fef3e2',
      color: 'var(--accent, #b44d12)',
      label: 'Medium confidence',
    },
    low: {
      bg: '#fee2e2',
      color: '#dc2626',
      label: 'Low confidence',
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
