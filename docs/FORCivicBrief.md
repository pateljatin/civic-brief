# FORCivicBrief.md

## What This Is

Civic Brief is an open-source platform that takes government PDFs (budgets, legislation, meeting minutes, zoning amendments) and turns them into structured, plain-language civic intelligence in multiple languages. It was built as a working demo for the Mozilla Foundation Democracy x AI Incubator 2026, a $50K grant with a $250K follow-on tier. The core insight: 3,500+ US newspapers have closed, 213 counties have zero local news, and 50 million Americans lack civic information. Government documents are public but functionally invisible. Civic Brief makes them visible.

## The Story

Jatin Patel, a Group PM at Microsoft who served as Group PM on Microsoft Teams, submitted the initial proposal to Mozilla on March 16, 2026. The full proposal deadline is April 15, 2026, and a working demo needs to be live before then. The bet was straightforward: the tech stack that shipped PeopleBuilt.ai solo (Next.js + Supabase + Claude API + Vercel) could ship Civic Brief in weeks, not months.

The problem Civic Brief solves is not "summarize this PDF." Plenty of tools do that. The problem is civic context. When a city publishes a 400-page budget PDF, a citizen needs to know: will my property taxes go up? When a school board passes a resolution, a parent needs to know: did they just change the bus contract? When a zoning amendment is filed, a homeowner needs to know: is my block about to become mixed-use? Generic summarization does not answer these questions. Civic-context prompting does.

The other half of the problem is language. Globally, civic information exists almost exclusively in dominant languages. A county notice in Los Angeles might affect 500,000 Spanish speakers who cannot read the English legal text. Civic Brief produces briefs simultaneously in English and Spanish, with Hindi ready, and the architecture supports any language.

## How It Actually Works

The architecture follows a pipeline pattern: PDF goes in, structured civic brief comes out, verified by an independent LLM-as-Judge pass, translated, and stored. Here is the real flow.

### The Data Journey

Follow a PDF from the moment a user drops it on the upload page to the moment they see a civic brief.

**Step 1: Upload (client side)**

The user lands on `/upload` (a client component). They either drop a PDF on the drag-and-drop zone or click to browse. They also paste the source URL where the document is published. This URL is critical: every civic brief links back to the original government source so citizens can verify for themselves.

The `UploadForm` component (`src/components/UploadForm.tsx`) constructs a `FormData` with the file and source URL, then POSTs to `/api/summarize`. Meanwhile, it shows animated pipeline progress steps (extracting, summarizing, verifying, translating) using timed CSS transitions. These are visual feedback; the actual processing happens server-side in one request.

**Step 2: Validation (server side, `src/app/api/summarize/route.ts`)**

The API route validates everything before any processing happens:
- Rate limiting: 10 requests per minute per IP (in-memory store, `src/lib/security.ts`)
- Daily limit: 10 documents per day globally (counted from `sources` table rows created today). This is cost protection for the demo.
- URL validation: Must be http/https. Rejects `javascript:`, `data:`, and `file:` URIs.
- File validation: Must be a PDF, max 10MB.
- Source URL is required (not optional).

**Step 3: PDF extraction (server side, `src/lib/pdf-extract.ts`)**

The PDF buffer is processed entirely in memory. No disk writes. The function checks PDF magic bytes (`%PDF-`) before attempting extraction, because many government PDF URLs actually serve HTML (redirects, login pages, cookie walls). We learned this the hard way.

`unpdf` does the extraction. It returns text as a `string[]` (one string per page), not a single string. We join with `\n`. If the extracted text has fewer than 50 characters per page, it is probably a scanned document, and we reject it with a clear error message.

After extraction, we compute a SHA-256 hash of the text for deduplication. If the same document has been processed before, we return the existing brief instead of burning another API call.

**The document text is never stored. It lives in a variable during this request, then it is garbage collected. This is a deliberate privacy decision, not laziness.**

**Step 4: Civic summarization (server side, `src/lib/anthropic.ts` + `src/lib/prompts/civic-summarize.ts`)**

