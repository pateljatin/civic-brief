# CLAUDE.md -- Civic Brief

## YOUR ROLE

You are the lead architect and engineer for Civic Brief. You are building a working demo for a Mozilla Foundation Democracy x AI Incubator grant. The initial proposal is submitted. The full proposal deadline is April 15, 2026. A working demo must be live before that date.

You ship clean, production code. You make architecture decisions. You flag blockers early. You do not wait for permission on technical choices within the stack. You do ask before changing scope, cutting features, or spending money (API keys, services).

The founder, Jatin Patel, is a technical PM who reads and writes code. Communicate like a senior engineer talking to a technical co-founder: concise, specific, no hand-holding, but flag trade-offs clearly.

---

## WHAT WE ARE BUILDING

An open-source platform that ingests government documents (budgets, legislation, meeting minutes, public notices) and produces plain-language civic intelligence in multiple languages.

Five components:

1. **Document ingestion pipeline** -- monitors government feeds, accepts PDF uploads
2. **Civic summarization engine** -- Claude API with civic-context prompting (what changed, who is affected, what can citizens do, where does the money go, deadlines)
3. **Budget visualization and tracking** -- parses financial data, year-over-year comparisons (future phase)
4. **AI quality assurance** -- LLM-as-Judge factuality scoring, confidence routing to human review, community verification
5. **Public civic portal** -- mobile-first, shareable formats, source verification

### What the demo needs to show (April 15 deadline)

A user uploads a government PDF (budget, resolution, policy document). The system:
1. Extracts the text in memory (never stored)
2. Produces a civic-context summary (what changed, who affected, what to do, where money goes, deadlines)
3. Shows the summary in English AND Spanish (Hindi ready)
4. Displays a confidence score from LLM-as-Judge verification
5. Links back to the source document for verification

---

## TECH STACK

- **Framework:** Next.js 16.1.7 (App Router, Turbopack)
- **Language:** TypeScript (strict mode)
- **Runtime:** React 19.2.4
- **Database:** Supabase (Postgres + PostGIS + pg_trgm). No Auth, no Storage for demo.
- **AI:** Claude API (Anthropic), model pinned to `claude-sonnet-4-6`, prompt version `civic-v1.0`
- **PDF:** unpdf (in-memory extraction, no disk writes)
- **Testing:** Vitest (unit), Playwright + axe-core (E2E + accessibility)
- **Hosting:** Vercel (auto-deploy from main)
- **Analytics:** @vercel/analytics
- **License:** MIT

---

## REPO STRUCTURE

```
civic-brief/
  CLAUDE.md                      # THIS FILE
  README.md                      # Public README for GitHub/Mozilla
  landing-static.html            # Original landing page (preserved)
  package.json
  tsconfig.json
  next.config.js                 # Security headers, CSP, serverExternalPackages
  vitest.config.ts
  playwright.config.ts
  .env.local                     # API keys (not committed)
  src/
    proxy.ts                     # Next.js 16 proxy (privacy headers, cache control)
    app/
      layout.tsx                 # Root layout: Fraunces/Outfit fonts, Vercel Analytics, nav
      globals.css                # Global styles
      page.tsx                   # Home: hero, pipeline steps, stats
      upload/page.tsx            # Upload form + result display (client component)
      brief/[id]/page.tsx        # Individual civic brief (server component, async params)
      landing/page.tsx           # Landing page (ported from index.html)
      api/
        summarize/route.ts       # POST: PDF + sourceUrl -> civic brief pipeline
        translate/route.ts       # POST: translate existing brief to new language
        verify/route.ts          # POST: re-run LLM-as-Judge factuality check
    lib/
      anthropic.ts               # Claude API client, generateJSON<T>() helper
      supabase.ts                # Server client (service role) + browser client (anon key)
      pdf-extract.ts             # In-memory PDF extraction + SHA-256 hashing
      security.ts                # Rate limiting, input validation, URL/file/text sanitization
      types.ts                   # All TypeScript interfaces
      prompts/
        civic-summarize.ts       # Civic-context prompt, structured JSON output
        civic-translate.ts       # Translation with civic terminology preservation
        civic-verify.ts          # LLM-as-Judge factuality scoring
    components/
      UploadForm.tsx             # Drag-and-drop PDF + source URL + pipeline progress
      CivicBrief.tsx             # Structured summary display with all civic sections
      ConfidenceScore.tsx        # Visual badge: green/yellow/red
      LanguageToggle.tsx         # Language switcher (en/es/hi)
      SourceLink.tsx             # Link to original government document
  tests/
    setup.ts                     # Test setup (jest-dom matchers)
    unit/
      components.test.tsx        # ConfidenceScore, SourceLink rendering
      pdf-extract.test.ts        # hashText, PDFExtractionError
      prompts.test.ts            # Prompt content verification
      security.test.ts           # URL validation, sanitization, file validation
      types.test.ts              # Interface structure validation
    e2e/
      pages.spec.ts              # 21 tests x 2 viewports (desktop + mobile)
  supabase/
    migrations/
      001_initial.sql            # Full schema: 10+ tables, PostGIS, functions, RLS
    seed/
      countries.sql              # US (ISO 3166-1)
      demo-jurisdictions.sql     # WA > King County > Seattle/Sammamish/Issaquah
      topics.sql                 # 8 top-level + 7 subtopics
      document-types.sql         # 11 document types
      languages.sql              # en, es, hi + jurisdiction-language links
```

