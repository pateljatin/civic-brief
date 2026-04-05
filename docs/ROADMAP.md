# Civic Brief Roadmap

Public roadmap for the Civic Brief project. For detailed feature specifications, see [spec-kit.md](./spec-kit.md).

---

## Phase 1: Demo (April 2026) -- Complete

The working demo for the Mozilla Foundation Democracy x AI Incubator full proposal.

- [x] PDF upload and in-memory text extraction
- [x] Civic-context summarization (what changed, who is affected, what you can do, where the money goes, deadlines)
- [x] LLM-as-Judge independent factuality verification with confidence scoring
- [x] English and Spanish output generated simultaneously
- [x] On-demand translation to additional languages
- [x] Source document verification links
- [x] Google OAuth with usage tracking
- [x] Privacy by design: documents processed in memory, never stored

## Phase 2: Trust Loop (mid-June 2026)

Close the feedback loop. Turn the demo into a trusted civic service. Aligns with Mozilla Incubator selection (mid-June 2026).

- [x] **C7: Automatic document feed ingestion** -- Monitor government RSS/API feeds, auto-trigger pipeline (shipped PR #34, March 2026)
- [x] **C8: Community verification UI** -- Structured feedback (factual errors, missing info, translation issues) (shipped PR #29, March 2026)
- [x] **Scenario Showcase** -- 5 real government documents from across the US (shipped PR #38, April 2026)
- [ ] **C14: PostGIS brief tagging** -- Geographic tagging for zoning and budget briefs
- [ ] **User Dashboard** -- Signed-in user home: my uploads, my feedback, my jurisdictions
- [ ] **Supabase Performance Advisor** -- Re-run after traffic accumulates

## Phase 3: Subscriptions (September 2026)

Location-based alerts, sharing, and engagement features. Aligned to fall election cycle (November 2026).

- [ ] **C9: Location-based subscriptions** -- "Changes near me" via PostGIS
- [ ] **C10: WhatsApp/SMS sharing** -- Formatted brief sharing for messaging platforms
- [ ] **C11: Budget visualization + YoY comparison** -- Charts and personal impact calculators
- [ ] **C12: Notification system** -- Email/push when new briefs match subscriptions
- [ ] **C13: Bill tracking lifecycle** -- Monitor bills from introduction through signature
- [ ] **C15: Property tax impact calculator** -- Personal impact from budget changes
- [ ] **C16: District-wide resolution feed** -- Automatic school board coverage
- [ ] **C17: Community translation verification** -- Bilingual reviewers verify translation quality
- [ ] **Gamification** -- Contribution scores, badges, impact metrics
- [ ] **Jurisdiction Following** -- Users follow multiple jurisdictions (work, home, family)

## Phase 4: Scale (March 2027)

Multi-jurisdiction, multi-language, community-sustained platform.

- [ ] **C18: Newsroom embed widget** -- Drop-in civic brief for news websites
- [ ] **C19: Multi-jurisdiction dashboard** -- Compare across cities, counties, states
- [ ] **C20: International jurisdiction trees** -- India, Nigeria, UK government structures
- [ ] **C21: pgvector semantic search** -- Find related briefs across jurisdictions
- [ ] **C22: Audio briefs (TTS)** -- Text-to-speech for accessibility and mobile
- [ ] **C23: Map visualization** -- Geographic view of zoning and policy changes

---

## Milestones

| Milestone | Target | Description |
|-----------|--------|-------------|
| Demo v1 | April 15, 2026 | Working demo for Mozilla full proposal (COMPLETE) |
| v1.1 Trust Loop | mid-June 2026 | PostGIS tagging, user dashboard. Aligns with Mozilla selection. |
| v1.2 Subscriptions | September 2026 | Location alerts, sharing, notifications. Aligned to Nov election cycle. |
| v2.0 Scale | March 2027 | International expansion, semantic search |

## How to contribute

See the [project board](https://github.com/pateljatin/civic-brief/projects) for current work. Issues labeled `good first issue` are a great starting point. Every issue includes problem context, success criteria, and scope boundaries.
