# Product Fundamentals

Every feature (C1-C23) must satisfy these checklists before shipping. These are embedded in our PR template so nothing slips through.

---

## Security Checklist

- [ ] Input validation at system boundaries (user input, external APIs)
- [ ] OWASP Top 10 review (XSS, injection, CSRF, etc.)
- [ ] API rate limiting applied
- [ ] Secrets never exposed to client
- [ ] CSP headers updated if new external domains added
- [ ] Dependency audit (no known CVEs via `npm audit`)

## Privacy Checklist (Global Compliance)

### GDPR (EU)
- [ ] No PII processed without lawful basis
- [ ] Data minimization: only collect what is strictly necessary
- [ ] Right to erasure honored if applicable

### DPDPA (India)
- [ ] Digital personal data consent obtained if processing Indian citizen data
- [ ] Data fiduciary obligations met

### CCPA/CPRA (California)
- [ ] Do-not-sell compliance
- [ ] Consumer right to know and delete honored

### General Privacy
- [ ] No document storage (enforced architecturally: in-memory processing only)
- [ ] No user tracking beyond aggregate analytics (Vercel Analytics)
- [ ] No cookies for tracking
- [ ] Privacy headers on all responses (`src/proxy.ts`)
- [ ] No PII in logs, error messages, or URLs
- [ ] For each new feature: answer "what personal data does this touch?"
  - If none, document why
  - If any, document lawful basis

## Accessibility Checklist (WCAG 2.1 AA)

- [ ] axe-core scan passes (no serious/critical violations)
- [ ] Keyboard navigable (all interactive elements reachable via Tab)
- [ ] Screen reader tested (aria labels, semantic HTML)
- [ ] Color contrast >= 4.5:1 for text, >= 3:1 for large text
- [ ] Touch targets >= 44x44px on mobile
- [ ] No information conveyed by color alone
- [ ] Focus visible on all interactive elements

---

## How These Are Enforced

1. **PR template** includes a condensed version of all three checklists
2. **CI pipeline** runs axe-core, TypeScript strict mode, and security header tests
3. **Code review** verifies security and privacy claims before merge