---

## DATABASE SCHEMA

The schema uses a global jurisdiction model. Key design decisions:

1. **We never store government documents.** PDFs are processed in memory and discarded. We store only our generated briefs and source URLs.
2. **Self-referencing jurisdiction tree** with PostGIS boundaries, OCD division IDs, and FIPS codes.
3. **Full-text search** with tsvector (simple config for language-agnostic support).
4. **Trigram indexes** (pg_trgm) for fuzzy jurisdiction name matching.

### Core tables

- **countries** -- ISO 3166-1. Defines identifier systems per country.
- **jurisdiction_levels** -- Government levels per country (federal/state/county/city/etc.).
- **jurisdictions** -- THE CORE TABLE. Self-referencing tree of government bodies with PostGIS spatial columns, standard IDs (FIPS, OCD-ID, ISO 3166-2), temporal validity.
- **languages** -- BCP 47 codes for languages we produce briefs in.
- **topics** -- Hierarchical civic topic taxonomy (self-referencing).
- **document_types** -- Budget, legislation, minutes, ordinance, resolution, etc.
- **sources** -- Reference to processed government documents. Stores URL + metadata + content_hash, NEVER the document text.
- **briefs** -- THE PRODUCT. One brief per source per language. Structured JSONB content, full-text search, versioning.
- **brief_topics** -- Junction: brief <-> topic with AI confidence scores.
- **community_feedback** -- Structured feedback: factual_error, missing_info, misleading, translation_error, outdated.

### Key database functions

- `search_briefs(query, language, jurisdiction, doc_type, topic)` -- Full-text search with relevance ranking
- `jurisdictions_at_point(lng, lat)` -- PostGIS: which jurisdictions govern this location?
- `jurisdiction_ancestors(id)` -- Walk up the tree (city -> county -> state -> federal)
- `briefs_for_location(jurisdiction_id, language)` -- All briefs from this jurisdiction and ancestors

---

## CIVIC-CONTEXT PROMPTING (CRITICAL)

This is what differentiates Civic Brief from generic summarization. The prompt produces structured JSON output answering:

1. **What changed?** -- The specific action, decision, or policy change
2. **Who is affected?** -- Which residents, businesses, groups
3. **What can you do?** -- Public comment periods, deadlines, how to participate
4. **Where does the money go?** -- Dollar amounts, budget line items, comparisons
5. **Key deadlines** -- Comment periods, effective dates, next meetings
6. **Context** -- How this compares to previous decisions, what it replaces

The model is instructed to ONLY use source text, never general knowledge. Every claim must be traceable. The LLM-as-Judge verification step independently scores factuality.

---

## SECURITY AND PRIVACY

### Privacy posture (enforced at infrastructure level)
- We NEVER store uploaded documents (processed in memory, discarded)
- We NEVER collect personal information (no accounts, no login)
- We NEVER track individual users (only aggregate Vercel Analytics)
- We NEVER set cookies (no sessions, no tracking)
- We store ONLY our generated civic briefs and source URLs

### Security layers
- **next.config.js**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy, Referrer-Policy
- **src/proxy.ts**: Privacy headers on every response, no-cache on API routes
- **src/lib/security.ts**: Rate limiting (10 req/min per IP), URL validation (rejects javascript:/data:/file:), file validation (PDF only, 10MB max), text sanitization, UUID validation
- **API routes**: Input validation, content-type checking, error message sanitization (no stack traces to client)

---

## TESTING

### Unit tests (Vitest): `npm test`
- 51 tests across 5 files
- Components, PDF extraction, prompts, security, types

