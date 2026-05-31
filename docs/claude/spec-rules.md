# Spec Writing Rules

## Spec Checklist (every design spec and implementation plan)

- **Render tree audit**: After drafting "Files Changed," walk the render tree of every affected page. Any component rendering user-visible text is in scope.
- **State machine tables**: Conditional rendering flows get a `(state, condition) -> rendered output` table. Never describe rendering logic in prose only.
- **Five states per component**: Every UI component spec must define: default, loading, empty, error, demo. If a state is "not applicable," say so explicitly.
- **NOT in scope section**: Every spec must have an explicit exclusions list to prevent scope drift.
- **TypeScript types for API responses**: Include the actual TypeScript type, not just prose. Use discriminated unions for multi-shape responses.
- **i18n requirements must be specific**: List (a) every string to translate, (b) where translations live, (c) which components need a `lang` prop.
- **Concurrent request scenarios**: Any write-path spec must describe what happens with two simultaneous identical requests.
- **Deploy environment checklist**: Specs involving OAuth or external APIs must list all origins (production, staging, localhost) and required config per environment.
- **Platform API contracts**: When a spec depends on platform behavior (Vercel cron auth, Supabase RLS, etc.), quote the exact API contract and link to the docs page. Do not describe from memory.
- **Deployment config per route**: Every new API route spec must include: maxDuration, memory, concurrency limits, Fluid Compute needed.
- **Env var lifecycle table**: New env vars get a row with: name, where to set (local, Vercel prod, Vercel preview), who provisions it.
- **Review checkpoint budget**: Plans with 10+ implementation commits should budget one "address review findings" commit.
- **Structural clone consolidation**: When 2+ tasks are structural clones, note they may ship as one commit.
- **Planning retrospective**: After merging, write retro in `docs/superpowers/retros/`. See `2026-03-20-c8-community-verification.md` for template.

## Data Claims and Sourcing

- Every quantitative claim (statistics, percentages, dollar amounts) MUST include inline source citation: author/org, year, URL.
- Never fabricate or estimate statistics. If unverifiable, say so or remove it.
- Prefer primary sources (Census Bureau, peer-reviewed research, official reports).
- Format: "claim ([Source Name, Year](URL))" inline with the text.

## Vercel Analytics Note

`@vercel/analytics` is included in `layout.tsx`. The original landing page script tag is preserved in `landing-static.html`.
