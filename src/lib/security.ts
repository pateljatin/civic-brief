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

// ── Input Validation ──

/** Validate a URL is well-formed and uses http(s). Rejects javascript: and data: URIs. */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required.' };
  }

  if (url.length > 2048) {
    return { valid: false, error: 'URL is too long (max 2048 characters).' };
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }
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
