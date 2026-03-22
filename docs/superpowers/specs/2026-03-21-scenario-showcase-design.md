# Scenario Showcase Design Spec

**Status:** Approved (brainstorming session 2026-03-21)
**Issue:** New (to be created)
**Milestone:** v1.1 Trust Loop

---

## 1. Purpose and Success Criteria

Build a `/showcase` route presenting 5 pre-processed civic briefs, one per PRD scenario (Budget, School Board, Zoning, State Legislation, Health Insurance), using real government documents. Each card tells a human story and links to a curated detail page with narrative context + the full civic brief.

**Success criteria:**
- 5 real government PDFs processed through the existing pipeline (3 local WA, 1 state WA, 1 federal US+CA)
- `/showcase` renders all 5 story cards with scroll-triggered animations via IntersectionObserver
- `/showcase/[scenario]` renders narrative context + CivicBrief component
- Homepage links to showcase
- Mobile-first responsive layout
- All existing tests continue to pass
- New E2E tests cover showcase pages (desktop + mobile)
- Accessibility: axe-core WCAG 2.1 AA compliance

---

## 2. Product Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Route location | `/showcase` (new route) | Homepage stays as-is; showcase can later become homepage when mission moves to `/about` |
| 2 | Document source | Real government PDFs from seed jurisdictions + federal | 3 local (Seattle, Sammamish, Issaquah), 1 state (WA), 1 federal (US/CA) |
| 3 | Card layout | Option D: vertical story cards with colored icon panels | B's storytelling + C's visual polish. All 5 visible without scrolling. |
| 4 | Detail page | `/showcase/[scenario]` with narrative header + CivicBrief | Human context before data; reuses existing CivicBrief component |
| 5 | Animations | Polished motion design with GPU-composited transitions, CSS-only (no Framer Motion/GSAP) | Scroll-triggered animations via IntersectionObserver, micro-interactions (hover scale, shadow lift, arrow nudge), staggered reveal with transition-delay, confidence count-up |
| 6 | Data model | Static config array + Supabase brief IDs | No new tables, no new migrations |
| 7 | Document processing | Manual one-time via existing `/api/summarize` | No new API routes needed |
| 8 | Navigation | Homepage gets "See it in action" link to `/showcase` | Minimal homepage change |

**Multilingual is a cross-cutting feature, not a scenario.** The language toggle (LanguageToggle component) is available on every `/showcase/[scenario]` detail page where translations exist in the briefs table. It is not limited to a single scenario. The health insurance scenario naturally demonstrates English + Spanish because Covered California publishes bilingual materials, but any scenario with translated briefs gets the toggle.

---

## 3. Architecture

All new files, components, routes, and test files follow `docs/standards/NAMING_CONVENTIONS.md`.

### Data Flow

```
Manual PDF upload (one-time, 5 documents)
  → /api/summarize (existing pipeline)
  → briefs table (existing)
  → brief IDs recorded in src/lib/showcase.ts

/showcase page (Server Component)
  → reads static config from src/lib/showcase.ts
  → fetches 5 briefs by ID from Supabase
  → renders ScenarioCard[] with staggered animations

/showcase/[scenario] page (Server Component)
  → looks up slug in static config
  → fetches brief by ID from Supabase
  → renders ScenarioHero + CivicBrief + LanguageToggle
```

### File Map

```
src/
  lib/
    showcase.ts                    # NEW: static scenario config array
  app/
    showcase/
      page.tsx                     # NEW: showcase grid (Server Component)
      [scenario]/
        page.tsx                   # NEW: scenario detail (Server Component)
  components/
    ScenarioCard.tsx               # NEW: story card with animations
    ScenarioHero.tsx               # NEW: narrative header for detail page
    ScrollFadeIn.tsx               # NEW: client component, Intersection Observer wrapper
    ConfidenceCountUp.tsx          # NEW: client component, animated count-up
    CivicBrief.tsx                 # EXISTING: no changes
    ConfidenceScore.tsx            # EXISTING: no changes
    LanguageToggle.tsx             # EXISTING: no changes
    SourceLink.tsx                 # EXISTING: no changes
  app/
    page.tsx                       # MODIFIED: add "See it in action" link
```

