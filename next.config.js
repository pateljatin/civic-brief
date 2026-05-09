/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['unpdf'],

  // ── Security Headers ──
  // Defense-in-depth: every response gets hardened headers.
  // CSP is set per-request in src/proxy.ts so it can carry a fresh nonce
  // for each response (required for Next.js RSC inline bootstrap scripts).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },

  // ── Powered-By Header Removal ──
  // Don't leak what framework we're running
  poweredByHeader: false,
};

module.exports = nextConfig;
