## What

<!-- Brief description of the changes -->

## Why

Closes #<!-- issue number -->

## Testing

- [ ] Unit tests added/updated
- [ ] E2E tests added/updated (if UI change)
- [ ] All tests passing (`npm test && npm run test:e2e`)
- [ ] Build passes (`npm run build`)

## Product Fundamentals

### Security
- [ ] Input validation at system boundaries
- [ ] No secrets exposed to client
- [ ] OWASP Top 10 reviewed (XSS, injection, CSRF)
- [ ] CSP headers updated if new external domains added

### Privacy
- [ ] No PII stored or logged
- [ ] No new user tracking added
- [ ] Privacy headers intact (`src/proxy.ts`)
- [ ] Documents still processed in memory only (never stored)

### Accessibility
- [ ] axe-core scan passes (no serious/critical violations)
- [ ] Keyboard navigable
- [ ] Screen reader tested (if UI change)
- [ ] Color contrast meets WCAG 2.1 AA

## Screenshots (if UI change)

<!-- Add before/after screenshots -->
