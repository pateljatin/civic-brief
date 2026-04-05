export default function ShowcaseNotFound() {
  return (
    <div
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '120px 24px',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-fraunces, serif)',
          fontWeight: 800,
          fontSize: '48px',
          margin: '0 0 16px',
        }}
      >
        Story not found
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-outfit, sans-serif)',
          fontSize: '17px',
          color: 'var(--muted)',
          margin: '0 0 32px',
        }}
      >
        This scenario does not exist. It may have been moved or removed.
      </p>
      <a
        href="/showcase"
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          borderRadius: '8px',
          background: 'var(--civic)',
          color: 'white',
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 600,
          fontSize: '15px',
          textDecoration: 'none',
        }}
      >
        Back to all stories
      </a>
    </div>
  );
}
