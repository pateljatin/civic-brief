import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Civic Brief Showcase: Five Stories. Five Communities.';
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

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '0 120px',
          }}
        >
          {/* Small label */}
          <div
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#b44d12',
              fontFamily: 'sans-serif',
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              marginBottom: '20px',
            }}
          >
            Civic Brief Showcase
          </div>

          <div
            style={{
              fontSize: '56px',
              fontWeight: 700,
              color: '#1e3a5f',
              fontFamily: 'Georgia, serif',
              lineHeight: 1.15,
              marginBottom: '28px',
              textAlign: 'center',
            }}
          >
            Five Stories. Five Communities.
          </div>

          {/* Divider */}
          <div
            style={{
              width: '60px',
              height: '3px',
              background: '#b44d12',
              marginBottom: '28px',
              borderRadius: '2px',
            }}
          />

          <div
            style={{
              fontSize: '20px',
              fontWeight: 400,
              color: '#1b1b1f',
              opacity: 0.55,
              fontFamily: 'sans-serif',
              textAlign: 'center',
              lineHeight: 1.5,
              maxWidth: '640px',
            }}
          >
            Real government documents from across the US, turned into plain-language civic briefs anyone can understand.
          </div>

          {/* City dots */}
          <div
            style={{
              display: 'flex',
              gap: '32px',
              marginTop: '40px',
              alignItems: 'center',
            }}
          >
            {['Philadelphia', 'Atlanta', 'Chicago', 'Seattle', 'Federal'].map(
              (city) => (
                <div
                  key={city}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#1e3a5f',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '14px',
                      color: '#1b1b1f',
                      opacity: 0.5,
                      fontFamily: 'sans-serif',
                    }}
                  >
                    {city}
                  </div>
                </div>
              )
            )}
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
            civic-brief.vercel.app/showcase
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
