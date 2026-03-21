import dns from 'dns';
import crypto from 'crypto';

/**
 * SSRF Protection Module
 *
 * Feed workers fetch URLs discovered inside RSS/Atom feeds. An attacker who
 * poisons a feed could point us at cloud metadata endpoints (169.254.169.254)
 * or internal services. This module prevents that by validating resolved IPs
 * before any outbound fetch is made.
 */

/**
 * Returns true if the IP address falls within a private, loopback, link-local,
 * or otherwise non-routable range. Supports both IPv4 and IPv6.
 */
export function isPrivateIp(ip: string): boolean {
  const trimmed = ip.trim();

  // ── IPv6 ──────────────────────────────────────────────────────────────────
  if (trimmed.includes(':')) {
    return isPrivateIpv6(trimmed);
  }

  // ── IPv4 ──────────────────────────────────────────────────────────────────
  return isPrivateIpv4(trimmed);
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  const octets = parts.map(Number);
  if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return false;

  const [a, b] = octets;

  // 0.0.0.0
  if (a === 0 && octets[1] === 0 && octets[2] === 0 && octets[3] === 0) return true;

  // 127.0.0.0/8 — loopback
  if (a === 127) return true;

  // 10.0.0.0/8 — private class A
  if (a === 10) return true;

  // 172.16.0.0/12 — private class B (172.16.x.x – 172.31.x.x)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 — private class C
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 — link-local (AWS/GCP/Azure metadata endpoint lives here)
  if (a === 169 && b === 254) return true;

  return false;
}

function isPrivateIpv6(ip: string): boolean {
  // Normalize to lowercase for prefix checks
  const lower = ip.toLowerCase();

  // ::1 — loopback
  if (lower === '::1') return true;

  // fc00::/7 — unique local addresses (fc00:: through fdff::)
  // The /7 covers both fc and fd prefixes
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

  // fe80::/10 — link-local (fe80:: through febf::)
  // Second hex digit must be 8-b to land in /10: fe80, fe90, fea0, feb0 are all /10
  if (lower.startsWith('fe8') || lower.startsWith('fe9') ||
      lower.startsWith('fea') || lower.startsWith('feb')) return true;

  return false;
}

/**
 * Validates that a URL is safe for our server to fetch.
 *
 * Checks (in order):
 * 1. Parseable URL
 * 2. HTTPS protocol only
 * 3. No auth components (user:pass@host)
 * 4. Only standard port (443 or omitted)
 * 5. DNS resolution — rejects if resolved IP is private/internal
 */
export async function validateFetchTarget(
  url: string
): Promise<{ valid: boolean; error?: string }> {
  if (!url) {
    return { valid: false, error: 'URL is required.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  // Require HTTPS
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'URL must use HTTPS protocol.' };
  }

  // Reject auth components
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URL must not contain auth components (user:pass@host).' };
  }

  // Only allow default/omitted port or explicit 443
  const port = parsed.port;
  if (port !== '' && port !== '443') {
    return { valid: false, error: `Non-standard port ${port} is not allowed.` };
  }

  // DNS resolution — check resolved IP
  let resolvedAddress: string;
  try {
    const result = await dns.promises.lookup(parsed.hostname);
    resolvedAddress = result.address;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `DNS resolution failed: ${message}` };
  }

  if (isPrivateIp(resolvedAddress)) {
    return {
      valid: false,
      error: `URL resolves to a private/internal IP address (${resolvedAddress}).`,
    };
  }

  return { valid: true };
}

/**
 * Constant-time string comparison. Prevents timing attacks when comparing
 * secrets such as HMAC signatures on webhook payloads.
 *
 * Returns false (never throws) when lengths differ.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  // crypto.timingSafeEqual requires equal-length buffers.
  // We must still do the comparison to avoid leaking length via timing, but
  // a length mismatch is always false.
  if (bufA.length !== bufB.length) {
    // Compare against itself so we spend roughly the same time regardless
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}
