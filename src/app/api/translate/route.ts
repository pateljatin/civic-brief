import { NextRequest, NextResponse } from 'next/server';
import { generateJSON, MODEL, PROMPT_VERSION } from '@/lib/anthropic';
import { getServerClient } from '@/lib/supabase';
import { CIVIC_TRANSLATE_SYSTEM, CIVIC_TRANSLATE_USER } from '@/lib/prompts/civic-translate';
import { isValidUUID, isValidLanguageCode, safeErrorMessage } from '@/lib/security';
import { rateLimitByIp } from '@/lib/rate-limit';
import type { CivicContent } from '@/lib/types';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  hi: 'Hindi',
};

export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimitByIp(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { briefId, targetLanguage } = body;

    if (!briefId || !targetLanguage) {
      return NextResponse.json(
        { error: 'briefId and targetLanguage are required.' },
        { status: 400 }
      );
    }

    if (!isValidUUID(briefId)) {
      return NextResponse.json({ error: 'Invalid briefId format.' }, { status: 400 });
    }

    if (!isValidLanguageCode(targetLanguage)) {
      return NextResponse.json({ error: 'Invalid language code format.' }, { status: 400 });
    }

    const languageName = LANGUAGE_NAMES[targetLanguage];
    if (!languageName) {
      return NextResponse.json(
        { error: `Unsupported language: ${targetLanguage}. Supported: ${Object.keys(LANGUAGE_NAMES).join(', ')}` },
        { status: 400 }
      );
    }

    const db = safeGetDb();
    if (!db) {
      return NextResponse.json(
        { error: 'Database not configured. Cannot translate without source brief.' },
        { status: 503 }
      );
    }

    // Fetch the source brief
    const { data: sourceBrief, error: fetchError } = await db
      .from('briefs')
      .select('id, source_id, content, language_id')
      .eq('id', briefId)
      .single();

    if (fetchError || !sourceBrief) {
      return NextResponse.json({ error: 'Brief not found.' }, { status: 404 });
    }

    // Resolve target language ID
    const { data: lang } = await db
      .from('languages')
      .select('id')
      .eq('bcp47', targetLanguage)
      .single();

    if (!lang) {
      return NextResponse.json(
        { error: `Language ${targetLanguage} not found in database.` },
        { status: 404 }
      );
    }

    // Check if translation already exists
    const { data: existing } = await db
      .from('briefs')
      .select('id, headline, content')
      .eq('source_id', sourceBrief.source_id)
      .eq('language_id', lang.id)
      .single();

    if (existing) {
      return NextResponse.json({
        briefId: existing.id,
        language: targetLanguage,
        headline: existing.headline,
        content: existing.content,
        cached: true,
      });
    }

    // Translate
    const translated = await generateJSON<CivicContent>(
      CIVIC_TRANSLATE_SYSTEM,
      CIVIC_TRANSLATE_USER(
        JSON.stringify(sourceBrief.content, null, 2),
        targetLanguage,
        languageName
      )
    );

    const summaryText = [
      translated.what_changed,
      translated.who_affected,
      translated.what_to_do,
      translated.money,
    ]
      .filter(Boolean)
      .join(' ');

    // Save translation
    const { data: newBrief, error: insertError } = await db
      .from('briefs')
      .insert({
        source_id: sourceBrief.source_id,
        language_id: lang.id,
        headline: translated.title,
        summary: summaryText,
        content: translated,
        who_affected: translated.who_affected,
        what_action: translated.what_to_do,
        is_published: true,
        published_at: new Date().toISOString(),
        model_used: MODEL,
        prompt_version: PROMPT_VERSION,
        tags: [translated.document_type].filter(Boolean),
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      briefId: newBrief.id,
      language: targetLanguage,
      headline: translated.title,
      content: translated,
    });
  } catch (error) {
    console.error('Translate error:', error);
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

function safeGetDb() {
  try {
    return getServerClient();
  } catch {
    return null;
  }
}
