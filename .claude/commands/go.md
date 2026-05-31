---
name: go
description: Verify current work is shippable, then open a PR — composite of test + simplify + pr
---

Run the full ship-readiness sequence for the current branch.

1. **Test baseline**: Run `npm run test:check`. If it fails, stop and report which tests regressed — do not continue.

2. **Type check**: Run `npx tsc --noEmit`. If it fails, stop and report errors.

3. **Simplify review**: Use a subagent to review all files changed on this branch vs main. Ask it to identify: dead code, over-abstraction, functions that could be combined, and any obvious bugs. Report findings but do not auto-fix — surface them for review.
   ```
   git diff main...HEAD --name-only
   ```

4. **Open PR**: If steps 1-2 pass, run `/commit-push-pr` to create the PR. Include the simplify findings in the PR description under "Code review notes".

If $ARGUMENTS is provided, use it as additional context for the PR description.
