import { generateText, Output } from 'ai';
import { z } from 'zod';
import { infra } from '@/lib/ai/models';

export interface ToneResult {
  toneScore: number;
  jargonScore: number;
  jargonTerms: string[];
}

const ToneResponseSchema = z.object({
  toneScore: z.number().min(1).max(5),
  jargonScore: z.number().min(1).max(5),
  jargonTerms: z.array(z.string()),
});

const TONE_EVAL_PROMPT = `You are a plain-language evaluator for civic summaries. Score the following text on two dimensions.

**Tone (1-5):**
5 = Reads like a knowledgeable neighbor explaining local government over coffee
4 = Clear and accessible, minor stiffness
3 = Understandable but noticeably formal
2 = Reads like a government press release
1 = Reads like the original government document, dense and bureaucratic

**Jargon (1-5):**
5 = No jargon. A high school student would understand every word.
4 = One or two technical terms, but meaning is clear from context
3 = Several specialized terms that need explanation
2 = Frequently uses legal/government terminology without explanation
1 = Dense with unexplained technical, legal, or financial terms

**Jargon terms:** List any words or phrases a high school student would not understand.

Return JSON only.`;

/**
 * Evaluate a civic brief's tone and jargon level using Gemini Flash.
 * Returns scores (1-5) and a list of flagged jargon terms.
 */
export async function evaluateTone(briefText: string): Promise<ToneResult> {
  const result = await generateText({
    model: infra.evalTone,
    output: Output.object({ schema: ToneResponseSchema }),
    messages: [
      { role: 'system', content: TONE_EVAL_PROMPT },
      { role: 'user', content: briefText },
    ],
  });

  if (!result.output) {
    throw new Error('Gemini Flash returned no structured output for tone evaluation');
  }

  return result.output;
}