### Render Trees

**`/showcase` page:**
```
showcase/page.tsx (Server Component)
  <main>
    <h1> "Five Stories. Five Communities."
    <p> subtitle
    {scenarios.map((scenario, i) => (
      <ScrollFadeIn delay={i * 100}>        // 'use client', IntersectionObserver
        <ScenarioCard>                       // Server Component (receives pre-fetched data)
          <a href="/showcase/{slug}" aria-label="Read about {title} - {jurisdiction}">
            <div> icon panel (emoji + gradient bg)
            <div> content
              <h2> title
              <p> narrative
              <span> jurisdiction badge
              <ConfidenceCountUp value={confidence}>  // 'use client', rAF animation
              <span> arrow →
          </a>
        </ScenarioCard>
      </ScrollFadeIn>
    ))}
  </main>
```

**`/showcase/[scenario]` page:**
```
showcase/[scenario]/page.tsx (Server Component)
  → notFound() if slug not in scenarios config
  <main>
    <a href="/showcase"> ← Back to all stories
    <ScenarioHero>                           // Server Component
      <div> icon + gradient
      <h1> title
      <p> story (full paragraph)
      <span> jurisdiction
      <span> document title
      <ConfidenceScore score={factuality_score}>  // EXISTING, expects 0-1 float
      <SourceLink url={sourceUrl}>                // EXISTING
    </ScenarioHero>
    <CivicBrief                              // EXISTING, 'use client'
      briefId={briefId}
      content={brief.content}
      headline={brief.headline}
      confidenceScore={sources.factuality_score}  // 0-1 float
      confidenceLevel={sources.confidence_level}
      sourceUrl={sources.source_url}
      sourceTitle={sources.title}
      language={brief.languages.bcp47}
      availableLanguages={availableLanguages}      // pre-fetched from briefs table
      isDemo={false}                               // real briefs, real source links
    />
  </main>
```

**`page.tsx` (homepage) — insertion point:**
The "See it in action" link is inserted between the Pipeline section (`.l-pipeline`, ~line 230) and the Verification section (`.l-verify-wrap`, ~line 251).

---

## 4. Static Config Shape

```typescript
// src/lib/showcase.ts

export interface ScenarioConfig {
  slug: string;
  title: string;
  icon: string;
  color: string;          // gradient start color for icon panel
  jurisdiction: string;
  narrative: string;       // 1-2 sentence human hook (showcase card)
  story: string;           // fuller paragraph (detail page hero)
  documentTitle: string;   // original document name
  briefId: string | null;  // UUID from briefs table (null until document is processed)
  sourceUrl: string;       // URL to original government document
}

export function getScenarioBySlug(slug: string): ScenarioConfig | undefined;
```

**Note:** `briefId` is `string | null`. Before documents are sourced, it is `null`. Components handle this: ScenarioCard shows "Coming soon" in place of narrative; detail page returns `notFound()` if briefId is null.

**Confidence score scale:** The `ConfidenceCountUp` component displays 0-100 integers (rendered as `{value}%`). The Supabase `sources.factuality_score` is a 0-1 float. Conversion happens at the page level: `Math.round(factuality_score * 100)`. The existing `ConfidenceScore` component receives the raw 0-1 float unchanged.

**Stale briefId maintenance:** If a document is re-processed (creating a new brief ID), the `briefId` in `showcase.ts` must be manually updated. This is acceptable for 5 curated entries.

