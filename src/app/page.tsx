import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          padding: '100px 24px 60px',
          textAlign: 'center',
          maxWidth: '720px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: '24px',
          }}
        >
          Open Source Civic Intelligence
        </div>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 800,
            lineHeight: 1.12,
            marginBottom: '20px',
          }}
        >
          Government documents,
          <br />
          in plain language.
        </h1>
        <p
          style={{
            fontSize: '18px',
            color: 'var(--muted)',
            fontWeight: 300,
            maxWidth: '480px',
            margin: '0 auto 40px',
          }}
        >
          Upload a budget, resolution, or policy document. Get a civic summary
          in seconds, in the languages your community speaks.
        </p>
        <Link
          href="/upload"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--ink)',
            color: 'var(--paper)',
            padding: '16px 32px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '16px',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
        >
          Upload a document &#8594;
        </Link>
      </section>

      {/* How it works (mini) */}
      <section
        style={{
          padding: '60px 24px',
          background: 'var(--warm)',
        }}
      >
        <div
          style={{
            maxWidth: '960px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '32px',
            textAlign: 'center',
          }}
        >
          {[
            { icon: '\u{1F4C4}', title: 'Upload', desc: 'Drop a government PDF' },
            { icon: '\u{1F9E0}', title: 'Interpret', desc: 'Civic-context AI summarization' },
            { icon: '\u2705', title: 'Verify', desc: 'Factuality scoring' },
            { icon: '\u{1F310}', title: 'Translate', desc: 'English, Spanish, Hindi, and more' },
          ].map((step) => (
            <div key={step.title}>
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>{step.icon}</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>{step.title}</div>
              <div style={{ fontSize: '14px', color: 'var(--muted)' }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section
        style={{
          padding: '60px 24px',
          background: 'var(--ink)',
          color: 'white',
        }}
      >
        <div
          style={{
            maxWidth: '960px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '24px',
            textAlign: 'center',
          }}
        >
          {[
            { num: '3,500+', label: 'newspapers closed in 20 years' },
            { num: '213', label: 'US counties, zero local news' },
            { num: '50M', label: 'Americans with limited civic access' },
          ].map((stat) => (
            <div key={stat.num}>
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: '36px',
                  fontWeight: 800,
                }}
              >
                {stat.num}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.45)',
                  fontWeight: 300,
                  marginTop: '4px',
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
