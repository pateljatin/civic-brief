export default function ShowcaseLoading() {
  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '80px 24px 120px',
      }}
    >
      {/* Header skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '48px', gap: '12px' }}>
        <div className="skeleton skeleton-heading" style={{ width: '60%', height: '44px' }} />
        <div className="skeleton skeleton-text" style={{ width: '72%', height: '20px' }} />
      </div>

      {/* Card skeletons — 5 to match the real showcase */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'row',
              background: 'var(--paper)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              overflow: 'hidden',
              animationDelay: `${i * 80}ms`,
            }}
            aria-hidden="true"
          >
            {/* Icon panel skeleton */}
            <div
              className="skeleton"
              style={{
                width: '80px',
                flexShrink: 0,
                minHeight: '96px',
                borderRadius: 0,
              }}
            />

            {/* Content skeleton */}
            <div
              style={{
                flex: 1,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div className="skeleton skeleton-text" style={{ width: '55%', height: '18px' }} />
              <div className="skeleton skeleton-text" style={{ width: '90%', height: '14px' }} />
              <div className="skeleton skeleton-text" style={{ width: '75%', height: '14px' }} />
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <div className="skeleton skeleton-badge" style={{ width: '90px', height: '20px' }} />
                <div className="skeleton skeleton-badge" style={{ width: '60px', height: '20px' }} />
              </div>
            </div>

            {/* Arrow skeleton */}
            <div
              style={{
                paddingRight: '16px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div className="skeleton" style={{ width: '16px', height: '20px', borderRadius: '4px' }} />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .skeleton {
          background: linear-gradient(
            90deg,
            var(--warm) 25%,
            var(--border) 50%,
            var(--warm) 75%
          );
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.6s ease-in-out infinite;
          border-radius: 6px;
        }

        .skeleton-heading {
          border-radius: 8px;
        }

        .skeleton-text {
          border-radius: 4px;
        }

        .skeleton-badge {
          border-radius: 4px;
        }

        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .skeleton {
            animation: none;
            background: var(--warm);
          }
        }
      `}</style>
    </div>
  );
}
