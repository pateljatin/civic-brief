import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

/** Hosts we trust for post-login redirects. */
const ALLOWED_HOSTS = new Set([
  'civic-brief.vercel.app',
  'civic-brief-staging.vercel.app',
  'localhost:3000',
]);

/**
 * OAuth callback handler.
 * Google redirects here with an authorization code after the user consents.
 * We exchange the code for tokens directly with Google, then use the id_token
 * to create a Supabase session via signInWithIdToken. This keeps the consent
 * screen branded to our domain instead of showing the Supabase project URL.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // User cancelled the consent screen or Google returned an error
  if (error || !code) {
    return NextResponse.redirect(`${origin}/?auth_error=cancelled`);
  }

  // ── CSRF verification ──
  // The state parameter must match the cookie set before the redirect.
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${origin}/?auth_error=csrf`);
  }

  // Clear the one-time state cookie
  cookieStore.delete('oauth_state');

  const redirectUri = `${origin}/auth/callback`;

  // Exchange the authorization code for tokens with Google
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/?auth_error=token_exchange`);
  }

  const tokens = await tokenRes.json();
  const idToken: string | undefined = tokens.id_token;

  if (!idToken) {
    return NextResponse.redirect(`${origin}/?auth_error=no_id_token`);
  }

  // Create a Supabase session from Google's ID token
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { error: signInError } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    access_token: tokens.access_token,
  });

  if (signInError) {
    return NextResponse.redirect(`${origin}/?auth_error=signin`);
  }

  // ── Safe redirect ──
  // Only follow x-forwarded-host if it's in our allowlist.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocal = process.env.NODE_ENV === 'development';

  if (isLocal) {
    return NextResponse.redirect(`${origin}/upload`);
  } else if (forwardedHost && ALLOWED_HOSTS.has(forwardedHost)) {
    return NextResponse.redirect(`https://${forwardedHost}/upload`);
  }
  return NextResponse.redirect(`${origin}/upload`);
}
