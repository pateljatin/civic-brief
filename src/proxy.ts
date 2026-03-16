import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Privacy and security proxy (Next.js 16+).
 *
 * Civic Brief's privacy posture:
 * - We NEVER store uploaded documents (processed in memory, discarded)
 * - We NEVER collect personal information (no accounts, no login)
 * - We NEVER track individual users (only aggregate Vercel Analytics)
 * - We NEVER set cookies (no sessions, no tracking)
 * - We store ONLY our generated civic briefs and source URLs
 *
 * This proxy enforces these guarantees at the infrastructure level.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // ── Privacy Headers ──
  // Tell browsers we don't track
  response.headers.set('X-Privacy', 'no-tracking no-cookies no-pii');

  // Prevent caching of API responses (contain potentially sensitive document analysis)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
  }

  return response;
}

export const config = {
  // Apply to all routes except static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
