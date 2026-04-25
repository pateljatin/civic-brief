import { getServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60_000,
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Persistent rate limiter backed by Supabase.
 *
 * Falls back to allowing the request (fail-open) if the database is
 * unavailable. This keeps the demo functional when Supabase is not
 * configured in local development.
 *
 * Concurrent request note: two simultaneous requests for the same key
 * that both see count=0 will both insert/update and both be allowed.
 * The counter may undercount by at most (concurrency - 1) per window.
 * This is an acceptable trade-off for a demo — a Redis INCR would be
 * atomic, but we're not adding Redis.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  let db;
  try {
    db = getServerClient();
  } catch {
    // Supabase not configured — fail open so local dev works without DB.
    return { allowed: true, remaining: config.maxRequests, resetAt: new Date() };
  }

  const now = new Date();

  const { data: existing, error } = await db
    .from('rate_limits')
    .select('count, window_start, window_ms')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    // DB error — fail open rather than blocking legitimate users.
    return { allowed: true, remaining: config.maxRequests, resetAt: new Date() };
  }

  if (existing) {
    const windowStart = new Date(existing.window_start);
    const windowEnd = new Date(windowStart.getTime() + existing.window_ms);

    if (now < windowEnd) {
      // Within the current window.
      if (existing.count >= config.maxRequests) {
        return { allowed: false, remaining: 0, resetAt: windowEnd };
      }

      // Increment — wrap in Promise.resolve() because Supabase returns PromiseLike.
      await Promise.resolve(
        db
          .from('rate_limits')
          .update({ count: existing.count + 1 })
          .eq('key', key)
      );

      return {
        allowed: true,
        remaining: config.maxRequests - existing.count - 1,
        resetAt: windowEnd,
      };
    }

    // Window expired: start a fresh window.
    await Promise.resolve(
      db
        .from('rate_limits')
        .update({
          count: 1,
          window_start: now.toISOString(),
          window_ms: config.windowMs,
        })
        .eq('key', key)
    );

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(now.getTime() + config.windowMs),
    };
  }

  // No existing entry — create one via upsert to handle the race where two
  // simultaneous requests both see no row and both try to insert.
  await Promise.resolve(
    db.from('rate_limits').upsert({
      key,
      count: 1,
      window_start: now.toISOString(),
      window_ms: config.windowMs,
    })
  );

  return {
    allowed: true,
    remaining: config.maxRequests - 1,
    resetAt: new Date(now.getTime() + config.windowMs),
  };
}

/**
 * Rate-limit by IP address.
 *
 * Returns a 429 NextResponse if the limit is exceeded, or null if the
 * request is allowed. Route files should await this and return early if
 * the result is non-null.
 *
 * Drop-in replacement for the synchronous rateLimit() in security.ts,
 * with cross-isolate persistence.
 */
export async function rateLimitByIp(
  request: { headers: { get(name: string): string | null } },
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<NextResponse | null> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const result = await checkRateLimit(`ip:${ip}`, config);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(1, retryAfter)) },
      }
    );
  }

  return null;
}

/**
 * Rate-limit by authenticated user ID.
 *
 * Drop-in replacement for the synchronous rateLimitByUser() in security.ts,
 * with cross-isolate persistence.
 */
export async function rateLimitByUserId(
  userId: string,
  maxRequests = 5,
  windowMs = 60_000
): Promise<NextResponse | null> {
  const result = await checkRateLimit(`user:${userId}`, { maxRequests, windowMs });

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(1, retryAfter)) },
      }
    );
  }

  return null;
}
