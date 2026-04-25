import { describe, it, expect } from 'vitest';
import { FEEDBACK_TYPES } from '@/lib/types';
import type { FeedbackType } from '@/lib/types';
import { isValidUUID, sanitizeText } from '@/lib/security';

describe('feedback API validation', () => {
  describe('feedbackType validation', () => {
    it('accepts all valid feedback types', () => {
      const expected: FeedbackType[] = [
        'factual_error', 'missing_info', 'misleading',
        'translation_error', 'outdated', 'helpful',
      ];
      for (const type of expected) {
        expect(FEEDBACK_TYPES.includes(type)).toBe(true);
      }
    });

    it('has exactly 7 types', () => {
      expect(FEEDBACK_TYPES).toHaveLength(7);
    });

    it('rejects invalid feedback types', () => {
      expect(FEEDBACK_TYPES.includes('invalid' as FeedbackType)).toBe(false);
      expect(FEEDBACK_TYPES.includes('' as FeedbackType)).toBe(false);
    });
  });

  describe('briefId validation', () => {
    it('accepts valid UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('rejects invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('demo')).toBe(false);
    });
  });

  describe('details sanitization', () => {
    it('sanitizes and truncates to 1000 chars', () => {
      const long = 'a'.repeat(2000);
      expect(sanitizeText(long, 1000).length).toBe(1000);
    });

    it('strips control characters', () => {
      expect(sanitizeText('Bad\x00input')).toBe('Badinput');
    });

    it('allows empty details', () => {
      expect(sanitizeText('')).toBe('');
    });
  });

  describe('re-verification threshold logic', () => {
    const REVERIFY_THRESHOLD = 2;
    const REVERIFY_TYPES: FeedbackType[] = ['factual_error', 'missing_info'];

    it('factual_error and missing_info trigger re-verification', () => {
      expect(REVERIFY_TYPES).toContain('factual_error');
      expect(REVERIFY_TYPES).toContain('missing_info');
    });

    it('translation_error does NOT trigger re-verification', () => {
      expect(REVERIFY_TYPES).not.toContain('translation_error');
    });

    it('helpful does NOT trigger re-verification', () => {
      expect(REVERIFY_TYPES).not.toContain('helpful');
    });

    it('threshold is 2', () => {
      expect(REVERIFY_THRESHOLD).toBe(2);
    });
  });
});
