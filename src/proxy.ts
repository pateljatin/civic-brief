import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Privacy, security, and auth proxy (Next.js 16+).
 *
 * Responsibilities:
 * 1. Per-request CSP, privacy and cache-control headers
 * 2. Supabase auth session refresh (keeps tokens fresh)
 *
 * NOTE on CSP: we tried per-request nonces with 'strict-dynamic' (per the
 * Next.js docs) but Next.js 16 + Turbopack does not actually attach nonces
 * to its RSC bootstrap inline scripts or chunk <script src> tags in our
 * build, so the browser blocked hydration. Until that auto-injection is
 * reliable, production allows 'unsafe-inline' for script-src — same as
 * pre-C18. See issue #61 and the corresponding follow-up for the path back
 * to nonces. We still drop 'unsafe-eval' in production (a real C18 win
 * that is independent of inline-script handling).
 */
export function proxy(request: NextRequest) {
  const csp = buildCsp();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const response = NextResponse.next({ request });
    finalizeHeaders(response, request, csp);
    return response;
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Trigger session refresh if needed (cookie side-effects happen synchronously
  // through setAll above; we don't await the returned promise).
  supabase.auth.getUser();

  finalizeHeaders(supabaseResponse, request, csp);
  return supabaseResponse;
}

function buildCsp(): string {
  const scriptSrc = isDev
    ? `'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com`
    : `'self' 'unsafe-inline' https://va.vercel-scripts.com`;

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https://lh3.googleusercontent.com`,
    `connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://accounts.google.com`,
  ].join('; ');
}

function finalizeHeaders(
  response: NextResponse,
  request: NextRequest,
  csp: string
) {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Privacy', 'no-tracking no-pii');

  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