The extracted text is sent to Claude (`claude-sonnet-4-20250514`, pinned) with a civic-context system prompt. The prompt is the heart of what makes this different from ChatGPT. It instructs the model to produce structured JSON answering six civic questions:

1. **What changed?** The specific action, decision, or policy change.
2. **Who is affected?** Which residents, businesses, or groups.
3. **What can you do?** Public comment periods, how to participate.
4. **Where does the money go?** Dollar amounts, budget lines, comparisons.
5. **Key deadlines.** Comment periods, effective dates, next meetings.
6. **Context.** How this compares to previous decisions.

The prompt has strict rules: use ONLY the source document, never general knowledge. If something is ambiguous, say so. Preserve factual meaning. Use plain language. The output is a `CivicContent` interface with typed fields.

The `generateJSON<T>()` helper in `anthropic.ts` handles the Claude API call, extracts the text block, strips markdown code fences if present, and parses the JSON. It is generic over the output type, so the same function works for summarization, verification, and translation.

**Step 5: LLM-as-Judge verification (server side, `src/lib/prompts/civic-verify.ts`)**

This is the second API call. A separate Claude call receives both the original source text and the summary JSON, then independently audits factuality. It checks every claim against the source, flags unverified claims, notes omitted information, and produces a confidence score from 0 to 1.

The scoring thresholds:
- 0.90-1.00: All claims verified, no significant omissions
- 0.70-0.89: Minor issues, no factual errors
- 0.50-0.69: Some unverified claims or notable omissions
- 0.00-0.49: Significant factual errors or critical omissions

Confidence levels: high (>=0.80), medium (>=0.50), low (<0.50).

The `VerificationResult` interface includes `verified_claims`, `unverified_claims`, `omitted_info`, and a `reasoning` explanation. All of this is shown to the user in an expandable panel on the brief.

When we tested with a real 24-page FCC ruling PDF, it scored 92% confidence. That is a real number from a real test.

**Step 6: Translation (server side, `src/lib/prompts/civic-translate.ts`)**

Third API call. The English civic content JSON is sent to Claude with translation instructions. The prompt is specific about civic terminology: "public hearing" in Spanish is "audiencia publica," not a literal word-by-word translation. Dollar amounts, dates, percentages, and proper nouns are preserved as-is. The output is the same `CivicContent` JSON structure, just in Spanish.

**Step 7: Database persistence (server side)**

If Supabase is configured, the route saves:
- A `source` record with the URL, content hash, title, factuality score, confidence level, and jurisdiction
- An English `brief` record with the structured civic content, headline, summary text, model version, and prompt version
- A Spanish `brief` record with the translated content

If Supabase is not configured (local dev without keys), it returns the results directly without saving. The API gracefully degrades.

**Step 8: Display (client side)**

The `UploadForm` calls `onResult`, which populates the `CivicBrief` component on the upload page. The brief displays all six civic sections with color-coded icons, a confidence score badge (green/yellow/red), a language toggle (English/Spanish), expandable verification details, and a source link back to the original document.

The brief also gets a shareable URL at `/brief/{id}`, which is a server component that fetches the brief from Supabase and renders the same `CivicBrief` component.

### The Code Map