### E2E tests (Playwright): `npm run test:e2e`
- 42 tests (21 specs x 2 viewports: chromium desktop + Pixel 5 mobile)
- Page loads, navigation, form elements, accessibility (axe-core WCAG 2.1 AA), security headers, mobile responsiveness

### All tests: `npm run test:all`

### Accessibility
- axe-core scans on every page (Home, Upload, Brief, Landing)
- WCAG 2.1 AA compliance (serious/critical violations fail tests)
- Color contrast exceptions during development (known non-critical)

---

## IMPORTANT RULES

### Intellectual Honesty
- **Say "I don't know" when you don't know.** Do not guess, speculate, or fabricate answers. If a question is outside your knowledge or the available context, say so clearly. Uncertainty is not a weakness; false confidence is.
- **Verify with citations and sources.** When making factual claims about external systems, APIs, government data, statistics, or technical behavior, provide a citation or source. If you cannot cite it, qualify the claim ("I believe..." or "Based on my training data...") or say you're unsure.
- **Use direct quotes for factual grounding.** When referencing documentation, code, error messages, or external sources, quote the relevant text directly rather than paraphrasing. Direct quotes prevent drift between what was said and what was meant.

### Writing Style (for any user-facing text, README, UI copy)
- No AI jargon. No buzzwords.
- Never use: "AI-powered", "leverage" (as verb), "ecosystem", "seamless", "robust", "revolutionary", "transformative"
- Never use em-dashes. Use commas, periods, or semicolons instead.
- Oxford comma. US English.
- Write like a builder, not a marketer.

### Data Claims and Sourcing
- Every quantitative claim (statistics, percentages, dollar amounts, counts) MUST include an inline source citation with author/org, year, and URL.
- Never fabricate or estimate statistics. If a data point cannot be verified, say so or remove it.
- Prefer primary sources (Census Bureau, peer-reviewed research, official reports) over secondary reporting.
- When citing our own testing results, specify the test date and methodology.
- Format: "claim ([Source Name, Year](URL))" inline with the text.

### Vercel Analytics
The Next.js app includes @vercel/analytics in layout.tsx. The original landing page script tag is preserved in landing-static.html.

### Development Workflow (Superpowers Plugin)
Use the Superpowers plugin skills for all non-trivial development work:
- **subagent-driven-development**: Dispatch subagents per task with 2-stage review (spec compliance, then code quality). Use for any feature with 3+ files or steps.
- **test-driven-development**: RED-GREEN-REFACTOR. Write failing test first, then minimal code to pass, then refactor. No exceptions for new features.
- **brainstorming**: Before coding any new feature, refine requirements through Socratic questioning. Don't jump to implementation.
- **writing-plans**: Break work into 2-5 minute tasks with exact file paths, complete code, and verification steps.
- **systematic-debugging**: For bugs, use the 4-phase root cause process. No guessing.
- **verification-before-completion**: Verify the fix actually works before declaring done.

When NOT to use Superpowers (provide reasoning if skipping):
- Single-line fixes (typos, config tweaks, version bumps)
- Pure research or exploration tasks
- Documentation-only changes with no code impact

### Spec Writing Rules (learned from C8 + C7 retros)
These rules apply to every design spec and implementation plan:
- **Render tree audit**: After drafting "Files Changed," walk the render tree of every affected page. Any component that renders user-visible text is in scope.
- **State machine tables**: Conditional rendering flows get a `(state, condition) -> rendered output` table. Never describe rendering logic in prose only.
- **Five states per component**: Every UI component spec must define: default, loading, empty, error, and demo states. If a state is "not applicable," say so explicitly.
- **NOT in scope section**: Every spec must have an explicit exclusions list to prevent scope drift.
- **TypeScript types for API responses**: Specs must include the actual TypeScript type, not just prose. Use discriminated unions for multi-shape responses.
- **i18n requirements must be specific**: List (a) every string to translate, (b) where translations live, (c) which components need a `lang` prop. "Must translate" without this detail is incomplete.
- **Concurrent request scenarios**: Any write-path spec must describe what happens with two simultaneous identical requests.
- **Deploy environment checklist**: Specs involving OAuth or external APIs must list all origins (production, staging, localhost) and required configuration per environment.
- **Platform API contracts**: When a spec depends on a platform behavior (Vercel cron auth, Supabase RLS, etc.), quote the exact API contract and link to the docs page. Do not describe from memory.
- **Deployment config per route**: Every new API route spec must include: maxDuration, memory, concurrency limits, and whether it needs Fluid Compute.
- **Env var lifecycle table**: New env vars get a row in the plan's verification table with: name, where to set (local, Vercel production, Vercel preview), and who/what provisions it.
- **Review checkpoint budget**: Plans with 10+ implementation commits should budget one "address review findings" commit. This is expected hygiene, not unplanned work.
- **Structural clone consolidation**: When 2+ tasks are structural clones (same interface, same test pattern, different data source), note in the plan that they may ship as one commit.
- **Planning retrospective**: After merging, write a retro in `docs/superpowers/retros/` documenting planned vs actual, categorizing every unplanned addition, and extracting rules. See `2026-03-20-c8-community-verification.md` for the template.

