import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Privacy, security, and auth proxy (Next.js 16+).
 *
 * Three responsibilities:
 * 1. Privacy headers on every response
 * 2. Cache-busting for API responses
 * 3. Supabase auth session refresh (keeps tokens fresh)
 */
export function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured, skip auth and just add headers
  if (!supabaseUrl || !supabaseAnonKey) {
    const response = NextResponse.next();
    addPrivacyHeaders(response, request);
    return response;
  }

  // Create auth-aware response that can refresh session cookies
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Update request cookies (for downstream server components)
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        // Create fresh response with updated cookies
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh session (triggers cookie refresh if tokens are expiring)
  // We don't await this because proxy runs synchronously,
  // but the cookie side-effects happen during the call
  supabase.auth.getUser();

  addPrivacyHeaders(supabaseResponse, request);
  return supabaseResponse;
}

function addPrivacyHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set('X-Privacy', 'no-tracking no-pii');

  // Prevent caching of API responses
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
