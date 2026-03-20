# C8 Planning Retrospective (2026-03-20)

## Spec vs Reality

**Planned commits:** ~15 (spec + plan + implementation + tests)
**Actual commits:** 27
**Unplanned work:** 40% of commits

## Post-Planning Additions

| Item | Category | Root Cause | Lesson |
|---|---|---|---|
| Demo brief watermark overlay | Planning miss | Spec didn't address demo brief fixture | Specs must enumerate every page variant (demo, empty state, error state) |
| Demo brief disabled verify button | Planning miss | `isDemo` prop not extended to SourceLink | When adding behavior-gating props, audit every interactive element on the page |
| Demo brief source link 404 | Bug fix | Mock URL only became visible when verify button was prominent | E2E test every clickable link, including demo pages |
| Supabase PromiseLike compat | Bug fix | `.update()` returns PromiseLike, not Promise | Add Supabase patterns section to spec template |
| JSON parse error (max_tokens truncation) | Emergent | Only surfaced with longer real PDFs | LLM pipeline specs must include truncated/malformed response handling |
| Redirect animation rendered below form | Bug fix | Prose described "hide form, show animation" without render conditions | Use state machine tables, not prose, for conditional rendering |
| SummarizeResult discriminated union | Planning miss | API response shape described in prose, not TypeScript | Specs must include TypeScript type definitions for API responses |
| Concurrent upload race condition | Planning miss | TOCTOU window identified during review | Write-path specs must include concurrent request scenarios |
| URL normalization for alternates | Planning miss | "Store alternate URL" didn't define "same URL" | URL storage specs must define normalization rules |
| Backup script | Planning miss | No operational safety in spec | Migration specs must include "before you run" checklist |
| Staging OAuth host | Emergent | Preview URL doesn't match registered redirect_uri | OAuth specs must list all deploy environments and their origins |
| LanguageToggle visible with no translations | Bug fix | Spec didn't define empty/missing-data state | Toggle/tab specs must define the empty state explicitly |
| On-the-fly client-side translation | Planning miss | i18n requirement didn't define data flow (server pre-fetch vs client lazy-load) | i18n decisions must specify the architectural data flow, not just "must translate" |
| ui-strings.ts for static labels | Planning miss | i18n requirement was a one-liner, no implementation design | i18n requirements must list: (a) specific strings, (b) file location, (c) which components get lang prop |
| ConfidenceScore lang prop | Planning miss | "All card text must translate" didn't enumerate the render tree | After writing Files Changed table, walk the render tree of every affected page |
| Hindi demo translation | Polish | Added opportunistically during i18n work | Specs should separate required vs nice-to-have languages |

## Systemic Patterns (convert to CLAUDE.md rules)

1. **Cross-cutting concern audit:** After drafting Files Changed, walk the render tree of every affected page. Any component rendering user-visible text is in scope.
2. **State machine over prose:** Conditional rendering flows get a `(state, condition) -> rendered output` table, not prose descriptions.
3. **Empty/error/demo states:** Every UI component spec must define: default, loading, empty, error, and demo states.
4. **Supabase patterns in template:** PromiseLike wrapping, .maybeSingle(), service-role-for-writes.
5. **NOT in scope section:** Every spec gets an explicit exclusions list to prevent drift.

## What Worked Well

- Brainstorming + spec review caught 6 issues before implementation
- Integration tests caught auth and validation bugs early
- E2E tests caught rendering issues across viewports
- Duplicate handling spec was more thorough (fewer misses) because it was written after C8's lessons
