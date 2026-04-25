import { describe, it, expect } from 'vitest';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { infra } from '@/lib/ai/models';

const hasGeminiKey = !!process.env.GOOGLE_GENERATIVE_AI_KEY;

describe.skipIf(!hasGeminiKey)('Gemini Flash smoke test', () => {
  it('returns structured JSON matching a Zod schema', async () => {
    const TestSchema = z.object({
      greeting: z.string(),
      wordCount: z.number(),
    });

    const result = await generateText({
      model: infra.evalVision,
      output: Output.object({ schema: TestSchema }),
      messages: [
        {
          role: 'user',
          content: 'Say hello in exactly 3 words. Return as JSON with "greeting" (the 3 words) and "wordCount" (the number 3).',
        },
      ],
    });

    expect(result.output).toBeDefined();
    expect(typeof result.output!.greeting).toBe('string');
    expect(result.output!.wordCount).toBe(3);
  }, 30000);
});

describe.skipIf(hasGeminiKey)('Gemini Flash without API key', () => {
  it('skips when GOOGLE_GENERATIVE_AI_KEY is not set', () => {
    expect(hasGeminiKey).toBe(false);
  });
});
