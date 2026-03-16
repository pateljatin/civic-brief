import { describe, it, expect } from 'vitest';
import { hashText, PDFExtractionError } from '@/lib/pdf-extract';

describe('pdf-extract', () => {
  describe('hashText', () => {
    it('produces consistent SHA-256 hash for the same input', async () => {
      const hash1 = await hashText('hello world');
      const hash2 = await hashText('hello world');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', async () => {
      const hash1 = await hashText('hello world');
      const hash2 = await hashText('hello world!');
      expect(hash1).not.toBe(hash2);
    });

    it('returns a 64-character hex string (SHA-256)', async () => {
      const hash = await hashText('test');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('handles empty string', async () => {
      const hash = await hashText('');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('handles unicode content', async () => {
      const hash = await hashText('Audiencia publica del 22 de abril');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('PDFExtractionError', () => {
    it('has correct name and message', () => {
      const err = new PDFExtractionError('Test error');
      expect(err.name).toBe('PDFExtractionError');
      expect(err.message).toBe('Test error');
      expect(err).toBeInstanceOf(Error);
    });
  });
});
