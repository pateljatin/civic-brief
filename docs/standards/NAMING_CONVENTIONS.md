# Naming Conventions

Consistent naming across every layer of the stack. Follow these conventions for all new code. When touching existing code that doesn't conform, refactor it to match.

Last updated: 2026-03-21

---

## Database (Supabase Postgres)

### Tables
- `snake_case`, plural nouns: `feeds`, `briefs`, `user_jurisdictions`
- Junction tables: `{parent}_{child}` in logical order: `brief_topics`, `jurisdiction_languages`

### Columns
| Type | Convention | Examples |
|------|-----------|----------|
| Foreign keys | `{referenced_table_singular}_id` | `feed_id`, `jurisdiction_id`, `run_id` |
| Timestamps | `{action}_at` | `created_at`, `last_polled_at`, `completed_at` |
| Booleans | `is_{adjective}` or `has_{noun}` | `is_active`, `is_primary`, `is_published` |
| Counts | `{thing}_count` or `total_{things}` | `duplicate_count`, `view_count`, `total_items_processed` |
| Status fields | `status` with CHECK constraint | `CHECK (status IN ('pending', 'processing', 'completed', 'failed'))` |
| General columns | `snake_case` | `source_url`, `content_hash`, `expected_domain` |

### Enum-like Values
- Always `snake_case` strings via CHECK constraints, never Postgres ENUM types
- Reason: CHECK constraints are easier to extend without migration headaches
- Examples: `'factual_error'`, `'view_brief'`, `'legistar'`

### Functions
- `snake_case`, verb-first: `search_briefs()`, `finalize_poll_run()`, `active_feeds()`
- Prefix with domain when ambiguous: `user_daily_usage()`, `user_can_summarize()`

### Indexes
- `{table}_{columns}_idx`: `feeds_jurisdiction_id_idx`
- Unique: `{table}_{columns}_unique` or `{table}_unique_{semantic}`: `community_feedback_unique_user_type`

### RLS Policies
- Readable English sentence: `"Public read feeds"`, `"Users manage own jurisdictions"`
- Pattern: `"{Actor} {action} {scope}"`: `"Users read own profile"`, `"Authenticated insert own feedback"`

### Migrations
- `{NNN}_{description}.sql`: `005_feed_ingestion_and_user_infra.sql`
- Always include a header comment block: depends-on, changes list, setup requirements

### Seed Data
- `{resource}.sql`: `feeds.sql`, `countries.sql`, `topics.sql`

---

## API Routes

### Structure

```
/api/{resource}                     CRUD on a resource
/api/{resource}/{action}            Specific action on a resource
/api/cron/{job-name}                Scheduled jobs (CRON_SECRET auth)
/api/internal/{operation}           Server-to-server (HMAC auth)
/api/users/me                       Authenticated user's own data
/api/users/me/{sub-resource}        User's nested resources
/api/admin/{resource}               Admin-only operations
```

