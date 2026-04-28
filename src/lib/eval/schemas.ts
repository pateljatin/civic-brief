import { z } from 'zod';

/**
 * Shape stored in briefs.eval_details JSONB.
 * Tone fields are optional because FK readability is computed first (sync),
 * and Gemini tone scoring backfills async.
 */
export const EvalDetailsSchema = z.object({
  readabilityGrade: z.number(),
  readabilityEase: z.number(),
  toneScore: z.number().min(1).max(5).optional(),
  jargonScore: z.number().min(1).max(5).optional(),
  jargonTerms: z.array(z.string()).optional(),
  provider: z.string(),
});

export type EvalDetails = z.infer<typeof EvalDetailsSchema>;

/**
 * Full eval result including computed fields.
 * Used internally by the eval pipeline, not stored directly.
 */
export const EvalResultSchema = EvalDetailsSchema.extend({
  overallScore: z.number().min(0).max(1),
  scoredAt: z.string().datetime(),
});

export type EvalResult = z.infer<typeof EvalResultSchema>;
