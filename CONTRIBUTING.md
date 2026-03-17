# Contributing to Civic Brief

Thanks for considering a contribution to Civic Brief. This is an open-source civic infrastructure project. Every contribution helps make government information more accessible.

## Quick Start

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/civic-brief.git
cd civic-brief

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
#          NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Run development server
npm run dev

# Run tests
npm test          # Unit tests (vitest)
npm run test:e2e  # E2E tests (Playwright)
npm run typecheck # TypeScript strict mode
```

The app runs at `http://localhost:3000`. The `/brief/demo` page works without any API keys.

## Finding Work

- **[Good first issues](https://github.com/pateljatin/civic-brief/labels/good%20first%20issue)** are a great starting point
- Every issue includes problem context, success criteria, and scope boundaries
- Check the [project board](https://github.com/users/pateljatin/projects/1) for current priorities
- If an issue interests you, comment on it before starting work so we can avoid duplication

## Making Changes

1. Create a feature branch from `main`
2. Write tests alongside your implementation (not after)
3. Run the full test suite before submitting: `npm test && npm run typecheck && npm run build`
4. Submit a PR using the pull request template

## Code Standards

- **TypeScript strict mode** is enabled. No `any` types except documented Supabase join workarounds.
- **Tests required** for all business logic (vitest) and user-facing flows (Playwright).
- **Accessibility**: axe-core scans must pass. Keyboard navigable. WCAG 2.1 AA.
- **Security review** required on any PR touching auth, API routes, or data handling.

See [Engineering Fundamentals](docs/standards/ENGINEERING_FUNDAMENTALS.md) for full details.

## PR Checklist

Every PR is checked against our [product fundamentals](docs/standards/PRODUCT_FUNDAMENTALS.md):

- [ ] Security: input validation, no secrets exposed, OWASP reviewed
- [ ] Privacy: no PII stored/logged, no new tracking, documents still processed in memory only
- [ ] Accessibility: axe-core passes, keyboard navigable
- [ ] Tests: unit and/or E2E tests added, all passing
- [ ] Build: `npm run build` succeeds

## What We Need Help With

| Area | Skills | Examples |
|------|--------|---------|
| **i18n / Translation** | Native speakers, translation experience | Verify Spanish civic terminology, add Hindi UI strings, add new language prompts |
| **Accessibility** | WCAG knowledge, screen reader testing | Improve contrast, add ARIA labels, keyboard navigation |
| **Frontend** | React 19, Next.js, CSS | Mobile responsive polish, loading states, component improvements |
| **AI / Prompts** | Prompt engineering, LLM evaluation | Improve civic-context prompts, tune verification scoring |
| **Civic Domain** | Government document experience | Review summaries for accuracy, suggest new document types |
| **Testing** | Vitest, Playwright | Add test coverage, edge cases, real PDF testing |
| **Documentation** | Technical writing | Improve inline docs, add code examples, tutorials |

## Writing Style

For any user-facing text or documentation:
- No AI jargon or buzzwords
- Never use: "AI-powered", "leverage", "ecosystem", "seamless", "robust", "revolutionary"
- Oxford comma. US English.
- Write like a builder, not a marketer.

## Questions?

- Open a [GitHub Discussion](https://github.com/pateljatin/civic-brief/discussions)
- Email: civicbriefapp@gmail.com

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