### Examples

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/briefs/create` | POST | Rate limit | Upload PDF, create brief |
| `/api/briefs/translate` | POST | Rate limit | Translate existing brief |
| `/api/briefs/verify` | POST | Rate limit | Re-run verification |
| `/api/feedback` | POST | Auth required | Submit community feedback |
| `/api/usage/limit` | GET | None | Check daily limit |
| `/api/cron/ingest` | GET | CRON_SECRET | Feed ingestion orchestrator |
| `/api/cron/digest` | GET | CRON_SECRET | Weekly digest email |
| `/api/internal/ingest-feed` | POST | HMAC | Per-feed worker |
| `/api/users/me` | GET | Auth required | User dashboard data |
| `/api/users/me/jurisdictions` | GET/POST/DELETE | Auth required | Followed jurisdictions |

### Auth Patterns
- **Public**: rate-limited by IP
- **Auth required**: Supabase session token
- **CRON_SECRET**: Vercel-injected header for scheduled jobs
- **HMAC**: Signed request with timestamp for internal server-to-server calls

### Route Folder Naming
- `kebab-case` folders: `api/internal/ingest-feed/route.ts`
- Each route is a folder with `route.ts` (Next.js App Router convention)

---

## TypeScript

### Types and Interfaces

| Element | Convention | Examples |
|---------|-----------|----------|
| DB model interfaces | `PascalCase` singular noun | `Feed`, `FeedPollRun`, `UserJurisdiction` |
| API request types | `{Action}{Resource}Request` | `CreateBriefRequest`, `IngestFeedRequest` |
| API response types | `{Action}{Resource}Response` | `CreateBriefResponse`, `IngestFeedResponse` |
| Union types | `PascalCase` descriptive | `FeedType`, `PollRunStatus`, `PipelineStep` |
| Discriminated unions | `type` field with literal strings | `{ type: 'success', ... } \| { type: 'error', ... }` |
| Constant arrays | `SCREAMING_SNAKE_CASE` | `FEED_TYPES`, `POLL_RUN_STATUSES`, `FEEDBACK_TYPES` |

### Functions
- `camelCase`, verb-first: `validateUrl()`, `hashText()`, `processCivicDocument()`
- Boolean-returning: `is{Condition}()` or `can{Action}()`: `isPrivateIp()`, `canProcessMore()`
- Factory/builder: `create{Thing}()`: `createHmacSignature()`, `createFeedFetcher()`

### Constants
- `SCREAMING_SNAKE_CASE` for configuration values: `MAX_TEXT_LENGTH`, `DAILY_LIMIT`
- `camelCase` for computed/derived constants: `defaultJurisdictionId`

---

## Files and Folders

### Source Code (`src/`)

| Element | Convention | Examples |
|---------|-----------|----------|
| Lib modules | `kebab-case.ts` | `pdf-extract.ts`, `ssrf.ts`, `pipeline.ts` |
| Lib sub-modules | `{domain}/{module}.ts` | `feeds/fetchers/rss.ts`, `feeds/dedup.ts` |
| Index files | `index.ts` for public API of a module folder | `feeds/fetchers/index.ts` |
| Components | `PascalCase.tsx` | `FeedHealthBadge.tsx`, `UserDashboard.tsx` |
| Prompts | `civic-{action}.ts` | `civic-summarize.ts`, `civic-translate.ts` |
| i18n strings | `ui-strings.ts` | Single source of truth for all UI text |

### Tests (`tests/`)

| Element | Convention | Examples |
|---------|-----------|----------|
| Unit tests | `{module}.test.ts` | `pipeline.test.ts`, `ssrf.test.ts` |
| Unit test subfolders | Mirror `src/lib/` structure | `tests/unit/feeds/fetchers.test.ts` |
| Integration tests | `{feature}.test.ts` in `tests/integration/` | `ingest-feed.test.ts` |
| E2E tests | `{feature}.spec.ts` in `tests/e2e/` | `pages.spec.ts`, `upload.spec.ts` |

### Documentation (`docs/`)

```
docs/
  standards/                    Engineering and product standards
  superpowers/
    specs/                      Design specs (YYYY-MM-DD-{topic}-design.md)
    plans/                      Implementation plans
    retros/                     Planning retrospectives
  research/                     Pre-spec research, analysis
    private/                    Strategy docs (gitignored)
  admin/                        Operational guides
```

---

## Environment Variables

### Naming Pattern
```
{SERVICE}_{KEY_TYPE}            External service credentials
NEXT_PUBLIC_{SERVICE}_{KEY}     Client-safe public keys
{FEATURE}_DAILY_LIMIT           Feature-specific limits
{PURPOSE}_SECRET                Internal secrets
```

### Current Variables
```bash
# External services
ANTHROPIC_API_KEY               # Claude API
OPENSTATES_API_KEY              # OpenStates API (free tier)
RESEND_API_KEY                  # Email sending

# Supabase
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL (client-safe)
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon key (client-safe)
SUPABASE_SERVICE_ROLE_KEY       # Supabase service role (server-only)

# Internal auth
CRON_SECRET                     # Vercel-injected cron authentication
INGEST_HMAC_SECRET              # Worker request signing (min 32 bytes)

# Feature limits
DEMO_DAILY_LIMIT=1              # Anonymous upload limit (production)
INGESTION_DAILY_LIMIT=50        # Auto-ingestion daily budget

# Admin
ADMIN_EMAIL                     # Alert recipient for feed failures
```

### Rules
- Never commit `.env*.local` files
- Server-only keys never get `NEXT_PUBLIC_` prefix
- Secrets must be cryptographically random, minimum 32 bytes
- Document every variable in this file and in `.env.example`

---

## Testing

### File Naming

| Test type | Location | Naming | Example |
|-----------|----------|--------|---------|
| Unit | `tests/unit/` | `{module}.test.ts` | `ssrf.test.ts`, `pipeline.test.ts` |
| Unit (subfolder) | `tests/unit/{domain}/` | `{module}.test.ts` | `tests/unit/feeds/fetchers.test.ts` |
| Component | `tests/unit/` | `{Component}.test.tsx` | `ConfidenceScore.test.tsx` |
| Integration | `tests/integration/` | `{feature}.test.ts` | `ingest-feed.test.ts` |
| E2E (Playwright) | `tests/e2e/` | `{feature}.spec.ts` | `pages.spec.ts`, `upload.spec.ts` |

Mirror `src/` structure in `tests/unit/` where possible:
```
src/lib/feeds/dedup.ts         → tests/unit/feeds/dedup.test.ts
src/lib/ssrf.ts                → tests/unit/ssrf.test.ts
src/components/CivicBrief.tsx  → tests/unit/CivicBrief.test.tsx
```

### Test `describe` Blocks
- Top level: module or component name, matching the file
- Nested: group by function or behavior
- Use the actual function/component name, not prose descriptions

```typescript
// Good
describe('ssrf', () => {
  describe('validateFetchTarget', () => {
    it('rejects private IPv4 addresses', () => { ... });
    it('rejects IPv6 loopback', () => { ... });
    it('allows valid public HTTPS URLs', () => { ... });
  });
});

