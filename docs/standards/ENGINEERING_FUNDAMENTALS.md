# Engineering Fundamentals

Standards and practices for Civic Brief development.

---

## Test-Driven Development

- Write tests before or alongside implementation, not after
- **Unit tests** for all business logic (vitest)
- **E2E tests** for all user-facing flows (Playwright)
- **Accessibility tests** on every page (axe-core, WCAG 2.1 AA)
- Target: 80%+ code coverage on new code

### Current test counts
- 71 unit tests (vitest) across 7 files
- 48 E2E tests (24 specs x 2 viewports: desktop + mobile)

### Running tests
```bash
npm test          # Unit tests (vitest)
npm run test:e2e  # E2E tests (Playwright, starts dev server)
npm run test:all  # Both
npm run typecheck # TypeScript strict mode
```

## CI/CD Pipeline (GitHub Actions)

On every PR to `main`:

1. `npm run typecheck` -- TypeScript strict mode
2. `npm test` -- vitest unit tests (all must pass)
3. `npm run build` -- Production build must succeed
4. `npx playwright test` -- E2E tests (all must pass)

PRs that fail any check cannot be merged. No `--no-verify` commits to main.

## Code Quality

- **TypeScript strict mode** (enabled in `tsconfig.json`)
- **No `any` types** except documented Supabase join workarounds (see `src/lib/supabase.ts`)
- **Security review** required on any PR touching auth, API routes, or data handling
- **Dependency audit** quarterly (`npm audit`)

## Branch Strategy

- `main` is always deployable (Vercel auto-deploys on push)
- Feature branches for all non-trivial changes
- PR required for merge to `main` (enforce via branch protection)
- Squash merge preferred for clean history
- Meaningful commit messages: describe what changed and why, not just "update" or "fix"

## Dependency Management

- Pin major versions in `package.json`
- Review changelogs before updating major versions
- Run full test suite after any dependency update
- `npm audit` on every CI run (advisory, not blocking)

## Environment Variables

All secrets live in `.env.local` (never committed). Required:

```
ANTHROPIC_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Optional (for auth):
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_SITE_URL
```