```
civic-brief/
  src/
    app/
      page.tsx              -- Home page. Rich landing with interactive scenario demos
                               (budget, school board, zoning, legislation, multilingual).
                               Client component with tab switching, scroll-reveal
                               animations, and a visual pipeline flow.

      upload/page.tsx        -- Upload page. Client component. Manages result state,
                               language switching, translation fetching, and daily
                               limit display.

      brief/[id]/page.tsx    -- Individual brief. Server component with async params
                               (Next.js 16 Promise pattern). Fetches from Supabase,
                               joins brief + source + language.

      landing/page.tsx       -- Original static landing page ported to a route.

      api/
        summarize/route.ts   -- THE BIG ONE. 300 lines. Rate limit -> validate ->
                               extract -> dedup -> summarize -> verify -> translate ->
                               save -> respond. Three Claude API calls per document.

        translate/route.ts   -- On-demand translation for languages not pre-generated.
                               Fetches existing English brief, translates, saves.

        verify/route.ts      -- Re-run verification on an existing brief.

        limit/route.ts       -- GET endpoint returning remaining daily capacity.

    lib/
      anthropic.ts           -- Claude client wrapper. Singleton. generateJSON<T>()
                               does the heavy lifting for all three prompt types.

      supabase.ts            -- Two clients: server (service role, full access) and
                               browser (anon key, RLS restricted).

      pdf-extract.ts         -- In-memory PDF extraction with unpdf. Magic byte
                               checking. Scanned document detection. SHA-256 hashing.

      security.ts            -- Rate limiting (in-memory Map with TTL cleanup),
                               URL validation, file validation, text sanitization,
                               UUID and language code validation.

      types.ts               -- Every TypeScript interface. Database row types,
                               CivicContent, VerificationResult, TranslatedContent,
                               API request/response types, PipelineStep/PipelineStatus.

      prompts/
        civic-summarize.ts   -- System + user prompt for civic summarization.
        civic-verify.ts      -- System + user prompt for LLM-as-Judge verification.
        civic-translate.ts   -- System + user prompt for civic translation.

    components/
      UploadForm.tsx         -- Drag-and-drop file upload + source URL input +
                               animated pipeline progress.
      CivicBrief.tsx         -- The product. Renders all six civic sections,
                               confidence score, language toggle, verification
                               details, source link.
      ConfidenceScore.tsx    -- Visual badge: green/yellow/red with percentage.
      LanguageToggle.tsx     -- Pill buttons for en/es/hi.
      SourceLink.tsx         -- External link to original government document.

    proxy.ts                 -- Next.js 16 proxy (replaces middleware.ts). Sets
                               privacy headers on every response. Prevents caching
                               of API responses.

  supabase/
    migrations/
      001_initial.sql        -- 380 lines. 10+ tables, PostGIS, pg_trgm, RLS,
                               4 database functions, indexes, triggers.
    seed/
      countries.sql          -- US (ISO 3166-1)
      demo-jurisdictions.sql -- WA > King County > Seattle/Sammamish/Issaquah
      topics.sql             -- 8 top-level + 7 subtopics
      document-types.sql     -- 11 types (budget, legislation, minutes, etc.)
      languages.sql          -- en, es, hi + jurisdiction-language links

  tests/
    unit/                    -- 51 tests across 5 files (Vitest)
    e2e/                     -- 21 specs x 2 viewports = 42 tests (Playwright + axe-core)

  next.config.js             -- Security headers (CSP, HSTS, X-Frame-Options, etc.),
                               serverExternalPackages for unpdf.

  landing-static.html        -- Original landing page, preserved.
```

## Post-Demo Features (Shipped March 2026)

After the initial demo (C1-C6), two major features were shipped as part of the v1.1 Trust Loop milestone:

**C7: Automatic Document Feed Ingestion (PR #34, merged March 21, 2026)**

The demo required manual PDF uploads. C7 added an automated pipeline that monitors government RSS feeds, Legistar REST APIs, and OpenStates JSON APIs. A daily cron job (6am UTC) orchestrates feed polling, dispatching HMAC-authenticated requests to a worker endpoint that processes each discovered document through the same civic pipeline used by manual uploads. Key additions: `feeds`, `feed_poll_runs`, and `feed_poll_run_items` tables (migration 005), three fetcher modules, SSRF protection, cost controls (daily budget of 50 documents, conditional HTTP, auto-disable at 5 consecutive failures), and email alerts via Resend. The shared `processCivicDocument()` function in `src/lib/pipeline.ts` unified manual and automated ingestion.

**C8: Community Verification UI (PR #29, merged March 20, 2026)**

The demo showed AI verification scores but had no way for humans to provide feedback. C8 added a `FeedbackSection` component with structured feedback categories (factual_error, missing_info, translation_error, misleading, outdated), Google OAuth for accountability, mobile-responsive bottom sheet form, and automatic re-verification triggers (2+ factual error flags re-run the LLM-as-Judge; 2+ translation flags re-trigger translation). The `community_feedback` table, auth callback route, and i18n strings for English, Spanish, and Hindi were all part of this feature.

## Technical Decisions

**Next.js 16 over 14.** The CLAUDE.md originally specified Next.js 14. We ended up on 16.1.6 because that is what `npm install next@latest` gives you in March 2026. This was the right call (Turbopack is default, React 19 concurrent features are stable), but it introduced migration pain. See "Things That Broke" below.

**unpdf over pdf-parse or pdfjs-dist.** We needed in-memory extraction with no system dependencies (no poppler, no native binaries). unpdf wraps Mozilla's pdf.js and works in Node without native compilation. pdf-parse was the other option but it has not been updated in years and has known security issues. unpdf is actively maintained and works with Vercel's serverless runtime. The only surprise was the return type (see bugs below).

**Supabase over raw Postgres.** Jatin already had a Supabase project and knew the SDK from PeopleBuilt.ai. The auto-generated REST API, Row Level Security, and PostGIS support made it the obvious choice. We use the service role key server-side (full access for writes) and the anon key client-side (RLS-restricted reads). No Auth, no Storage for the demo. We only store our generated briefs and source URLs, never the uploaded documents.

**PostGIS jurisdiction model over flat text.** This was a deliberate overinvestment. A flat "jurisdiction" text field would have been faster to build. But the whole point of Civic Brief is to scale: "what government bodies make decisions that affect this address?" is a spatial query that needs a real jurisdiction tree. The schema supports the US hierarchy (federal > state > county > city > township > village > special district) and is designed to extend internationally (India, Nigeria, UK). The seed data has Washington State > King County > Seattle/Sammamish/Issaquah as the demo jurisdictions.

**Three separate Claude API calls instead of one.** Summarize, verify, and translate are three sequential calls. We could have combined summarize + translate into one call (ask the model to produce both languages at once), but keeping them separate has real advantages: each prompt is focused, the verification step independently audits the summary (it would not be independent if it was part of the same call), and we can retry individual steps without redoing the whole pipeline. The cost is latency (~15-20 seconds total), which is acceptable for a document analysis tool.

**Claude Sonnet 4 over Opus or Haiku.** Opus would be more accurate but 5x the cost and slower. Haiku would be cheaper but less reliable on structured JSON output from dense legal text. Sonnet 4 is the sweet spot. The 92% confidence score on a real FCC ruling validates this choice.

**In-memory rate limiting over Redis.** For a demo with a daily limit of 10 documents, an in-memory Map with TTL cleanup is fine. It resets on deploy (Vercel cold starts), which is actually a feature during development. For production, this would need Vercel KV or Upstash Redis.

**No user accounts.** Deliberate. No login, no cookies, no sessions, no PII collection. This is a privacy posture for a civic tool. Aggregate analytics only (Vercel Analytics). When someone uploads a document, they get their brief. No data about who uploaded what is ever collected or stored.

**Daily limit (10/day) over API key management.** Each document costs ~3 Claude API calls. At roughly $0.03-0.05 per call, that is ~$0.10-0.15 per document. An open demo with no limits would get expensive fast. The daily limit, counted from `sources` table rows created today, is simple and effective cost protection. The upload page shows remaining capacity.

## Things That Broke (And How We Fixed Them)

**unpdf returns `string[]`, not `string`.** The type definition says `text: string`, but at runtime, `extractText()` returns an array of strings (one per page). The fix was simple: `Array.isArray(result.text) ? result.text.join('\n') : result.text`. But this is the kind of bug that only appears when you actually run the code against a real PDF, not when you write it based on the docs. Lesson: always test with real inputs early.

**Supabase join types are ambiguous.** When you do `db.from('briefs').select('*, sources(*), languages(*)')`, the TypeScript types for the joined tables come back as `any` or as a union that is hard to work with. We ended up casting through `any` in the brief/[id] page to get the source URL and language name from the joined result. Not elegant, but pragmatic. The Supabase team is working on better generated types, but for now, you just have to know the shape of your data.

**Next.js 16: params became a Promise.** In Next.js 14, you destructure `params` directly: `const { id } = params`. In Next.js 16, params are a Promise that must be awaited: `const { id } = await params`. This is an async component pattern that breaks every dynamic route if you upgrade without reading the migration guide. The fix was straightforward once we knew about it, but the error messages at build time were not helpful.

**Next.js 16: middleware.ts renamed to proxy.ts.** The middleware system was rearchitected in Next.js 16. You now export a `proxy()` function from `src/proxy.ts` instead of a `middleware()` function from `src/middleware.ts`. The file name matters. If you name it `middleware.ts`, it silently does nothing. We had privacy headers that just stopped working until we realized the rename.

**Next.js 16: serverComponentsExternalPackages moved.** In Next.js 14, you configure external packages under `experimental.serverComponentsExternalPackages` in `next.config.js`. In Next.js 16, it is a top-level `serverExternalPackages` field. If you put it under `experimental`, it silently ignores it and unpdf fails at runtime with a module resolution error.

**Playwright "getByText" matched 2 elements.** The upload page has the text "Upload" in both the nav link and the page heading. `page.getByText('Upload')` matched both, causing test flakiness. The fix: use the full text string, like `page.getByText('Upload a document')`, or use `getByRole('heading', { name: 'Upload a document' })`. This is a Playwright gotcha that bites everyone eventually.

**Map iteration with `for...of` requires `downlevelIteration`.** TypeScript targets ES2015 by default, and iterating a Map with `for...of` needs `downlevelIteration: true` in tsconfig.json or a higher target. Instead of changing the config, we switched to `forEach`, which works without the flag. Small thing, but it blocked the build.

**Government PDF URLs that serve HTML.** When testing with real documents, we discovered that many government PDF URLs do not actually serve PDFs. They redirect to a login page, serve an HTML download portal, or return a cookie wall. The URL looks like `cityname.gov/budget/2026.pdf` but the response is HTML. The fix was checking PDF magic bytes (`%PDF-`) before attempting extraction. Without this, unpdf would try to parse HTML as a PDF and crash with an unhelpful error. This is one of those things you only learn from real-world testing.

## Technologies Unpacked

### Next.js 16 (App Router, Turbopack)

We use the App Router exclusively. No Pages Router. Server components for data-fetching pages (like `brief/[id]`), client components for interactive pages (like `upload` and the home page). API routes handle the three pipeline endpoints.

The App Router's strength for Civic Brief is that the summarize route can be a long-running server function (Vercel Fluid Compute supports 300-second timeouts), which is important because three sequential Claude API calls take 15-20 seconds.

Turbopack is the default dev server in Next.js 16 and is noticeably faster than Webpack. No configuration needed.

The `next.config.js` is focused on security: CSP headers, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy, and Referrer-Policy on every response. The `poweredByHeader: false` removes the X-Powered-By header so we do not advertise what framework we are running.

### unpdf (PDF extraction)

unpdf is a thin wrapper around Mozilla's pdf.js that exposes `extractText()` for server-side use. It works in Node.js without native dependencies, which is crucial for Vercel's serverless runtime.

Key learnings:
- Must be listed in `serverExternalPackages` in next.config.js or it fails with module resolution errors in the App Router.
- Returns `string[]` (per page) at runtime despite the type definition suggesting `string`. Always check `Array.isArray()`.
- Cannot extract text from scanned/image-only PDFs. We detect these by checking characters-per-page (< 50 chars/page = probably scanned).
- The `extractText()` function works on `Uint8Array`, so convert from `ArrayBuffer` first.

### Claude API (Anthropic SDK)

We use the official `@anthropic-ai/sdk` package. The client is a singleton initialized on first use. The model is pinned to `claude-sonnet-4-20250514` so behavior does not change when Anthropic releases new versions.

The `generateJSON<T>()` helper is the core abstraction. It takes a system prompt and user message, calls `messages.create()`, finds the text block in the response, strips markdown code fences (Claude sometimes wraps JSON in ```json ... ```), and parses it into the generic type T. This one function serves summarization, verification, and translation.

The prompts themselves are in `src/lib/prompts/`. Each file exports a system prompt constant and a user prompt function. The system prompts are detailed and prescriptive: they specify output format, rules about sourcing, and civic-specific instructions. The user prompts are minimal: they just inject the source text.

The verification prompt (`civic-verify.ts`) is particularly interesting. It instructs the model to be strict: "Civic misinformation is a democratic harm, not just a quality issue." It defines specific scoring bands and explicit penalties for wrong numbers, wrong dates, misattributed quotes, and overstated certainty. It also explicitly says not to penalize for simplifying legal language.

### Supabase (Postgres + PostGIS + pg_trgm)

The database schema in `001_initial.sql` is 380 lines of production-grade SQL. It is not a toy schema.

**The jurisdiction tree** is the most interesting part. `jurisdictions` is a self-referencing table (each row has a `parent_id` pointing to its parent jurisdiction) with PostGIS spatial columns (`centroid` as a Point, `boundary` as a MultiPolygon). This means you can query "what jurisdictions govern this latitude/longitude?" with a single function call (`jurisdictions_at_point`). The recursive CTE in `jurisdiction_ancestors()` walks up the tree (city > county > state > federal).

**Full-text search** uses PostgreSQL's built-in `tsvector` with `simple` config (language-agnostic, since briefs exist in multiple languages). The `fts` column on `briefs` is a generated column that weights headlines (A) higher than summaries (B). The `search_briefs()` function supports filtering by language, jurisdiction, document type, and topic.

**Trigram indexes** (`pg_trgm`) enable fuzzy matching on jurisdiction names. A user searching for "Seatle" (misspelled) will still find Seattle.

**Row Level Security** is enabled on every table. Public read access is granted for published briefs and reference data. Writes go through the service role key server-side.

Two Supabase clients: server (`getServerClient()`) uses the service role key for full access, browser (`getBrowserClient()`) uses the anon key and respects RLS. The server client is used in API routes. The browser client would be used for client-side queries in future features.

### Playwright + axe-core (E2E + Accessibility)

42 E2E tests: 21 test specs run on two viewports (Chromium desktop at 1280x720, Pixel 5 mobile at 393x851). Tests cover page loads, navigation, form elements, security headers, mobile responsiveness, and WCAG 2.1 AA accessibility.

axe-core runs on every page and fails the test if there are serious or critical accessibility violations. Color contrast issues are known non-critical exceptions during development.

### Vitest (Unit Tests)

51 unit tests across 5 files covering components (ConfidenceScore, SourceLink rendering), PDF extraction (hashText, PDFExtractionError), prompt content verification, security utilities (URL validation, sanitization, file validation), and type structure validation.

## Engineering Lessons

**Privacy as architecture, not policy.** "We don't store your documents" is not a policy statement; it is an architectural decision enforced at multiple layers. The PDF buffer lives in a function variable, the proxy sets no-cache headers on API responses, the database schema has no column for document text, and the privacy posture is documented in code comments. This makes it auditable. Mozilla reviewers can grep the codebase and verify the claim.

**Daily limits beat auth for demos.** Adding user accounts, login flows, and per-user quotas would have taken a week. A global daily counter (count rows in `sources` created today) took 10 minutes and accomplishes the same goal: cost protection. The upload page shows remaining capacity so users are not surprised.

**Three prompts are better than one.** It was tempting to put summarize + verify + translate in one big prompt. But separation gives you independence (the verifier does not see the summarizer's reasoning), retryability (translate failed? retry just the translation), and debuggability (which step produced wrong output?). The latency cost is real but acceptable.

**Test with real documents from day one.** Unit tests with mock data will not catch the unpdf `string[]` bug, the government-URL-serves-HTML bug, or the scanned-PDF edge case. We found all three by uploading a real FCC ruling PDF. The 92% confidence score was not just a metric; it was validation that the entire pipeline works end-to-end.

**Type your API responses.** The `types.ts` file has 213 lines of TypeScript interfaces covering every database row, every API request/response, and every structured output from Claude. This caught dozens of bugs at compile time. When you change the `CivicContent` shape, TypeScript tells you everywhere that needs updating.

**Security headers are cheap insurance.** The `next.config.js` security headers and `proxy.ts` privacy headers took maybe 30 minutes to set up but cover a long list of attack vectors (XSS, clickjacking, MIME sniffing, information leakage). The E2E tests verify these headers are present, so they cannot silently disappear in a refactor.

## Pitfalls and Gotchas

**Do not remove Vercel Analytics.** The `<Analytics />` component in `layout.tsx` and the script tag in `landing-static.html` are intentional. They provide aggregate-only (not per-user) analytics. Removing them loses visibility into demo usage.

**unpdf must be in `serverExternalPackages`.** If you remove it from `next.config.js`, PDF extraction will fail in the App Router with a module resolution error. This is because unpdf uses Node.js APIs that are not available in the edge runtime.

**The proxy.ts file name matters.** In Next.js 16, the file must be named `proxy.ts`, not `middleware.ts`. If you rename it, the privacy headers silently stop being applied.

**Supabase is optional for local development.** The `safeGetDb()` helper in `summarize/route.ts` returns `null` if Supabase credentials are missing. The API route works without a database; it just skips dedup checking and persistence. This means you can develop locally with only an `ANTHROPIC_API_KEY`.

**The daily limit counts from Supabase.** If Supabase is down or misconfigured, the limit check defaults to "allowed." This is a deliberate choice: we would rather serve a brief than block a user because the counter is unavailable.

**PDF magic bytes check is essential.** Without it, any HTML page (login redirects, cookie walls) that has a `.pdf` URL will crash unpdf with an unhelpful error. The `%PDF-` check catches this before extraction.

**The rate limiter resets on deploy.** In-memory Map state is lost when Vercel cold-starts a new instance. For the demo, this is fine. For production, use Redis.

**Three Claude calls = ~15-20 seconds.** The pipeline is not instant. The upload page uses timed CSS animations to simulate progress (extracting at 0s, summarizing at 2s, verifying at 8s, translating at 14s). These timings are approximate and do not actually track the server-side progress. If processing takes longer than expected, the progress bar might complete before the response arrives. This is cosmetic, not functional.

**`for...of` on Maps needs `downlevelIteration`.** If you add Map iteration with `for...of`, either set `downlevelIteration: true` in tsconfig.json or use `forEach` instead.

## What We'd Do Differently

**Stream the pipeline progress.** The current approach fires one POST request and waits. With Server-Sent Events or WebSockets, we could stream real pipeline status (extracting... done, summarizing... done, verifying... done) instead of faking it with timers. This would be a much better UX, especially when processing takes longer than the timer estimates.

**Use Anthropic's tool use for structured output.** We rely on prompt engineering to get JSON output, then strip code fences and parse. Claude's tool use feature (`tools` parameter) would guarantee structured output and eliminate the fence-stripping logic. We did not use it because the prompts were written before verifying tool use compatibility with the civic content schema, and they worked well enough.

**Add OCR for scanned PDFs.** Currently, if a PDF is image-only (scanned), we reject it with a clear error. Many government documents, especially older ones, are scanned. Adding Tesseract.js or a cloud OCR service would dramatically increase the range of documents we can process. This is a post-demo priority.

**Move security to proper middleware.** The rate limiter is called explicitly at the top of each API route. In a real app, this should be middleware that applies to all API routes automatically. The Next.js 16 proxy system supports this, but we did it inline for simplicity.

**Pre-generate more languages.** Currently, only English and Spanish are generated on upload. Hindi and other languages are generated on-demand when the user clicks the language toggle. Pre-generating all languages configured for the jurisdiction would eliminate the wait time on language switch. The trade-off is more API calls (and cost) per document.

**Better error messages for large PDFs.** We truncate extracted text at 100,000 characters (about 25,000 words). For a 400-page budget, this might cut off important sections. We should tell the user which pages were processed and which were truncated, so they know the summary might be incomplete.
