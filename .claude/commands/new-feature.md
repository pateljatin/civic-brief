---
name: new-feature
description: Kick off a new feature — brainstorm requirements, write spec, create GitHub issue
disable-model-invocation: true
---

Start a new feature from scratch using the full planning workflow.

Feature: $ARGUMENTS

Steps:

1. **Brainstorm**: Invoke the `superpowers:brainstorming` skill to refine requirements through Socratic questioning. Cover: what problem this solves, who it affects, edge cases, technical approach, what's NOT in scope.

2. **Spec**: Write a spec following all rules in @docs/claude/spec-rules.md. Include:
   - Files to create/modify
   - TypeScript types for any new API responses
   - Five states for every UI component (default, loading, empty, error, demo)
   - State machine table for conditional rendering
   - Explicit NOT IN SCOPE section
   - Verification steps (how you'll know it works)

3. **Create GitHub issue**: Run `gh issue create` with:
   - Title: `[Cx] Feature name` (next available C number)
   - Body: the full spec
   - Milestone: appropriate v1.x milestone
   - Label: `feature`
   - Assignee: `pateljatin`

4. Report the issue URL and confirm the spec is saved locally.

Do not start implementation in this session — new-feature is planning only.
