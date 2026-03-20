import { describe, it, expect } from 'vitest';
import {
  validateUrl,
  validateFile,
  sanitizeText,
  isValidUUID,
  isValidLanguageCode,
  rateLimitByUser,
} from '@/lib/security';

describe('security', () => {
  describe('validateUrl', () => {
    it('accepts valid https URLs', () => {
      expect(validateUrl('https://seattle.gov/budget.pdf').valid).toBe(true);
      expect(validateUrl('https://www.kingcounty.gov/docs/report.pdf').valid).toBe(true);
      expect(validateUrl('http://city.gov/minutes.html').valid).toBe(true);
    });

    it('rejects empty or missing URLs', () => {
      expect(validateUrl('').valid).toBe(false);
      expect(validateUrl(null as unknown as string).valid).toBe(false);
    });

    it('rejects javascript: protocol (XSS)', () => {
      expect(validateUrl('javascript:alert(1)').valid).toBe(false);
    });

    it('rejects data: protocol', () => {
      expect(validateUrl('data:text/html,<script>alert(1)</script>').valid).toBe(false);
    });

    it('rejects file: protocol', () => {
      expect(validateUrl('file:///etc/passwd').valid).toBe(false);
    });

    it('rejects URLs that are too long', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2100);
      expect(validateUrl(longUrl).valid).toBe(false);
    });

    it('rejects malformed URLs', () => {
      expect(validateUrl('not-a-url').valid).toBe(false);
      expect(validateUrl('://missing-protocol').valid).toBe(false);
    });
  });

  describe('sanitizeText', () => {
    it('returns clean text unchanged', () => {
      expect(sanitizeText('Hello world')).toBe('Hello world');
    });

    it('strips control characters', () => {
      expect(sanitizeText('Hello\x00World')).toBe('HelloWorld');
      expect(sanitizeText('Test\x08\x0Bdata')).toBe('Testdata');
    });

    it('preserves newlines and tabs', () => {
      expect(sanitizeText('Line 1\nLine 2')).toBe('Line 1\nLine 2');
      expect(sanitizeText('Col1\tCol2')).toBe('Col1\tCol2');
    });

    it('truncates to max length', () => {
      const long = 'a'.repeat(2000);
      expect(sanitizeText(long, 100).length).toBe(100);
    });

    it('handles null/undefined gracefully', () => {
      expect(sanitizeText(null as unknown as string)).toBe('');
      expect(sanitizeText(undefined as unknown as string)).toBe('');
    });

    it('trims whitespace', () => {
      expect(sanitizeText('  hello  ')).toBe('hello');
    });
  });

  describe('isValidUUID', () => {
    it('accepts valid UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('00000000-0000-0000-0000-000000000001')).toBe(true);
    });

    it('rejects invalid UUIDs', () => {
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
    });

    it('rejects SQL injection attempts', () => {
      expect(isValidUUID("'; DROP TABLE briefs; --")).toBe(false);
      expect(isValidUUID("1' OR '1'='1")).toBe(false);
    });
  });

  describe('isValidLanguageCode', () => {
    it('accepts valid BCP 47 codes', () => {
      expect(isValidLanguageCode('en')).toBe(true);
      expect(isValidLanguageCode('es')).toBe(true);
      expect(isValidLanguageCode('hi')).toBe(true);
      expect(isValidLanguageCode('zh')).toBe(true);
    });

    it('rejects invalid codes', () => {
      expect(isValidLanguageCode('')).toBe(false);
      expect(isValidLanguageCode('english')).toBe(false);
      expect(isValidLanguageCode('e')).toBe(false);
      expect(isValidLanguageCode('123')).toBe(false);
    });

    it('rejects injection attempts', () => {
      expect(isValidLanguageCode("en'; DROP TABLE")).toBe(false);
      expect(isValidLanguageCode('<script>')).toBe(false);
    });
  });

  describe('validateFile', () => {
    it('accepts valid PDF file', () => {
      const file = new File(['%PDF-1.4'], 'budget.pdf', { type: 'application/pdf' });
      expect(validateFile(file).valid).toBe(true);
    });

    it('rejects non-PDF files', () => {
      const file = new File(['hello'], 'script.js', { type: 'text/javascript' });
      expect(validateFile(file).valid).toBe(false);
    });

    it('rejects files that are too large', () => {
      const bigContent = new Uint8Array(11 * 1024 * 1024); // 11MB
      const file = new File([bigContent], 'big.pdf', { type: 'application/pdf' });
      expect(validateFile(file).valid).toBe(false);
    });

    it('rejects null file', () => {
      expect(validateFile(null as unknown as File).valid).toBe(false);
    });
  });

  describe('rateLimitByUser', () => {
    it('allows requests under the limit', () => {
      const result = rateLimitByUser('user-1', 5, 60000);
      expect(result).toBeNull();
    });

    it('blocks requests over the limit', () => {
      const userId = 'user-rate-test-' + Date.now();
      for (let i = 0; i < 5; i++) {
        rateLimitByUser(userId, 5, 60000);
      }
      const result = rateLimitByUser(userId, 5, 60000);
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it('tracks different users independently', () => {
      const userA = 'user-a-' + Date.now();
      const userB = 'user-b-' + Date.now();
      for (let i = 0; i < 5; i++) {
        rateLimitByUser(userA, 5, 60000);
      }
      expect(rateLimitByUser(userA, 5, 60000)).not.toBeNull();
      expect(rateLimitByUser(userB, 5, 60000)).toBeNull();
    });
  });
});