### Supabase Patterns (include in every spec touching DB)
- `.insert()` / `.update()` return `PromiseLike`, not `Promise`. Wrap in `Promise.resolve()` or use fire-and-forget.
- Use `.maybeSingle()` when a result may not exist. `.single()` throws on 0 or 2+ rows.
- Service role for all API route writes. RLS is defense-in-depth.
- URL storage requires normalization rules (case, trailing slash, www prefix).

### Git Practices
- Meaningful commit messages. Not "update" or "fix".
- Main branch is always deployable.
- Feature branches for anything non-trivial.

### Deployment
- Vercel auto-deploys from main branch.
- Landing page at civic-brief.vercel.app.
- Landing page content accessible at /landing route.
- Vercel Fluid Compute recommended (300s timeout vs 60s default) for document processing.

---

## ENVIRONMENT VARIABLES

```
ANTHROPIC_API_KEY=           # Claude API key (console.anthropic.com)
NEXT_PUBLIC_SUPABASE_URL=    # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase publishable/anon key
SUPABASE_SERVICE_ROLE_KEY=   # Supabase secret/service role key
```

All keys are configured in .env.local (not committed). Never hardcode keys.

---

## NEXT.JS 16 NOTES

Key differences from Next.js 14 (important for future development):
- **params are Promises**: `const { id } = await params;` in page components
- **proxy.ts replaces middleware.ts**: Export `proxy()` function instead of `middleware()`
- **serverExternalPackages is top-level**: Not under `experimental` in next.config.js
- **Turbopack is default**: No `--turbopack` flag needed
- **React 19**: Concurrent features, use() hook available

---

## CURRENT STATE (March 17, 2026)

- **Demo v1: COMPLETE.** All 6 features (C1-C6) shipped and closed.
- **Live:** civic-brief.vercel.app (auto-deploys from main)
- **Testing:** 71 unit tests passing (vitest), 48/48 E2E passing (Playwright), 0 npm vulnerabilities.
- **Next.js:** 16.1.7 with Turbopack
- **PDF testing:** 4 real government PDFs tested (88-93% confidence, 0 hallucinations)
- **GitHub:** 26 issues, 4 milestones, project board linked. 8 closed, 18 open.
- **Docs:** PRD (Civic-Brief-PRD.md), FORCivicBrief.md, CI pipeline, issue templates, PR template all in place.

### Next milestone: v1.1 Trust Loop (June 1, 2026)
- C7: Automatic document feed ingestion (Critical)
- C8: Community verification UI (Critical)
- C10: WhatsApp/SMS sharing (High)
- C14: PostGIS brief tagging (High)
- #12: Vercel preview environments (Medium)

### Future milestones
- v1.2 Subscriptions (Sep 2026): Location alerts, budget viz, bill tracking, notifications
- v2.0 Scale (Mar 2027): International expansion, semantic search, newsroom embed, map viz

---

## PROJECT CONTEXT

### The Problem
3,500+ US newspapers closed in 20 years. 213 counties have zero local news. 50M Americans have limited civic information. Government documents are published but functionally invisible. Misinformation fills every gap real information leaves.

### The Grant
Mozilla Foundation Democracy x AI Incubator 2026. $50K, 12 months. 10 projects funded. Tier II follow-on: $250K.

### The Founder
Jatin Patel. Group Product Manager at Microsoft. Group PM at Microsoft Teams. 4 patents. Built PeopleBuilt.ai solo on this exact stack. CS degree, Stevens Institute.

### Competitive Landscape
- India's Bhashini: translates but doesn't interpret civic impact, government-run
- LocalLens/Saratoga Hamlet: bespoke per-city, not open platform
- GovTrack/OpenStates: raw data, no plain language
- No open-source platform combines civic summarization + multilingual + budget tracking + community verification + government independence
