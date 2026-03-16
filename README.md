# Civic Brief

**Plain language for public power.**

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
| AI | Claude API (claude-sonnet-4-20250514) | Civic-context summarization, verification, translation |
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

- **51 unit tests** covering components, PDF extraction, prompts, security, and types
- **42 E2E tests** (21 specs across desktop and mobile viewports) covering page loads, navigation, form behavior, accessibility (WCAG 2.1 AA via axe-core), security headers, and mobile responsiveness
- Accessibility scans on every page using axe-core
- Security header verification in E2E

## Project Structure

```
src/
  app/                    # Next.js App Router pages and API routes
    api/summarize/        # PDF upload -> civic brief pipeline
    api/translate/        # Translate brief to new language
    api/verify/           # Re-run factuality verification
    brief/[id]/           # Shareable civic brief page
    upload/               # Document upload interface
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

## Status

Working demo in development. [Mozilla Foundation Democracy x AI Incubator 2026](https://foundation.mozilla.org) applicant.

## Contributing

This is an open-source civic infrastructure project. Contributions welcome. See the issues tab for current work.

## License

MIT
