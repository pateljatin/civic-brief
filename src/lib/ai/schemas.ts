import { z } from 'zod';

// ─── Eval Vision (C16: design/layout compliance via screenshot) ───

export const EvalVisionResultSchema = z.object({
  route: z.string(),
  layoutScore: z.number().min(1).max(5),
  colorCompliance: z.boolean(),
  fontCompliance: z.boolean(),
  mobileResponsive: z.boolean(),
  issues: z.array(z.string()),
  overall: z.enum(['pass', 'fail', 'warning']),
});

export type EvalVisionResult = z.infer<typeof EvalVisionResultSchema>;

// ─── Eval Tone (C16: readability, jargon, and tone scoring) ───

export const EvalToneResultSchema = z.object({
  briefId: z.string(),
  toneScore: z.number().min(1).max(5),
  jargonScore: z.number().min(1).max(5),
  jargonTerms: z.array(z.string()),
  readabilityGrade: z.number(),
  overall: z.enum(['pass', 'fail', 'warning']),
});

export type EvalToneResult = z.infer<typeof EvalToneResultSchema>;
