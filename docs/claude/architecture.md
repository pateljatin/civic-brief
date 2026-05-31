# Architecture Reference

## What We Are Building

An open-source platform that ingests government documents (budgets, legislation, meeting minutes, public notices) and produces plain-language civic intelligence in multiple languages.

Five components:
1. **Document ingestion pipeline** -- monitors government feeds, accepts PDF uploads
2. **Civic summarization engine** -- Claude API with civic-context prompting
3. **Budget visualization and tracking** -- parses financial data, YoY comparisons (future phase)
4. **AI quality assurance** -- LLM-as-Judge factuality scoring, confidence routing, community verification
5. **Public civic portal** -- mobile-first, shareable formats, source verification

## Repo Structure

```
civic-brief/
  src/
    proxy.ts                     # Next.js 16 proxy (privacy headers, cache control)
    app/
      layout.tsx                 # Root layout: Fraunces/Outfit fonts, Vercel Analytics, nav
      page.tsx                   # Home: hero, pipeline steps, stats
      upload/page.tsx            # Upload form + result display (client component)
      brief/[id]/page.tsx        # Individual civic brief (server component, async params)
      landing/page.tsx           # Landing page
      api/
        summarize/route.ts       # POST: PDF + sourceUrl -> civic brief pipeline
        translate/route.ts       # POST: translate existing brief to new language
        verify/route.ts          # POST: re-run LLM-as-Judge factuality check
    lib/
      anthropic.ts               # Claude API client, generateJSON<T>() helper
      supabase.ts                # Server client (service role) + browser client (anon key)
      pdf-extract.ts             # In-memory PDF extraction + SHA-256 hashing
      security.ts                # Rate limiting, input validation, URL/file/text sanitization
      pipeline.ts                # Shared processCivicDocument() for manual + feed paths
      types.ts                   # All TypeScript interfaces
      prompts/
        civic-summarize.ts       # Civic-context prompt, structured JSON output
        civic-translate.ts       # Translation with civic terminology preservation
        civic-verify.ts          # LLM-as-Judge factuality scoring
    components/
      UploadForm.tsx             # Drag-and-drop PDF + source URL + pipeline progress
      CivicBrief.tsx             # Structured summary display
      ConfidenceScore.tsx        # Visual badge: green/yellow/red
      LanguageToggle.tsx         # Language switcher (en/es/hi)
      SourceLink.tsx             # Link to original government document
  tests/
    unit/                        # Vitest: components, pdf-extract, prompts, security, types
    e2e/pages.spec.ts            # Playwright: 94 tests x 2 viewports
  supabase/migrations/           # 001-011 applied
  docs/
    claude/                      # This directory — reference docs loaded on demand
    superpowers/retros/          # Post-feature retros
```

## Civic-Context Prompting

The prompt (civic-v1.0) produces structured JSON answering:
1. **What changed?** -- The specific action, decision, or policy change
2. **Who is affected?** -- Which residents, businesses, groups
3. **What can you do?** -- Public comment periods, deadlines, how to participate
4. **Where does the money go?** -- Dollar amounts, budget line items, comparisons
5. **Key deadlines** -- Comment periods, effective dates, next meetings
6. **Context** -- How this compares to previous decisions, what it replaces

The model is instructed to ONLY use source text, never general knowledge. Every claim must be traceable.

## Next.js 16 Gotchas

- **params are Promises**: `const { id } = await params;` in page components
- **proxy.ts replaces middleware.ts**: Export `proxy()` function instead of `middleware()`
- **serverExternalPackages is top-level**: Not under `experimental` in next.config.js
- **Turbopack is default**: No `--turbopack` flag needed
- **React 19**: Concurrent features, use() hook available

## Current State (May 31, 2026)

- Main at `425eb64` — clean, working tree clean
- 407 unit/integration tests (Vitest), 94 E2E (Playwright), 0 type errors
- Next.js 16.2.4, React 19.2.5, AI SDK v6
- Migrations 001-011 applied on Supabase
- v1.1 Trust Loop ~85% complete; remaining: User Dashboard, #37, #65

## Milestones

- **v1.1 Trust Loop** (Jun 2026): User Dashboard, Supabase Performance Advisor (#37), security audit (#65)
- **v1.2 Subscriptions** (Sep 2026): Location alerts, budget viz, bill tracking, notifications
- **v2.0 Scale** (Mar 2027): International expansion, semantic search, newsroom embed, map viz
