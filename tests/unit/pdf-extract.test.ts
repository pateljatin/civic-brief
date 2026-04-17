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
    it('has correct name, message, and code', () => {
      const err = new PDFExtractionError('Test error', 'CORRUPTED');
      expect(err.name).toBe('PDFExtractionError');
      expect(err.message).toBe('Test error');
      expect(err.code).toBe('CORRUPTED');
      expect(err).toBeInstanceOf(Error);
    });

    it('stores the correct code for each error type', () => {
      expect(new PDFExtractionError('msg', 'FILE_TOO_LARGE').code).toBe('FILE_TOO_LARGE');
      expect(new PDFExtractionError('msg', 'PASSWORD_PROTECTED').code).toBe('PASSWORD_PROTECTED');
      expect(new PDFExtractionError('msg', 'SCANNED_IMAGE').code).toBe('SCANNED_IMAGE');
      expect(new PDFExtractionError('msg', 'NOT_A_PDF').code).toBe('NOT_A_PDF');
      expect(new PDFExtractionError('msg', 'EXTRACTION_FAILED').code).toBe('EXTRACTION_FAILED');
      expect(new PDFExtractionError('msg', 'FILE_TOO_SMALL').code).toBe('FILE_TOO_SMALL');
    });
  });
});
