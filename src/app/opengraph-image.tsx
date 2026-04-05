import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Civic Brief: Plain language for public power.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#fcfaf7',
          position: 'relative',
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: '#b44d12',
          }}
        />

        {/* Subtle vertical lines for civic feel */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '80px',
            width: '1px',
            height: '100%',
            background: 'rgba(30, 58, 95, 0.06)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: '80px',
            width: '1px',
            height: '100%',
            background: 'rgba(30, 58, 95, 0.06)',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '0 120px',
          }}
        >
          <div
            style={{
              fontSize: '72px',
              fontWeight: 700,
              color: '#1e3a5f',
              fontFamily: 'Georgia, serif',
              lineHeight: 1.1,
              marginBottom: '24px',
            }}
          >
            Civic Brief
          </div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 400,
              color: '#1b1b1f',
              opacity: 0.65,
              fontFamily: 'sans-serif',
              lineHeight: 1.4,
            }}
          >
            Plain language for public power.
          </div>

          {/* Divider */}
          <div
            style={{
              width: '80px',
              height: '3px',
              background: '#b44d12',
              marginTop: '40px',
              marginBottom: '40px',
              borderRadius: '2px',
            }}
          />

          <div
            style={{
              fontSize: '18px',
              fontWeight: 400,
              color: '#1b1b1f',
              opacity: 0.45,
              fontFamily: 'sans-serif',
              textAlign: 'center',
              lineHeight: 1.5,
              maxWidth: '600px',
            }}
          >
            Government documents go in. Civic briefs come out. In the languages your community speaks.
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '48px',
            background: '#1e3a5f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 400,
              color: 'rgba(252, 250, 247, 0.7)',
              fontFamily: 'sans-serif',
              letterSpacing: '0.05em',
            }}
          >
            civic-brief.vercel.app
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
