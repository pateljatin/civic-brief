import { describe, it, expect } from 'vitest';
import type {
  CivicContent,
  VerificationResult,
  SummarizeResponse,
  PipelineStep,
} from '@/lib/types';

describe('types', () => {
  it('CivicContent structure is valid', () => {
    const content: CivicContent = {
      title: 'Test Title',
      what_changed: 'Something changed',
      who_affected: 'Everyone',
      what_to_do: 'Comment at the hearing',
      money: '$1M allocated',
      deadlines: ['April 12: Comment deadline'],
      context: 'This follows prior decision',
      key_quotes: ['Quote from document'],
      document_type: 'budget',
    };
    expect(content.title).toBeTruthy();
    expect(content.deadlines).toHaveLength(1);
    expect(content.money).not.toBeNull();
  });

  it('CivicContent allows null money', () => {
    const content: CivicContent = {
      title: 'Test',
      what_changed: 'Change',
      who_affected: 'Affected',
      what_to_do: 'Action',
      money: null,
      deadlines: [],
      context: 'Context',
      key_quotes: [],
      document_type: 'resolution',
    };
    expect(content.money).toBeNull();
    expect(content.deadlines).toHaveLength(0);
  });

  it('VerificationResult confidence_level values are correct', () => {
    const highResult: VerificationResult = {
      confidence_score: 0.95,
      confidence_level: 'high',
      verified_claims: ['Claim 1'],
      unverified_claims: [],
      omitted_info: [],
      reasoning: 'All verified',
    };
    expect(highResult.confidence_level).toBe('high');
    expect(highResult.confidence_score).toBeGreaterThanOrEqual(0.8);

    const lowResult: VerificationResult = {
      confidence_score: 0.3,
      confidence_level: 'low',
      verified_claims: [],
      unverified_claims: ['Bad claim'],
      omitted_info: ['Missing key info'],
      reasoning: 'Major issues',
    };
    expect(lowResult.confidence_level).toBe('low');
    expect(lowResult.confidence_score).toBeLessThan(0.5);
  });

  it('PipelineStep has all expected values', () => {
    const steps: PipelineStep[] = [
      'extracting',
      'summarizing',
      'verifying',
      'translating',
      'saving',
      'complete',
      'error',
    ];
    expect(steps).toHaveLength(7);
  });

  it('SummarizeResponse structure includes translations', () => {
    const response: SummarizeResponse = {
      sourceId: '123',
      briefId: '456',
      brief: {
        headline: 'Test',
        summary: 'Summary',
        content: {
          title: 'Test',
          what_changed: 'Change',
          who_affected: 'People',
          what_to_do: 'Act',
          money: null,
          deadlines: [],
          context: 'Context',
          key_quotes: [],
          document_type: 'policy',
        },
        confidence_score: 0.85,
        confidence_level: 'high',
      },
      translations: [{ language: 'es', briefId: '789' }],
    };
    expect(response.translations).toHaveLength(1);
    expect(response.translations[0].language).toBe('es');
  });
});
