import Link from 'next/link';

export const metadata = {
  title: 'Page Not Found | Civic Brief',
};

export default function NotFound() {
  return (
    <div
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        padding: '100px 24px 120px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: '13px',
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBottom: '16px',
        }}
      >
        404
      </p>

      <h1
        style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 800,
          fontSize: 'clamp(28px, 5vw, 40px)',
          lineHeight: 1.15,
          marginBottom: '16px',
          color: 'var(--ink)',
        }}
      >
        Nothing here.
      </h1>

      <p
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: '16px',
          fontWeight: 300,
          color: 'var(--muted)',
          lineHeight: 1.6,
          marginBottom: '40px',
        }}
      >
        That page does not exist. Try one of these instead.
      </p>

      <nav
        aria-label="Suggested pages"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <Link
          href="/showcase"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            background: 'var(--paper)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            fontFamily: "'Outfit', sans-serif",
            textDecoration: 'none',
            color: 'var(--ink)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          className="not-found-link"
        >
          <span>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>Showcase</span>
            <span
              style={{
                display: 'block',
                fontSize: '13px',
                color: 'var(--muted)',
                fontWeight: 300,
                marginTop: '2px',
              }}
            >
              Five real government documents, summarized for five communities.
            </span>
          </span>
          <span style={{ color: 'var(--muted)', fontSize: '20px', marginLeft: '12px' }} aria-hidden="true">
            →
          </span>
        </Link>

        <Link
          href="/upload"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            background: 'var(--paper)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            fontFamily: "'Outfit', sans-serif",
            textDecoration: 'none',
            color: 'var(--ink)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          className="not-found-link"
        >
          <span>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>Upload a Document</span>
            <span
              style={{
                display: 'block',
                fontSize: '13px',
                color: 'var(--muted)',
                fontWeight: 300,
                marginTop: '2px',
              }}
            >
              Drop in a government PDF and get a plain-language brief.
            </span>
          </span>
          <span style={{ color: 'var(--muted)', fontSize: '20px', marginLeft: '12px' }} aria-hidden="true">
            →
          </span>
        </Link>

        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            background: 'var(--paper)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            fontFamily: "'Outfit', sans-serif",
            textDecoration: 'none',
            color: 'var(--ink)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          className="not-found-link"
        >
          <span>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>Home</span>
            <span
              style={{
                display: 'block',
                fontSize: '13px',
                color: 'var(--muted)',
                fontWeight: 300,
                marginTop: '2px',
              }}
            >
              Back to the start.
            </span>
          </span>
          <span style={{ color: 'var(--muted)', fontSize: '20px', marginLeft: '12px' }} aria-hidden="true">
            →
          </span>
        </Link>
      </nav>

      <style>{`
        .not-found-link:hover {
          border-color: var(--civic);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
        }

        @media (prefers-reduced-motion: reduce) {
          .not-found-link {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
