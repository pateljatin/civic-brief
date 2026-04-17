# Civic Brief

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Mozilla Incubator](https://img.shields.io/badge/Mozilla-Democracy%20x%20AI-ff6611.svg)](https://foundation.mozilla.org)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-270%20passing-brightgreen.svg)](https://github.com/pateljatin/civic-brief)
[![E2E](https://img.shields.io/badge/E2E-84%20tests-brightgreen.svg)](https://github.com/pateljatin/civic-brief)
[![Accessibility](https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA-blue.svg)](https://www.w3.org/WAI/WCAG21/quickref/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/pateljatin/civic-brief/pulls)

**Plain language for public power.**

**See it live:** [civic-brief.vercel.app](https://civic-brief.vercel.app/) | [Five real government documents, summarized](https://civic-brief.vercel.app/showcase)

An open-source platform that turns government budgets, legislation, and policy documents into plain-language civic intelligence, in the languages communities actually speak.

## The Problem

Democracy assumes informed citizens. The infrastructure that informed them is collapsing. Over 3,500 US newspapers have closed in two decades. 213 counties have zero local news coverage. 50 million Americans have limited access to civic information.

Government documents are public. But a 400-page city budget PDF is not civic information. It is functionally invisible. And globally, civic information exists almost exclusively in dominant languages, structurally excluding hundreds of millions of democratic citizens.

Misinformation fills every gap real information leaves.

## How It Works

Upload a government PDF. Get a structured civic brief in seconds.

1. **Extract** -- PDF text is extracted in memory and immediately discarded (we never store your documents)
2. **Summarize** -- Claude analyzes the document with civic-context prompting: what changed, who is affected, what you can do, where the money goes, key deadlines
3. **Verify** -- A second, independent LLM-as-Judge pass scores the summary for factual accuracy and flags any unverified claims
4. **Translate** -- The civic brief is produced in English and Spanish simultaneously (Hindi ready, more languages planned)
5. **Link back** -- Every brief links to the original government source so you can verify for yourself

## What Makes This Different

This is not generic summarization. The system asks civic questions:

| Question | Why it matters |
|----------|---------------|
| **What changed?** | The specific action, decision, or policy change |
| **Who is affected?** | Which residents, businesses, or groups |
| **What can you do?** | Public comment periods, hearings, how to participate |
| **Where does the money go?** | Dollar amounts, budget line items, comparisons |
| **Key deadlines** | Comment periods, effective dates, next meetings |
| **Context** | How this compares to previous decisions |

Every claim is sourced from the document. The model is explicitly instructed to never use general knowledge. A confidence score tells you how much to trust the output.

## Architecture

```
                    +------------------+
                    |   Upload PDF     |
                    |   + Source URL    |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  In-memory text   |
                    |  extraction       |  (unpdf, then discarded)
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v---+  +------v------+  +----v--------+
     | Summarize  |  |   Verify    |  |  Translate  |
     | (Claude)   |  | (LLM Judge) |  |  (Claude)   |
     +--------+---+  +------+------+  +----+--------+
              |              |              |
              +--------------+--------------+
                             |
                    +--------v---------+
                    |  Civic Brief     |
                    |  (structured,    |
                    |   multilingual,  |
                    |   verified)      |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Supabase        |
                    |  (brief + source |
                    |   URL only)      |
                    +------------------+
```

### Privacy by design

- Documents are processed in memory and immediately discarded
- No user accounts. No login. No cookies. No tracking.
- We store only our generated briefs and the source URL
- All API responses include privacy headers
- Aggregate analytics only (Vercel Analytics)

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 (App Router) | Server components, API routes, Turbopack |
| Language | TypeScript (strict) | Type safety across the full stack |
| Database | Supabase (Postgres + PostGIS) | Global jurisdiction model with spatial queries |
| AI | Claude API (claude-sonnet-4-6) | Civic-context summarization, verification, translation |
| PDF | unpdf | In-memory extraction, no system dependencies |
| Testing | Vitest + Playwright + axe-core | Unit, E2E, and WCAG 2.1 AA accessibility |
| Hosting | Vercel | Auto-deploy, edge network, analytics |

## Database Design

The database models government jurisdictions globally using a self-referencing tree with PostGIS spatial columns. This means a single query can answer "what government bodies make decisions that affect this address?" at any level, from federal to city.

Key tables: `jurisdictions` (tree of government bodies), `sources` (references to documents we processed, never the documents themselves), `briefs` (our generated civic summaries), `topics` (civic topic taxonomy), `languages` (what languages each jurisdiction is served in).

Full-text search uses PostgreSQL tsvector with trigram indexes for fuzzy matching.

## Running Locally

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
#          NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Run development server
npm run dev

# Run unit tests
npm test

# Run E2E tests (starts dev server automatically)
npm run test:e2e

# Run all tests
npm run test:all

# Type check
npm run typecheck

# Production build
npm run build
```

## Testing

- **270 unit and integration tests** covering components, PDF extraction, prompts, security, types, auth, feed ingestion, pipeline, email alerts, and community feedback
- **84 E2E tests** (42 specs across desktop and mobile viewports) covering page loads, navigation, form behavior, showcase scenarios, accessibility (WCAG 2.1 AA via axe-core), security headers, and mobile responsiveness
- Accessibility scans on every page using axe-core
- Security header verification in E2E
- CI pipeline runs all checks on every PR (see `.github/workflows/ci.yml`)

## Project Structure

```
src/
  app/                    # Next.js App Router pages and API routes
    api/summarize/        # PDF upload -> civic brief pipeline
    api/translate/        # Translate brief to new language
    api/verify/           # Re-run factuality verification
    brief/[id]/           # Shareable civic brief page
    upload/               # Document upload interface
    showcase/             # Five real government document scenarios
    showcase/[scenario]/  # Individual scenario detail pages
    landing/              # Landing page
  lib/                    # Core libraries
    anthropic.ts          # Claude API client
    supabase.ts           # Database clients
    pdf-extract.ts        # In-memory PDF text extraction
    security.ts           # Rate limiting, input validation
    prompts/              # Civic-context AI prompts
    types.ts              # TypeScript interfaces
  components/             # React components
    UploadForm.tsx        # Drag-and-drop upload with progress
    CivicBrief.tsx        # Structured summary display
    ConfidenceScore.tsx   # Visual confidence badge
    LanguageToggle.tsx    # Language switcher
    SourceLink.tsx        # Source verification link
tests/
  unit/                   # Vitest unit tests
  e2e/                    # Playwright E2E + accessibility tests
supabase/
  migrations/             # Database schema (PostGIS, full-text search)
  seed/                   # Demo data (jurisdictions, topics, languages)
```

## Showcase

Five real government documents from across the US, processed through the full pipeline and live on the site. Each demonstrates a different type of civic document that affects people's daily lives.

| Document | Jurisdiction | What it covers |
|----------|-------------|----------------|
| [Philadelphia FY2026 Budget in Brief](https://civic-brief.vercel.app/showcase/budget) | Philadelphia, PA | A $6.7 billion city budget with tax cuts, 30,000 housing units, and a $421 million projected deficit |
| [APS 2040 Facility Recommendations](https://civic-brief.vercel.app/showcase/school-board) | Atlanta, GA | A unanimous vote to close 16 schools serving 50,000 students across 70,000 seats |
| [City of Yes for Housing Opportunity](https://civic-brief.vercel.app/showcase/zoning) | Brooklyn, New York City | NYC's most ambitious zoning reform in decades, with five of eight community boards voting against it |
| [California SB 40: Insulin Cost-Sharing](https://civic-brief.vercel.app/showcase/legislation) | California | A $35 insulin copay cap affecting 3.2 million Californians with diabetes |
| [CMS GUARD Model](https://civic-brief.vercel.app/showcase/drug-pricing) | US Federal | International reference pricing for Medicare drugs, with an open comment period |

Browse them all at [civic-brief.vercel.app/showcase](https://civic-brief.vercel.app/showcase).

## Roadmap

### Demo (April 2026) -- Complete
- [x] PDF upload and in-memory extraction
- [x] Civic-context summarization (Claude API)
- [x] English and Spanish output
- [x] LLM-as-Judge confidence scoring
- [x] Source document verification links
- [x] Google OAuth with usage tracking

### Next: Trust Loop (June 2026)
- [x] Automatic document feed ingestion (RSS, Legistar, OpenStates)
- [x] Community verification UI
- [ ] WhatsApp/SMS sharing

### Later
- [ ] Budget visualization and YoY comparison
- [ ] Location-based subscriptions
- [ ] International expansion

See the [project board](https://github.com/pateljatin/civic-brief/projects) and [full roadmap](docs/ROADMAP.md) for detailed tracking.

## Status

Working demo live at [civic-brief.vercel.app](https://civic-brief.vercel.app) with five real government documents in the [showcase](https://civic-brief.vercel.app/showcase). [Mozilla Foundation Democracy x AI Incubator 2026](https://foundation.mozilla.org) applicant.

## Contributing

This is an open-source civic infrastructure project. Contributions welcome.

**Getting started:**
1. Check the [issues tab](https://github.com/pateljatin/civic-brief/issues) for current work
2. Issues labeled [`good first issue`](https://github.com/pateljatin/civic-brief/labels/good%20first%20issue) are a great starting point
3. Every issue includes problem context, success criteria, and scope boundaries
4. Use the issue templates when filing bugs or requesting features
5. PRs are checked against our [product](docs/standards/PRODUCT_FUNDAMENTALS.md) and [engineering](docs/standards/ENGINEERING_FUNDAMENTALS.md) fundamentals

## Contact

civicbriefapp@gmail.com

## License

MIT
