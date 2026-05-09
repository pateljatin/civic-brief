/**
 * Backfill eval scores for existing briefs that have no eval data.
 *
 * Usage: npx tsx scripts/eval-briefs.ts [--dry-run] [--limit N]
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: GOOGLE_GENERATIVE_AI_API_KEY (for tone scoring; FK-only without it)
 */

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { scoreBriefSync, scoreBriefFull } from '../src/lib/eval';

loadEnv({ path: '.env.local', quiet: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 100;
const hasGemini = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

async function main() {
  console.log(`Backfill eval scores (dry-run: ${dryRun}, limit: ${limit}, gemini: ${hasGemini})`);

  const { data: briefs, error } = await db
    .from('briefs')
    .select('id, content, headline')
    .is('eval_overall_score', null)
    .eq('is_published', true)
    .eq('language_id', 1) // English briefs only
    .limit(limit);

  if (error) {
    console.error('Failed to fetch briefs:', error);
    process.exit(1);
  }

  console.log(`Found ${briefs.length} briefs to score`);

  for (const brief of briefs) {
    const content = brief.content as Record<string, unknown>;
    const text = [
      content.what_changed,
      content.who_affected,
      content.what_to_do,
      content.money,
    ]
      .filter(Boolean)
      .join(' ');

    if (!text) {
      console.log(`  [skip] ${brief.id} — no content text`);
      continue;
    }

    try {
      const result = hasGemini
        ? await scoreBriefFull(text)
        : scoreBriefSync(text);

      console.log(
        `  [${dryRun ? 'dry' : 'ok'}] ${brief.id} — ` +
        `grade: ${result.details.readabilityGrade}, ` +
        `tone: ${result.details.toneScore ?? 'n/a'}, ` +
        `overall: ${result.overallScore}`
      );

      if (!dryRun) {
        await db
          .from('briefs')
          .update({
            eval_overall_score: result.overallScore,
            eval_scored_at: new Date().toISOString(),
            eval_details: result.details,
          })
          .eq('id', brief.id);
      }

      // Rate limit: 1s between Gemini calls
      if (hasGemini) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error(`  [error] ${brief.id}:`, err);
    }
  }

  console.log('Done.');
}

main();
