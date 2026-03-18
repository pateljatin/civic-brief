# Contributing to Civic Brief

Thanks for your interest in helping make civic information accessible. This guide covers how to set up, develop, and submit contributions.

## Getting Started

### Prerequisites

- Node.js 22+
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

```
ANTHROPIC_API_KEY=your_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

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
- **Tests required** for new features. We use vitest for unit tests and Playwright + axe-core for E2E.
- **Accessibility**: All pages must pass axe-core WCAG 2.1 AA scans.
- **No AI jargon** in user-facing text. No "AI-powered", "leverage", "seamless", "robust". Write like a builder.
- **No em-dashes**. Use commas, periods, or semicolons.
- **Data sourcing**: Every quantitative claim needs an inline citation with source, year, and URL.

## Project Structure

```
src/
  app/           # Next.js App Router pages and API routes
  lib/           # Shared utilities (API clients, PDF extraction, security)
  lib/prompts/   # Civic summarization, translation, verification prompts
  components/    # React components
tests/
  unit/          # Vitest unit tests
  e2e/           # Playwright E2E tests
supabase/
  migrations/    # Database schema
  seed/          # Seed data (jurisdictions, topics, etc.)
```

See `CLAUDE.md` for detailed architecture documentation.

## Reporting Issues

Use the [issue templates](https://github.com/pateljatin/civic-brief/issues/new/choose) for bug reports and feature requests.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