// Bad
describe('SSRF Protection Module', () => {
  describe('when validating URLs', () => {
    it('should not allow private IPs', () => { ... });
  });
});
```

### Test Case Naming (`it` / `test`)
- Start with a verb: `rejects`, `returns`, `throws`, `renders`, `displays`, `navigates`
- Describe the behavior, not the implementation
- No `should` prefix (redundant inside `it`)

```typescript
// Good
it('rejects URLs resolving to 127.0.0.1', () => { ... });
it('returns 401 when HMAC signature is invalid', () => { ... });
it('renders confidence badge in green for high scores', () => { ... });

// Bad
it('should work correctly', () => { ... });
it('test SSRF', () => { ... });
```

### Playwright E2E Naming
- `test.describe`: page or feature name
- `test`: user-centric action description

```typescript
// Good
test.describe('Upload Page', () => {
  test('submits PDF and displays civic brief', async ({ page }) => { ... });
  test('shows error for non-PDF files', async ({ page }) => { ... });
});

test.describe('Upload Page @mobile', () => {
  test('shows responsive layout on Pixel 5', async ({ page }) => { ... });
});

// Bad
test.describe('Tests for upload', () => {
  test('test1', async ({ page }) => { ... });
});
```

### Playwright Conventions
- Page objects: `PascalCase` class in `tests/e2e/pages/`: `UploadPage.ts`, `BriefPage.ts`
- Fixtures: `tests/e2e/fixtures/`: `test-pdf.pdf`, `malformed.pdf`
- Tags for filtering: `@mobile`, `@a11y`, `@security`, `@smoke`
- Viewport presets: always test both desktop (1280x720) and mobile (Pixel 5)

### Test Data and Fixtures
- Fixture files: `tests/fixtures/{type}/`: `tests/fixtures/pdf/valid-budget.pdf`
- Factory functions: `tests/helpers/factories.ts`: `createMockFeed()`, `createMockBrief()`
- Mock responses: `tests/helpers/mocks.ts`: `mockLegistarResponse()`, `mockRssResponse()`
- Constants: `tests/helpers/constants.ts`: `TEST_JURISDICTION_ID`, `TEST_FEED_URL`

```typescript
// Factory naming: create{Thing}(overrides?)
export function createMockFeed(overrides?: Partial<Feed>): Feed {
  return {
    id: crypto.randomUUID(),
    name: 'Test Feed',
    feed_url: 'https://example.gov/rss',
    feed_type: 'rss',
    is_active: true,
    ...overrides,
  };
}
```

### Test Helper Naming
- Assertion helpers: `expect{Condition}()`: `expectValidHmac()`, `expectSsrfBlocked()`
- Setup helpers: `setup{Context}()`: `setupTestFeed()`, `setupPollRun()`
- Cleanup helpers: `cleanup{Resource}()`: `cleanupTestData()`

### Security Test Patterns
- Group under `describe('security', () => { ... })` within relevant test files
- Tag with `@security` in Playwright for selective runs
- Name explicitly: `'blocks XXE entity expansion in RSS feed'`, not `'handles bad XML'`

---

## Events and Metrics

### Usage Events (`usage_events.event_type`)
- Pattern: `{verb}_{resource}`: `summarize_brief`, `view_brief`, `submit_feedback`
- Must match CHECK constraint in DB schema

### Ingestion Events (logged in `feed_poll_run_items`)
- Tracked via columns, not event strings: `items_processed`, `items_skipped`, `skipped_formats`

### Gamification (future, `profiles` columns)
- `contribution_score`: integer, computed from weighted actions
- `badges`: JSONB array of earned badge objects
- `streak_current` / `streak_longest`: consecutive active days

---

## Git

### Branches
- `main`: always deployable, auto-deploys to production
- `feature/{issue-key}-{description}`: feature work (`feature/c7-feed-ingestion`)
- `fix/{issue-key}-{description}`: bug fixes
- `chore/{description}`: refactors, dependency updates, config changes

### Commits
- Conventional-ish, but human-readable: `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- Meaningful descriptions, not "update" or "fix stuff"
- Reference issue numbers: `feat: C7 feed ingestion orchestrator (#7)`

### PRs
- Title matches the primary change
- Body includes: summary, test plan, screenshots (if UI)
- Squash merge to main
