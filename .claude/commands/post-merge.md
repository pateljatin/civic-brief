---
name: post-merge
description: Run the mandatory post-merge checklist after every PR merge
disable-model-invocation: true
---

Run the post-merge checklist for the most recently merged PR. Complete every step in order.

1. **Snapshot**: Run `bash scripts/snapshot.sh post-merge-$ARGUMENTS` to back up the repo state.

2. **Close GitHub issues**: Run `git log --oneline -5` to find issue references in recent commits, then close each referenced issue with `gh issue close <number> --comment "Closed via [PR title] merged to main."`.

3. **Write retro**: Create `docs/superpowers/retros/$(date +%Y-%m-%d)-<feature-slug>.md` using the template from `2026-03-20-c8-community-verification.md`. Cover: planned vs actual, unplanned additions, extracted rules.

4. **Update MEMORY.md**: Update the checkpoint section in `C:\Users\jatin\.claude\projects\C--Users-jatin-code-civic-brief\memory\MEMORY.md` to reflect current main SHA, test count, and what shipped.

5. **Browser verify**: Use the Playwright browser to open civic-brief.vercel.app, confirm the deploy is live, and check the golden path (home → upload page → showcase) renders without errors.

Report each step as done or blocked. Do not skip steps.