export const scenarios: ScenarioConfig[];
```

**Scenarios:**

| Slug | Title | Level | Jurisdiction | Document Type |
|------|-------|-------|-------------|---------------|
| `budget` | Budget Season | Local | King County / Seattle, WA | City/county budget |
| `school-board` | School Board | Local | Issaquah, WA | School board resolution or minutes |
| `zoning` | Zoning Change | Local | Sammamish, WA | Zoning/land use proposal |
| `legislation` | State Legislation | State | Washington State | State bill or legislative action |
| `health-insurance` | Health Insurance & Rx Costs | Federal | US Federal / California | CMS/HHS rule on drug pricing or insurance marketplace changes |

---

## 5. Component Specs

### ScenarioCard

**Props:**
```typescript
interface ScenarioCardProps {
  scenario: ScenarioConfig;
  confidence: number;       // from fetched brief
  index: number;            // for stagger delay
}
```

**Five states:**
| State | Rendered Output |
|-------|-----------------|
| Default | Colored icon panel + title + narrative + jurisdiction badge + confidence badge + arrow |
| Hover | Scale 1.02x, elevated shadow, arrow shifts right 4px |
| Loading | Not applicable (Server Component, data fetched at request time) |
| Empty | Not applicable (static config, briefs pre-populated) |
| Error | If brief fetch fails: card renders without confidence badge, shows "Brief unavailable" in place of narrative |

**Animations:**
- Scroll fade-in via `ScrollFadeIn` wrapper: `opacity: 0 → 1`, `translateY(24px) → 0`, `transition-delay: index * 100ms`
- Hover: `transform: scale(1.02)`, `box-shadow` transition, 200ms ease-out

### ScenarioHero

**Props:**
```typescript
interface ScenarioHeroProps {
  scenario: ScenarioConfig;
  confidence: number;
}
```

**Five states:**
| State | Rendered Output |
|-------|-----------------|
| Default | Icon + title + story paragraph + jurisdiction + document title + confidence + source link |
| Loading | Not applicable (Server Component) |
| Empty | Not applicable (static config) |
| Error | If brief unavailable: hero renders with "This brief is currently unavailable. Please try again later." |
| Demo | Not applicable (these ARE the demo) |

**Animation:** `@keyframes slideUp` on mount — `opacity: 0 → 1`, `translateY(16px) → 0`, 400ms ease-out

### ScrollFadeIn

**Props:**
```typescript
interface ScrollFadeInProps {
  children: React.ReactNode;
  delay?: number;           // transition-delay in ms
  className?: string;
}
```

Client component (`'use client'`). Uses `IntersectionObserver` with `threshold: 0.1` and `rootMargin: '0px 0px -40px 0px'`. Adds/removes a `visible` class that triggers the CSS transition. Fires once (unobserves after first intersection).

**Five states:**
| State | Rendered Output |
|-------|-----------------|
| Default (before intersection) | Children rendered with `opacity: 0`, `translateY(24px)` |
| Default (after intersection) | Children rendered with `opacity: 1`, `translateY(0)` |
| Loading | Not applicable (renders children immediately) |
| Empty | Not applicable (always has children) |
| Error | Not applicable (pure wrapper, no failure modes) |
| No IntersectionObserver (SSR/old browser) | Children rendered fully visible (no animation). Fallback: render with `visible` class by default if `typeof IntersectionObserver === 'undefined'`. |

### ConfidenceCountUp

**Props:**
```typescript
interface ConfidenceCountUpProps {
  value: number;            // 0-100 (integer percentage)
  className?: string;
}
```

Client component (`'use client'`). On first viewport entry, animates from 0 to `value` over 800ms using `requestAnimationFrame` + ease-out curve. Renders as `{value}%`.

**Five states:**
| State | Rendered Output |
|-------|-----------------|
| Default (before viewport entry) | Renders `0%` (initial) |
| Default (after animation) | Renders `{value}%` (final) |
| Loading | Not applicable (value is a prop, not fetched) |
| Empty | Not applicable (always has a value) |
| Error | If value < 0 or > 100, clamp to 0-100 range |
| Reduced motion | If `prefers-reduced-motion: reduce`, skip animation and render `{value}%` immediately. Check via `window.matchMedia('(prefers-reduced-motion: reduce)')` on mount. |
| No IntersectionObserver | Render `{value}%` immediately (no animation). |

---

## 6. Animation Spec

All animations are CSS-only (no animation libraries). All motion design follows `docs/standards/DESIGN_PRINCIPLES.md`.

| Animation | Trigger | Duration | Easing | Properties |
|-----------|---------|----------|--------|------------|
| Card fade-in | Scroll into viewport | 500ms | ease-out | opacity, transform(translateY) |
| Card stagger | Per card index | +100ms delay per card | — | transition-delay |
| Card hover | Mouse enter | 200ms | ease-out | transform(scale), box-shadow |
| Arrow hover shift | Mouse enter (card) | 200ms | ease-out | transform(translateX) |
| Hero slide-up | Page mount | 400ms | ease-out | opacity, transform(translateY) |
| Confidence count-up | First viewport entry | 800ms | ease-out | text content (JS) |
| Brief content fade | Page mount | 300ms, 200ms delay | ease-out | opacity |

**Reduced motion:** All animations respect `prefers-reduced-motion: reduce`. When reduced motion is preferred:
- CSS transitions: `0ms` duration via `@media (prefers-reduced-motion: reduce)` in globals.css
- JS count-up (ConfidenceCountUp): check `window.matchMedia('(prefers-reduced-motion: reduce)')` on mount; if true, render final value immediately without animation

---

## 7. Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| Desktop (>768px) | Cards: icon panel (80px) + content side by side. Max-width 800px centered. |
| Mobile (<=768px) | Cards: icon panel as header bar (emoji + title + arrow in row), narrative below. Full-width with 16px padding. |

**Detail page (`/showcase/[scenario]`) responsive:**

| Breakpoint | Layout |
|------------|--------|
| Desktop (>768px) | ScenarioHero: icon left, text right, max-width 800px centered. CivicBrief below at max-width 640px. |
| Mobile (<=768px) | ScenarioHero: icon centered above title, story text full-width with 16px padding, font-size 15px. CivicBrief stacks naturally. |

---

## 8. Accessibility

- All cards are `<a>` elements (or contain one) for keyboard navigation
- Focus visible ring on cards (`:focus-visible` outline)
- `aria-label` on each card: "Read about {title} - {jurisdiction}"
- Color contrast: all text meets WCAG AA (4.5:1 ratio for body, 3:1 for large text)
- Reduced motion support (see animation spec)
- Semantic heading hierarchy: `<h1>` on page title, `<h2>` on card titles
- axe-core scan in E2E tests

---

## 9. Homepage Change

Add a single "See it in action" link/button in the existing homepage, between the Pipeline section (`.l-pipeline`) and the Verification section (`.l-verify-wrap`). Links to `/showcase`.

**Render condition:** Always visible. No loading/empty/error states (it's a static link).

---

## 10. Testing Plan

### Unit Tests (Vitest)
- `showcase.test.ts`: Config validation (all 5 scenarios have required fields, slugs are unique, briefIds are valid UUIDs)
- `ScenarioCard.test.tsx`: Renders title, narrative, jurisdiction, confidence badge. Renders error state when brief is null.
- `ScenarioHero.test.tsx`: Renders story, document title, source link. Renders error state.
- `ScrollFadeIn.test.tsx`: Applies visible class when IntersectionObserver fires.
- `ConfidenceCountUp.test.tsx`: Renders final value.

### E2E Tests (Playwright)
- `/showcase` loads, all 5 cards visible (desktop + mobile)
- Each card links to correct `/showcase/[slug]`
- Each detail page renders narrative hero + civic brief content
- Health insurance scenario: language toggle works (EN/ES), switches brief content
- `/showcase/nonexistent-slug` returns 404
- Accessibility: axe-core scan on `/showcase` and one detail page
- Security headers present on all new routes

### Regression Tests
- Run full existing test suite before merge: `npm test` (228 unit/integration) + `npm run test:e2e` (60 E2E)
- All must pass before merge
- Any test that breaks = stop and investigate, do not skip

### Edge Case Tests (Unit)
- `ConfidenceCountUp`: renders final value immediately when reduced motion is preferred
- `ScrollFadeIn`: renders children visible when IntersectionObserver is unavailable
- `ScenarioCard`: renders "Coming soon" when briefId is null
- Showcase grid: gracefully handles 1 of 5 briefs missing from DB (4 cards render normally, 1 shows error)

---

## 11. NOT in Scope

- Homepage redesign (future: move mission to `/about`, promote showcase)
- New database tables or migrations
- New API routes
- Budget visualization or financial parsing
- Document sourcing automation (manually find and process 5 PDFs)
- Animation library (Framer Motion, GSAP) -- CSS only
- Scenario-specific UI per card type (all 5 use same card/detail layout)
- SEO/OG image generation for showcase pages
- Analytics events for showcase interactions
- Mobile app-specific behavior beyond responsive CSS
- Narrative text for characters (Maria, James, etc.) from PRD -- we write new context-appropriate copy
- i18n of showcase UI chrome (card titles, narratives, hero stories are English-only; only CivicBrief content switches languages)

---

## 12. Document Sourcing Checklist

Before implementation, manually source and process:

| Scenario | Document to Find | Source |
|----------|-----------------|--------|
| Budget | Seattle or King County 2025/2026 proposed or adopted budget | seattle.gov or kingcounty.gov |
| School Board | Issaquah School District board resolution or meeting minutes | issaquah.wednet.edu |
| Zoning | Sammamish or nearby city zoning/land use proposal | sammamish.us |
| Legislation | WA state bill (housing, education, or transportation) | leg.wa.gov |
| Health Insurance | CMS/HHS final rule on drug pricing, insurance coverage, or marketplace changes | federalregister.gov or cms.gov |

Each document is processed once via the upload page. The resulting brief UUID is recorded in `src/lib/showcase.ts`.

**For the health insurance scenario (multilingual angle):** After initial processing (creates EN brief), pair with a Covered California implementation notice (coveredca.com) in English + Spanish. Use the upload page's language toggle to generate ES translation via `/api/translate`. This creates additional brief rows sharing the same `source_id`, which the detail page uses for the LanguageToggle. Any scenario with translated briefs gets the language toggle automatically.

---

## 13. Concurrent Request Scenarios

Not applicable -- no write paths in this feature. All showcase data is read-only (static config + Supabase reads).

---

## 14. Platform API Contracts

**Batch fetch for /showcase grid (one round trip):**
```typescript
const { data: briefs, error } = await supabaseServer
  .from('briefs')
  .select('id, headline, content, source_id, sources(factuality_score, confidence_level)')
  .in('id', scenarios.filter(s => s.briefId).map(s => s.briefId));
```
Returns array. Match back to scenarios by `brief.id === scenario.briefId`. Scenarios with null briefId or missing brief render the error state.

**Detail fetch for /showcase/[scenario] (with joins):**
```typescript
const { data: brief, error } = await supabaseServer
  .from('briefs')
  .select('id, headline, content, source_id, sources(source_url, title, factuality_score, confidence_level), languages(bcp47)')
  .eq('id', briefId)
  .maybeSingle();
```

**Available languages fetch (for multilingual scenario toggle):**
```typescript
const { data: translations } = await supabaseServer
  .from('briefs')
  .select('id, languages(bcp47)')
  .eq('source_id', brief.source_id);
```
Returns all briefs sharing the same source document, giving us the list of available languages for the LanguageToggle.

Uses `.maybeSingle()` per Supabase patterns (brief may have been deleted). If null, detail page returns `notFound()`.

---

## 15. Environment Variables

No new environment variables required. Uses existing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for server-side brief fetches.

---

## 16. Deployment Config

No new Vercel function config needed. Showcase pages are standard Server Components with no special timeout or memory requirements.
