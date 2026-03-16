import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import AuthButton from '@/components/AuthButton';
import './globals.css';

export const metadata: Metadata = {
  title: 'Civic Brief',
  description:
    'Your government, in your language, in plain language. Open-source civic intelligence for every community.',
  openGraph: {
    title: 'Civic Brief',
    description:
      'Government documents go in. Plain-language civic briefs come out. In the languages your community actually speaks.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;1,9..144,400&family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <nav
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            padding: '14px 40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(252, 250, 247, 0.92)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(226, 221, 212, 0.5)',
          }}
        >
          <a
            href="/"
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 800,
              fontSize: '22px',
            }}
          >
            Civic Brief
          </a>
          <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
            <a
              href="/upload"
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--muted)',
                transition: 'color 0.2s',
              }}
            >
              Upload
            </a>
            <a
              href="/brief/demo"
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--muted)',
                transition: 'color 0.2s',
              }}
            >
              Demo Brief
            </a>
            <a
              href="https://github.com/pateljatin/civic-brief"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--muted)',
                transition: 'color 0.2s',
              }}
            >
              GitHub
            </a>
            <AuthButton />
          </div>
        </nav>
        <main style={{ paddingTop: '60px' }}>{children}</main>
        <footer
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: '20px',
              fontWeight: 800,
              marginBottom: '6px',
            }}
          >
            Civic Brief
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 300 }}>
            Plain language for public power.
          </div>
          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              justifyContent: 'center',
              gap: '24px',
              fontSize: '13px',
            }}
          >
            <a
              href="https://github.com/pateljatin/civic-brief"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--muted)', fontWeight: 500, transition: 'color 0.2s' }}
            >
              GitHub (MIT License)
            </a>
            <a
              href="/brief/demo"
              style={{ color: 'var(--muted)', fontWeight: 500, transition: 'color 0.2s' }}
            >
              Demo Brief
            </a>
            <a
              href="/upload"
              style={{ color: 'var(--muted)', fontWeight: 500, transition: 'color 0.2s' }}
            >
              Upload
            </a>
            <a
              href="mailto:civicbriefapp@gmail.com"
              style={{ color: 'var(--muted)', fontWeight: 500, transition: 'color 0.2s' }}
            >
              Contact
            </a>
          </div>
          <div
            style={{
              marginTop: '12px',
              fontSize: '11px',
              color: 'var(--muted)',
              opacity: 0.5,
            }}
          >
            Mozilla Foundation Democracy x AI Incubator 2026
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
