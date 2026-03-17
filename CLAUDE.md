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

- **Framework:** Next.js 16.1.6 (App Router, Turbopack)
- **Language:** TypeScript (strict mode)
- **Runtime:** React 19.2.4
- **Database:** Supabase (Postgres + PostGIS + pg_trgm). No Auth, no Storage for demo.
- **AI:** Claude API (Anthropic), model pinned to `claude-sonnet-4-20250514`, prompt version `civic-v1.0`
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

## CURRENT STATE (March 15, 2026)

- App code: BUILT. All pages, API routes, components, and database schema complete.
- Testing: 51 unit tests passing, 42 E2E tests passing.
- Supabase: Connected. All seed data loaded (1 country, 6 jurisdictions, 3 languages, 8 topics, 11 doc types).
- Anthropic API: Connected and verified.
- Landing page: Ported to /landing route.
- Build: `npm run build` passes clean.

### Remaining before April 15
- Test with real government PDFs end-to-end
- Mobile responsive polish
- Git commit and push (triggers Vercel deploy)
- README update for Mozilla reviewers
- FORCivicBrief.md project documentation

### Future phases (post-demo)
- Budget parsing and visualization
- Community verification UI
- Document feed monitoring (RSS/API)
- Topic subscriptions and notifications
- User accounts and saved jurisdictions
- PostGIS boundary polygons for all US states
- pgvector semantic search
- International jurisdiction trees (India, Nigeria, UK)

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
