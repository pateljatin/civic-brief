import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

// ─── Model versions (single source of truth) ───
// Update these when providers deprecate older versions.
// Override via env vars for runtime flexibility or testing.
const CIVIC_MODEL = process.env.CIVIC_MODEL ?? 'claude-sonnet-4.6';
const INFRA_MODEL = process.env.INFRA_MODEL ?? 'gemini-2.5-flash';

// Production models (trust-critical civic work)
// Currently for documentation and future use only. The existing pipeline
// uses src/lib/anthropic.ts directly. Wiring these into the pipeline
// is a separate future migration decision.
export const civic = {
  summarize: anthropic(CIVIC_MODEL),
  verify: anthropic(CIVIC_MODEL),
  translate: anthropic(CIVIC_MODEL),
} as const;

// Infrastructure models (cost-sensitive, isolated from production Anthropic quota)
export const infra = {
  evalVision: google(INFRA_MODEL),
  evalReadability: google(INFRA_MODEL),
  evalTone: google(INFRA_MODEL),
} as const;
