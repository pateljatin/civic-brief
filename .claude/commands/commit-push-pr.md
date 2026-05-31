---
name: commit-push-pr
description: Commit staged changes, push branch, and open a PR with correct metadata
---

Commit all staged changes, push to origin, and open a pull request.

Steps:

1. Run `git status` and `git diff --staged` to confirm what's staged.

2. Draft a commit message following the project convention:
   - Format: `type(scope): description` (e.g., `feat(brief): add confidence threshold filter`)
   - Types: feat, fix, chore, docs, refactor, test, perf
   - No "update", "fix", or vague messages
   - No Co-Authored-By lines

3. Run `git commit -m "<message>"`.

4. Run `git push -u origin HEAD`.

5. Open a PR with `gh pr create` including:
   - Title matching the commit message
   - Body referencing the issue(s) this closes (`Closes #N`)
   - Correct milestone (check open milestones with `gh milestone list`)
   - Label: `feature`, `bug`, `chore`, or `security` as appropriate

6. Report the PR URL.

If $ARGUMENTS is provided, use it as context for the commit message and PR description.
