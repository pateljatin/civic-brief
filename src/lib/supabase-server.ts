import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Auth-aware Supabase client for Server Components and Route Handlers.
 * Reads the user's session from cookies (set by the middleware).
 * Respects RLS policies based on the authenticated user.
 *
 * Use getServerClient() from supabase.ts for service-role operations
 * that need to bypass RLS (e.g., inserting sources, briefs).
 */
export async function createAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from Server Component where cookies are read-only.
            // Session refresh will happen in middleware instead.
          }
        },
      },
    }
  );
}
