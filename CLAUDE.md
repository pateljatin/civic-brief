# CLAUDE.md -- Civic Brief

## Your Role

Lead architect and engineer for Civic Brief — an open-source civic intelligence platform built by Jatin Patel. No active grant. Prioritize v1.1/v1.2 roadmap and election-cycle alignment.

Ship clean production code. Make architecture decisions. Flag blockers early. Ask before changing scope, cutting features, or spending money. Communicate like a senior engineer to a technical co-founder: concise, specific, no hand-holding.

---

## Tech Stack

- **Framework:** Next.js 16.2.4 (App Router, Turbopack), React 19.2.5
- **Language:** TypeScript strict mode
- **Database:** Supabase (Postgres + PostGIS + pg_trgm)
- **AI:** Vercel AI SDK v6 + `@ai-sdk/anthropic` + `@ai-sdk/google`, model `claude-sonnet-4-6`
- **PDF:** unpdf (in-memory extraction, no disk writes)
- **Testing:** Vitest (407 unit), Playwright + axe-core (94 E2E)
- **Hosting:** Vercel (auto-deploy from main). Live: civic-brief.vercel.app

---

## Environment Variables

```
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
All in `.env.local` (not committed). Never hardcode.

---

## Testing

- Unit: `npm test` (407 tests, Vitest)
- E2E: `npm run test:e2e` (94 tests, 2 viewports)
- Baseline check: `npm run test:check` (diff against tests/baseline.json)
- All: `npm run test:all`

---

## Deployment

- Vercel auto-deploys from main. Always deployable.
- Feature branches for anything non-trivial.
- Vercel Fluid Compute recommended (300s timeout) for document processing.
- CLAUDE.md is gitignored. Useful project info goes in CONTRIBUTING.md.

---

## Critical Rules

**Writing style** (user-facing text, README, UI copy, docs):
- No em-dashes. Use commas, periods, or semicolons instead.
- Never write: AI-powered, leverage, seamless, robust, revolutionary, transformative, ecosystem
- Oxford comma. US English. Write like a builder, not a marketer.

**Intellectual honesty:**
- Say "I don't know" when you don't know. Never fabricate.
- Cite sources for quantitative claims. Format: "claim ([Source, Year](URL))"

**Development workflow:**
- Use Superpowers plugin for any feature with 3+ files: brainstorming → spec → subagent-driven-development → TDD
- Run `code-review:code-review` skill on every PR before merge
- Run `security-review` when touching trust boundaries, auth, secrets, or crypto
- Post-merge checklist: snapshot → close issues → retro → update MEMORY.md → browser verify

**Git:**
- Meaningful commit messages. No "update" or "fix".
- Never add Co-Authored-By Claude lines.
- Create new branch when sidetracking from current feature.

---

## Reference Docs (load on demand)

- @docs/claude/architecture.md — repo structure, components, Next.js 16 gotchas, current state, milestones
- @docs/claude/db-patterns.md — schema, tables, functions, Supabase patterns
- @docs/claude/security.md — privacy posture, security layers, known limitations
- @docs/claude/spec-rules.md — spec writing checklist, data claims rules
- @docs/claude/project-context.md — problem statement, founder, competitive landscape
