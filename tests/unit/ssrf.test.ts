import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import dns from 'dns';

// Must import after vi is available — we'll mock dns.promises.lookup
import { isPrivateIp, validateFetchTarget, timingSafeCompare } from '@/lib/ssrf';

describe('ssrf', () => {
  describe('isPrivateIp', () => {
    // IPv4 loopback
    it('rejects 127.0.0.1 (loopback)', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
    });

    it('rejects 127.x.x.x range', () => {
      expect(isPrivateIp('127.255.255.255')).toBe(true);
      expect(isPrivateIp('127.0.0.0')).toBe(true);
      expect(isPrivateIp('127.100.50.1')).toBe(true);
    });

    // IPv4 private class A
    it('rejects 10.x.x.x (private class A)', () => {
      expect(isPrivateIp('10.0.0.0')).toBe(true);
      expect(isPrivateIp('10.255.255.255')).toBe(true);
      expect(isPrivateIp('10.42.0.1')).toBe(true);
    });

    // IPv4 private class B
    it('rejects 172.16-31.x.x (private class B)', () => {
      expect(isPrivateIp('172.16.0.0')).toBe(true);
      expect(isPrivateIp('172.16.0.1')).toBe(true);
      expect(isPrivateIp('172.20.5.10')).toBe(true);
      expect(isPrivateIp('172.31.255.255')).toBe(true);
    });

    it('allows 172.15.x.x and 172.32.x.x (not private)', () => {
      expect(isPrivateIp('172.15.0.1')).toBe(false);
      expect(isPrivateIp('172.32.0.1')).toBe(false);
      expect(isPrivateIp('172.15.255.255')).toBe(false);
    });

    // IPv4 private class C
    it('rejects 192.168.x.x (private class C)', () => {
      expect(isPrivateIp('192.168.0.0')).toBe(true);
      expect(isPrivateIp('192.168.1.1')).toBe(true);
      expect(isPrivateIp('192.168.255.255')).toBe(true);
    });

    // Link-local / cloud metadata
    it('rejects 169.254.x.x (link-local / cloud metadata)', () => {
      expect(isPrivateIp('169.254.169.254')).toBe(true); // AWS metadata endpoint
      expect(isPrivateIp('169.254.0.1')).toBe(true);
      expect(isPrivateIp('169.254.255.255')).toBe(true);
    });

    it('rejects 0.0.0.0', () => {
      expect(isPrivateIp('0.0.0.0')).toBe(true);
    });

    // IPv6
    it('rejects ::1 (IPv6 loopback)', () => {
      expect(isPrivateIp('::1')).toBe(true);
    });

    it('rejects fc00::/7 unique local (fc00::1 and fd00::1)', () => {
      expect(isPrivateIp('fc00::1')).toBe(true);
      expect(isPrivateIp('fd00::1')).toBe(true);
      expect(isPrivateIp('fc00::')).toBe(true);
      expect(isPrivateIp('fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(true);
    });

    it('rejects fe80::/10 link-local', () => {
      expect(isPrivateIp('fe80::1')).toBe(true);
      expect(isPrivateIp('fe80::')).toBe(true);
      expect(isPrivateIp('febf::1')).toBe(true);
    });

    // Public IPs
    it('allows valid public IPs (8.8.8.8, 151.101.1.69)', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('8.8.4.4')).toBe(false);
      expect(isPrivateIp('151.101.1.69')).toBe(false);
      expect(isPrivateIp('1.1.1.1')).toBe(false);
      expect(isPrivateIp('93.184.216.34')).toBe(false);
    });

    it('allows valid public IPv6', () => {
      expect(isPrivateIp('2001:4860:4860::8888')).toBe(false); // Google DNS
      expect(isPrivateIp('2606:4700:4700::1111')).toBe(false); // Cloudflare DNS
    });
  });

  describe('validateFetchTarget', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('rejects HTTP (non-HTTPS) URLs', async () => {
      const result = await validateFetchTarget('http://example.com/feed.xml');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/https/i);
    });

    it('rejects URLs with auth components', async () => {
      const result = await validateFetchTarget('https://user:pass@example.com/feed.xml');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/auth/i);
    });

    it('rejects non-standard ports', async () => {
      const result = await validateFetchTarget('https://example.com:8080/feed.xml');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/port/i);
    });

    it('allows standard HTTPS port 443', async () => {
      vi.spyOn(dns.promises, 'lookup').mockResolvedValue({ address: '93.184.216.34', family: 4 });
      const result = await validateFetchTarget('https://example.com:443/feed.xml');
      expect(result.valid).toBe(true);
    });

    it('allows HTTPS with no explicit port', async () => {
      vi.spyOn(dns.promises, 'lookup').mockResolvedValue({ address: '93.184.216.34', family: 4 });
      const result = await validateFetchTarget('https://example.com/feed.xml');
      expect(result.valid).toBe(true);
    });

    it('rejects URLs that DNS-resolve to private IPs', async () => {
      vi.spyOn(dns.promises, 'lookup').mockResolvedValue({ address: '127.0.0.1', family: 4 });
      const result = await validateFetchTarget('https://evil.example.com/feed.xml');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/private|internal/i);
    });

    it('rejects URLs that DNS-resolve to cloud metadata IP', async () => {
      vi.spyOn(dns.promises, 'lookup').mockResolvedValue({ address: '169.254.169.254', family: 4 });
      const result = await validateFetchTarget('https://metadata.evil.com/feed.xml');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/private|internal/i);
    });

    it('handles DNS resolution failure gracefully', async () => {
      vi.spyOn(dns.promises, 'lookup').mockRejectedValue(new Error('ENOTFOUND'));
      const result = await validateFetchTarget('https://nonexistent.invalid/feed.xml');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/dns|resolv/i);
    });

    it('rejects invalid URLs', async () => {
      const result = await validateFetchTarget('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/invalid|url/i);
    });

    it('rejects empty string', async () => {
      const result = await validateFetchTarget('');
      expect(result.valid).toBe(false);
    });
  });

  describe('timingSafeCompare', () => {
    it('returns true for matching strings', () => {
      expect(timingSafeCompare('abc123', 'abc123')).toBe(true);
      expect(timingSafeCompare('', '')).toBe(true);
    });

    it('returns false for non-matching strings', () => {
      expect(timingSafeCompare('abc123', 'abc124')).toBe(false);
      expect(timingSafeCompare('hello', 'world')).toBe(false);
    });

    it('returns false for different length strings', () => {
      expect(timingSafeCompare('abc', 'abcd')).toBe(false);
      expect(timingSafeCompare('longer', 'short')).toBe(false);
    });
  });
});
