import { describe, it, expect } from 'vitest';
import { CIVIC_SUMMARIZE_SYSTEM, CIVIC_SUMMARIZE_USER } from '@/lib/prompts/civic-summarize';
import { CIVIC_VERIFY_SYSTEM, CIVIC_VERIFY_USER } from '@/lib/prompts/civic-verify';
import { CIVIC_TRANSLATE_SYSTEM, CIVIC_TRANSLATE_USER } from '@/lib/prompts/civic-translate';

describe('civic prompts', () => {
  describe('summarize prompt', () => {
    it('system prompt instructs JSON output', () => {
      expect(CIVIC_SUMMARIZE_SYSTEM).toContain('JSON');
      expect(CIVIC_SUMMARIZE_SYSTEM).toContain('what_changed');
      expect(CIVIC_SUMMARIZE_SYSTEM).toContain('who_affected');
      expect(CIVIC_SUMMARIZE_SYSTEM).toContain('what_to_do');
      expect(CIVIC_SUMMARIZE_SYSTEM).toContain('deadlines');
    });

    it('system prompt enforces source-only information', () => {
      expect(CIVIC_SUMMARIZE_SYSTEM).toContain('ONLY information from the source document');
      expect(CIVIC_SUMMARIZE_SYSTEM).toContain('Never add general knowledge');
    });

    it('user prompt includes source text', () => {
      const prompt = CIVIC_SUMMARIZE_USER('Budget document text here');
      expect(prompt).toContain('Budget document text here');
      expect(prompt).toContain('SOURCE DOCUMENT');
    });

    it('system prompt includes money field', () => {
      expect(CIVIC_SUMMARIZE_SYSTEM).toContain('money');
    });

    it('system prompt includes key_quotes field', () => {
      expect(CIVIC_SUMMARIZE_SYSTEM).toContain('key_quotes');
    });
  });

  describe('verify prompt', () => {
    it('system prompt defines scoring thresholds', () => {
      expect(CIVIC_VERIFY_SYSTEM).toContain('confidence_score');
      expect(CIVIC_VERIFY_SYSTEM).toContain('0.90-1.00');
      expect(CIVIC_VERIFY_SYSTEM).toContain('0.70-0.89');
      expect(CIVIC_VERIFY_SYSTEM).toContain('verified_claims');
      expect(CIVIC_VERIFY_SYSTEM).toContain('unverified_claims');
    });

    it('system prompt acknowledges civic harm', () => {
      expect(CIVIC_VERIFY_SYSTEM).toContain('democratic harm');
    });

    it('user prompt includes both source and summary', () => {
      const prompt = CIVIC_VERIFY_USER('source text', '{"title": "test"}');
      expect(prompt).toContain('source text');
      expect(prompt).toContain('{"title": "test"}');
      expect(prompt).toContain('SOURCE DOCUMENT');
      expect(prompt).toContain('CIVIC SUMMARY TO VERIFY');
    });
  });

  describe('translate prompt', () => {
    it('system prompt preserves amounts and dates', () => {
      expect(CIVIC_TRANSLATE_SYSTEM).toContain('Preserve exact dollar amounts');
      expect(CIVIC_TRANSLATE_SYSTEM).toContain('proper nouns');
    });

    it('user prompt specifies target language', () => {
      const prompt = CIVIC_TRANSLATE_USER('{"title": "test"}', 'es', 'Spanish');
      expect(prompt).toContain('Spanish');
      expect(prompt).toContain('es');
    });
  });
});
