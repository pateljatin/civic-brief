# Scenario Showcase Design Spec

**Status:** Approved (brainstorming session 2026-03-21)
**Issue:** New (to be created)
**Milestone:** v1.1 Trust Loop

---

## 1. Purpose and Success Criteria

Build a `/showcase` route presenting 5 pre-processed civic briefs, one per PRD scenario (Budget, School Board, Zoning, State Legislation, Multilingual), using real Washington State government documents. Each card tells a human story and links to a curated detail page with narrative context + the full civic brief.

**Success criteria:**
- 5 real WA government PDFs processed through the existing pipeline
- `/showcase` renders all 5 story cards with Apple-style scroll animations
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
| 2 | Document source | Real WA government PDFs from seed jurisdictions | Consistent with existing jurisdiction data (Seattle, King County, Sammamish, Issaquah, WA State) |
| 3 | Card layout | Option D: vertical story cards with colored icon panels | B's storytelling + C's visual polish. All 5 visible without scrolling. |
| 4 | Detail page | `/showcase/[scenario]` with narrative header + CivicBrief | Human context before data; reuses existing CivicBrief component |
| 5 | Animations | Apple-style CSS-only (no Framer Motion/GSAP) | Scroll fade-in, hover scale, page load slideUp, confidence count-up |
| 6 | Data model | Static config array + Supabase brief IDs | No new tables, no new migrations |
| 7 | Document processing | Manual one-time via existing `/api/summarize` | No new API routes needed |
| 8 | Navigation | Homepage gets "See it in action" link to `/showcase` | Minimal homepage change |

---

## 3. Architecture

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
  briefId: string;         // UUID from briefs table (populated after processing)
  sourceUrl: string;       // URL to original government document
}

export const scenarios: ScenarioConfig[];
```

**Scenarios:**

| Slug | Title | Jurisdiction | Document Type |
|------|-------|-------------|---------------|
| `budget` | Budget Season | King County / Seattle, WA | City/county budget |
| `school-board` | School Board | Issaquah, WA | School board resolution or minutes |
| `zoning` | Zoning Change | Sammamish, WA | Zoning/land use proposal |
| `legislation` | State Legislation | Washington State | State bill or legislative action |
| `multilingual` | Multilingual | Seattle, WA | Public notice (EN/ES/HI) |

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

### ConfidenceCountUp

**Props:**
```typescript
interface ConfidenceCountUpProps {
  value: number;            // 0-100
  className?: string;
}
```

Client component (`'use client'`). On first viewport entry, animates from 0 to `value` over 800ms using `requestAnimationFrame` + ease-out curve. Renders as `{value}%`.

---

## 6. Animation Spec

All animations are CSS-only (no animation libraries).

| Animation | Trigger | Duration | Easing | Properties |
|-----------|---------|----------|--------|------------|
| Card fade-in | Scroll into viewport | 500ms | ease-out | opacity, transform(translateY) |
| Card stagger | Per card index | +100ms delay per card | — | transition-delay |
| Card hover | Mouse enter | 200ms | ease-out | transform(scale), box-shadow |
| Arrow hover shift | Mouse enter (card) | 200ms | ease-out | transform(translateX) |
| Hero slide-up | Page mount | 400ms | ease-out | opacity, transform(translateY) |
| Confidence count-up | First viewport entry | 800ms | ease-out | text content (JS) |
| Brief content fade | Page mount | 300ms, 200ms delay | ease-out | opacity |

**Reduced motion:** All animations respect `prefers-reduced-motion: reduce`. When reduced motion is preferred, all transitions are instant (0ms duration).

---

## 7. Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| Desktop (>768px) | Cards: icon panel (80px) + content side by side. Max-width 800px centered. |
| Mobile (<=768px) | Cards: icon panel as header bar (emoji + title + arrow in row), narrative below. Full-width with 16px padding. |

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

Add a single "See it in action" link/button in the existing homepage, below the pipeline steps section and above the stats section. Links to `/showcase`.

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
- Multilingual scenario: language toggle works, switches brief content
- Accessibility: axe-core scan on `/showcase` and one detail page
- Security headers present on all new routes

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

---

## 12. Document Sourcing Checklist

Before implementation, manually source and process:

| Scenario | Document to Find | Source |
|----------|-----------------|--------|
| Budget | Seattle or King County 2025/2026 proposed or adopted budget | seattle.gov or kingcounty.gov |
| School Board | Issaquah School District board resolution or meeting minutes | issaquah.wednet.edu |
| Zoning | Sammamish or nearby city zoning/land use proposal | sammamish.us |
| Legislation | WA state bill (housing, education, or transportation) | leg.wa.gov |
| Multilingual | Seattle public notice (utility rates, public hearing, etc.) | seattle.gov |

Each document is processed once via the upload page. The resulting brief UUID is recorded in `src/lib/showcase.ts`.

---

## 13. Concurrent Request Scenarios

Not applicable -- no write paths in this feature. All showcase data is read-only (static config + Supabase reads).

---

## 14. Platform API Contracts

**Supabase read:**
```typescript
// Fetch brief by ID
const { data, error } = await supabaseServer
  .from('briefs')
  .select('*')
  .eq('id', briefId)
  .maybeSingle();
```

Uses `.maybeSingle()` per Supabase patterns (brief may have been deleted). Error state renders "Brief unavailable" in the card/hero.

---

## 15. Environment Variables

No new environment variables required. Uses existing `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for server-side brief fetches.

---

## 16. Deployment Config

No new Vercel function config needed. Showcase pages are standard Server Components with no special timeout or memory requirements.
