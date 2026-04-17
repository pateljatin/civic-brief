import { NextRequest, NextResponse } from 'next/server';

// ── Rate Limiting ──
// Simple in-memory rate limiter. For production, use Redis or Vercel KV.
// This protects against abuse during the demo period.

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT = {
  maxRequests: 10,        // max requests per window
  windowMs: 60 * 1000,   // 1 minute window
};

export function rateLimit(request: NextRequest): NextResponse | null {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return null; // allowed
  }

  if (entry.count >= RATE_LIMIT.maxRequests) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute before trying again.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      }
    );
  }

  entry.count++;
  return null; // allowed
}

// Clean up stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    rateLimitStore.forEach((entry, key) => {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    });
  }, 5 * 60 * 1000);
}

// ── Per-User Rate Limiting ──
// Keyed on user ID instead of IP. For authenticated endpoints.

const userRateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimitByUser(
  userId: string,
  maxRequests = 5,
  windowMs = 60 * 1000
): NextResponse | null {
  const now = Date.now();
  const entry = userRateLimitStore.get(userId);

  if (!entry || now > entry.resetAt) {
    userRateLimitStore.set(userId, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (entry.count >= maxRequests) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before submitting more feedback.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      }
    );
  }

  entry.count++;
  return null;
}

// Clean up stale user rate limit entries
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    userRateLimitStore.forEach((entry, key) => {
      if (now > entry.resetAt) {
        userRateLimitStore.delete(key);
      }
    });
  }, 5 * 60 * 1000);
}

// ── Input Validation ──

/**
 * Returns true if a hostname string resolves to a private/loopback IP range.
 * Guards against SSRF attacks that target internal infrastructure.
 */
function isPrivateHost(hostname: string): boolean {
  // Strip IPv6 brackets
  const host = hostname.replace(/^\[/, '').replace(/\]$/, '');

  // Explicit loopback / wildcard
  if (host === 'localhost' || host === '0.0.0.0') return true;

  // IPv6 loopback
  if (host === '::1') return true;

  // IPv6 Unique Local (fc00::/7) — fc00:: through fdff::
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) return true;

  // IPv6 link-local (fe80::/10)
  if (/^fe[89ab][0-9a-f]:/i.test(host)) return true;

  // IPv4 — parse octets
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b, c] = ipv4.map(Number);
    if (a === 127) return true;          // 127.0.0.0/8  loopback
    if (a === 10) return true;           // 10.0.0.0/8   private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (AWS metadata)
  }

  return false;
}

/** Validate a URL is well-formed and uses http(s). Rejects dangerous protocols,
 *  embedded credentials, private/loopback hosts, and protocol-relative URLs. */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required.' };
  }

  if (url.length > 2048) {
    return { valid: false, error: 'URL is too long (max 2048 characters).' };
  }

  // Reject protocol-relative URLs (//example.com) before URL() parses them
  if (url.startsWith('//')) {
    return { valid: false, error: 'URL must include a protocol (https://).' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'URL must use http or https protocol.' };
  }

  // Reject embedded credentials (user:pass@host) — they hide the real destination
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URL must not contain authentication credentials.' };
  }

  // Reject private/loopback hosts (SSRF protection)
  if (isPrivateHost(parsed.hostname)) {
    return { valid: false, error: 'URL must point to a public web address.' };
  }

  return { valid: true };
}

/** Validate file upload: type and size. */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'File is required.' };
  }

  // 10 MB limit
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'File too large. Maximum size is 10 MB.' };
  }

  // Only accept PDF
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'Only PDF files are accepted.' };
  }

  return { valid: true };
}

/** Sanitize text input: strip control characters, limit length. */
export function sanitizeText(text: string, maxLength = 1000): string {
  if (!text || typeof text !== 'string') return '';
  // Remove control characters except newline and tab
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, maxLength)
    .trim();
}

/** Validate UUID format. */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Validate BCP 47 language code (simple check for our supported languages). */
export function isValidLanguageCode(code: string): boolean {
  return /^[a-z]{2,3}(-[A-Z]{2})?$/.test(code);
}
