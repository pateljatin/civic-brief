# Contributing to Civic Brief

Thanks for your interest in helping make civic information accessible. This guide covers how to set up, develop, and submit contributions.

## Getting Started

### Prerequisites

- Node.js 24+
- npm
- A [Supabase](https://supabase.com) project (free tier works)
- An [Anthropic API key](https://console.anthropic.com) (for testing summarization)

### Local Setup

1. Fork this repo and clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/civic-brief.git
cd civic-brief
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env.local` with your keys:

| Variable | Where to get it | Required |
|----------|----------------|----------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | Yes (AI features) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings | Yes (database) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings | Yes (database) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings | Yes (API routes) |
| `GOOGLE_GENERATIVE_AI_KEY` | [aistudio.google.com](https://aistudio.google.com) | No (eval only) |

The app works without Supabase configured. Upload and summarization still function; results just won't be persisted.

4. Start the dev server:

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## Development Workflow

We use **GitHub Flow**: feature branches off `main`, pull requests back to `main`.

1. Create a feature branch from `main`:

```bash
git checkout -b feature/your-feature-name
```

2. Make your changes. Run checks locally:

```bash
npm run typecheck    # TypeScript checks
npm test             # Unit tests (vitest)
npm run test:e2e     # E2E tests (Playwright)
```

3. Commit with a meaningful message. Push to your fork:

```bash
git push origin feature/your-feature-name
```

4. Open a pull request targeting `main`. Fill out the PR template.

### What Happens When You Open a PR

- **CI runs automatically**: TypeScript check, unit tests, build, E2E tests. All must pass.
- **Vercel deploys a preview**: PRs from repo branches get a unique preview URL with full functionality. The Vercel bot comments the link on your PR.
- **Review required**: At least one maintainer approval before merge.

**Note for fork PRs**: Vercel preview deployments from forks do not receive environment variables (security measure). Your CI tests still run via GitHub Actions. If a maintainer needs to test your PR with a full preview, they will pull your branch to the origin repo.

## Code Standards

- **TypeScript strict mode**. No `any` unless truly unavoidable.
- **Tests required** for new features. We use Vitest for unit tests and Playwright + axe-core for E2E.
- **Accessibility**: All pages must pass axe-core WCAG 2.1 AA scans.
- **No AI jargon** in user-facing text. No "AI-powered", "leverage", "seamless", "robust". Write like a builder.
- **No em-dashes**. Use commas, periods, or semicolons.
- **Data sourcing**: Every quantitative claim needs an inline citation with source, year, and URL.

## Next.js 16 Specifics

If you've worked with Next.js 14/15, note these differences:

- **params are Promises**: `const { id } = await params;` in page components
- **proxy.ts replaces middleware.ts**: Export a `proxy()` function, not `middleware()`
- **serverExternalPackages is top-level**: Not under `experimental` in next.config.js
- **Turbopack is default**: No `--turbopack` flag needed

## Project Structure

```
src/
  app/                    # Next.js App Router pages and API routes
    api/
      summarize/          # PDF upload -> civic brief pipeline
      translate/          # Translate brief to new language
      verify/             # Re-run factuality verification (auth required)
      feedback/           # Community feedback submission (auth required)
      location/           # Jurisdiction search with fuzzy matching
      cron/               # Scheduled jobs (ingest, digest, keepalive)
      internal/           # Worker endpoints (HMAC auth)
  lib/
    anthropic.ts          # Claude API client, generateJSON<T>() helper
    supabase.ts           # Server client (service role) + browser client
    pdf-extract.ts        # In-memory PDF extraction + SHA-256 hashing
    security.ts           # Input validation, error sanitization
    rate-limit.ts         # Persistent rate limiting (Supabase-backed)
    ssrf.ts               # SSRF protection, timing-safe comparison
    pipeline.ts           # Shared processCivicDocument() for manual + feed
    prompt-sanitize.ts    # Injection pattern stripping for AI prompts
    prompts/              # Civic-context AI prompts (summarize, verify, translate)
    feeds/                # Feed ingestion (RSS, Legistar, OpenStates)
    types.ts              # All TypeScript interfaces
  components/             # React components
tests/
  unit/                   # Vitest unit tests
  integration/            # Integration tests (mocked DB)
  e2e/                    # Playwright E2E + accessibility
supabase/
  migrations/             # Database schema (001-010)
  seed/                   # Demo data (jurisdictions, topics, languages)
scripts/
  snapshot.sh             # Backup script
  load-boundaries.ts      # Census TIGER boundary data loader
  test-rate-limit.ts      # Rate limit load tester
```

## Database

### Supabase Patterns

These patterns apply throughout the codebase:

- `.insert()` / `.update()` return `PromiseLike`, not `Promise`. Wrap in `Promise.resolve()` for fire-and-forget.
- Use `.maybeSingle()` when a result may not exist. `.single()` throws on 0 or 2+ rows.
- Service role key for all API route writes. RLS is defense-in-depth.

### Applying Migrations

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db query --linked -f supabase/migrations/010_rate_limits.sql
```

Migrations are in `supabase/migrations/` and numbered sequentially (001-010).

## Security

We take security seriously because civic misinformation is a democratic harm.

- **CSP, HSTS, X-Frame-Options** and other security headers via `next.config.js`
- **Rate limiting** with Supabase-backed persistence across serverless isolates
- **SSRF protection** with DNS resolution checks before any outbound fetch
- **Input validation** on all API routes (UUID, URL, file type, text sanitization)
- **Error sanitization**: API errors never leak internal details
- **Prompt injection defense**: XML delimiters and content sanitization on all AI prompts
- **HMAC authentication** on internal worker endpoints
- **Privacy by design**: We never store uploaded documents, collect PII, or set tracking cookies

## Civic-Context Prompting

This is what differentiates Civic Brief from generic summarization. Every prompt produces structured JSON answering:

1. **What changed?** The specific action, decision, or policy change
2. **Who is affected?** Which residents, businesses, groups
3. **What can you do?** Public comment periods, deadlines, how to participate
4. **Where does the money go?** Dollar amounts, budget line items, comparisons
5. **Key deadlines** Comment periods, effective dates, next meetings
6. **Context** How this compares to previous decisions

The model is instructed to only use source text, never general knowledge. Every claim must be traceable. The LLM-as-Judge verification step independently scores factuality.

## Reporting Issues

Use the [issue templates](https://github.com/pateljatin/civic-brief/issues/new/choose) for bug reports and feature requests.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
