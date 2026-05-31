# Security and Privacy

## Privacy Posture (enforced at infrastructure level)

- NEVER store uploaded documents (processed in memory, discarded)
- NEVER collect personal information (no accounts, no login)
- NEVER track individual users (only aggregate Vercel Analytics)
- NEVER set cookies (no sessions, no tracking)
- Store ONLY our generated civic briefs and source URLs

## Security Layers

- **next.config.js**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy, Referrer-Policy
- **src/proxy.ts**: Privacy headers on every response, no-cache on API routes; CSP lives here (per-request) not in next.config.js headers
- **src/lib/security.ts**: Rate limiting (10 req/min per IP), URL validation (rejects javascript:/data:/file:), file validation (PDF only, 10MB max), text sanitization, UUID validation
- **src/lib/rate-limit.ts**: Persistent rate limiting via Supabase (migration 010), fail-open
- **src/lib/prompt-sanitize.ts**: Injection pattern stripping; all prompts wrapped in XML delimiters
- **src/lib/ssrf.ts**: SSRF protection with `timingSafeCompare` for cron auth
- **API routes**: Input validation, content-type checking, error message sanitization (no stack traces to client)

## Known Limitations

- Dropping `unsafe-inline` from CSP breaks RSC hydration on Next.js 16 + Turbopack. Reverted in PR #62 / issue #61. Path back to nonces blocked on Next.js 16 + Turbopack auto-nonce reliability.
- Verify endpoint requires auth. Trust degrades only (score can go down, never up) on re-verify.
- Cron auth uses `timingSafeCompare` (fixed padEnd bug in C17).
