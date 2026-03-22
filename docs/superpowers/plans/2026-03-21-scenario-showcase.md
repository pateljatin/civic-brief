# Scenario Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** Build a `/showcase` route presenting 5 pre-processed civic briefs (one per PRD scenario) using real WA government documents, with Apple-style scroll animations, narrative context, and mobile-first responsive layout.

**Spec:** `docs/superpowers/specs/2026-03-21-scenario-showcase-design.md`

## Task Overview

| # | Task | Files | Tests | Depends on |
|---|------|-------|-------|------------|
| 1 | Static config + types | `src/lib/showcase.ts` | `tests/unit/showcase.test.ts` | None |
| 2 | ScrollFadeIn client component | `src/components/ScrollFadeIn.tsx` | `tests/unit/scroll-fade-in.test.tsx` | None |
| 3 | ConfidenceCountUp client component | `src/components/ConfidenceCountUp.tsx` | `tests/unit/confidence-count-up.test.tsx` | None |
| 4 | ScenarioCard component | `src/components/ScenarioCard.tsx` | `tests/unit/scenario-card.test.tsx` | Tasks 1, 2, 3 |
| 5 | ScenarioHero component | `src/components/ScenarioHero.tsx` | `tests/unit/scenario-hero.test.tsx` | Task 1 |
| 6 | `/showcase` page | `src/app/showcase/page.tsx` | Via E2E (Task 10) | Tasks 1, 4 |
| 7 | `/showcase/[scenario]` page | `src/app/showcase/[scenario]/page.tsx` | Via E2E (Task 10) | Tasks 1, 5 |
| 8 | Homepage modification | `src/app/page.tsx` | Via E2E (Task 10) | None |
| 9 | CSS animations + globals | `src/app/globals.css` | Visual verification | None |
| 10 | E2E tests | `tests/e2e/showcase.spec.ts` | 10+ specs x 2 viewports | Tasks 6, 7, 8 |
| 11 | Document sourcing | Manual: find 5 real PDFs, process, record IDs | Manual verification | Tasks 6, 7 |

### Parallelization Note

- **Independent roots:** Tasks 1, 2, 3, 8, 9 can all start in parallel
- **After Task 1:** Tasks 4, 5 can run in parallel
- **After Tasks 2, 3, 4:** Task 6 can start
- **After Task 5:** Task 7 can start
- **Sequential tail:** Tasks 10, 11 run after all UI tasks complete

---

### Task 1: Static Config + Types

**Files:**
- Create: `src/lib/showcase.ts`
- Create: `tests/unit/showcase.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/showcase.test.ts
import { describe, it, expect } from 'vitest';
import { scenarios, type ScenarioConfig } from '@/lib/showcase';

describe('showcase config', () => {
  it('exports exactly 5 scenarios', () => {
    expect(scenarios).toHaveLength(5);
  });

  it('has unique slugs', () => {
    const slugs = scenarios.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has all required slugs', () => {
    const slugs = scenarios.map((s) => s.slug);
    expect(slugs).toContain('budget');
    expect(slugs).toContain('school-board');
    expect(slugs).toContain('zoning');
    expect(slugs).toContain('legislation');
    expect(slugs).toContain('multilingual');
  });

  it.each(['slug', 'title', 'icon', 'color', 'jurisdiction', 'narrative', 'story', 'documentTitle', 'briefId', 'sourceUrl'] as const)(
    'every scenario has non-empty %s',
    (field) => {
      for (const scenario of scenarios) {
        expect(scenario[field as keyof ScenarioConfig], `${scenario.slug}.${field}`).toBeTruthy();
      }
    }
  );

  it('briefIds are valid UUID format', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const scenario of scenarios) {
      expect(scenario.briefId, `${scenario.slug} briefId`).toMatch(uuidRegex);
    }
  });

  it('sourceUrls are valid HTTP(S) URLs', () => {
    for (const scenario of scenarios) {
      expect(() => new URL(scenario.sourceUrl)).not.toThrow();
      expect(scenario.sourceUrl).toMatch(/^https?:\/\//);
    }
  });

  it('getScenarioBySlug returns correct scenario', () => {
    const { getScenarioBySlug } = require('@/lib/showcase');
    expect(getScenarioBySlug('budget')?.slug).toBe('budget');
    expect(getScenarioBySlug('nonexistent')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Implement**

Create `src/lib/showcase.ts` with:
- `ScenarioConfig` interface (slug, title, icon, color, jurisdiction, narrative, story, documentTitle, briefId, sourceUrl)
- `scenarios` array with all 5 entries. Use placeholder UUIDs (`00000000-0000-0000-0000-000000000101` through `...0105`) for briefIds until Task 11.
- `getScenarioBySlug(slug: string): ScenarioConfig | undefined` helper function

Scenario data per the spec:

| Slug | Title | Icon | Color | Jurisdiction |
|------|-------|------|-------|-------------|
| `budget` | Budget Season | `\u{1F4B0}` | `#f59e0b` | King County, WA |
| `school-board` | School Board | `\u{1F3EB}` | `#8b5cf6` | Issaquah, WA |
| `zoning` | Zoning Change | `\u{1F3D7}` | `#10b981` | Sammamish, WA |
| `legislation` | State Legislation | `\u{1F4DC}` | `#3b82f6` | Washington State |
| `multilingual` | Multilingual | `\u{1F310}` | `#ec4899` | Seattle, WA |

Write narrative (1-2 sentence human hook) and story (fuller paragraph) for each. The narrative appears on the card; the story appears on the detail page hero. Write from the citizen's perspective, not the government's.

- [ ] **Step 3: Verify**

Run `npx vitest run tests/unit/showcase.test.ts` -- all 7 tests pass.

---

### Task 2: ScrollFadeIn Client Component

**Files:**
- Create: `src/components/ScrollFadeIn.tsx`
- Create: `tests/unit/scroll-fade-in.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/scroll-fade-in.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScrollFadeIn from '@/components/ScrollFadeIn';

// Mock IntersectionObserver
let observerCallback: IntersectionObserverCallback;
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', vi.fn((cb) => {
    observerCallback = cb;
    return { observe: mockObserve, unobserve: mockUnobserve, disconnect: mockDisconnect };
  }));
  mockObserve.mockClear();
  mockUnobserve.mockClear();
  mockDisconnect.mockClear();
});

describe('ScrollFadeIn', () => {
  it('renders children', () => {
    render(<ScrollFadeIn><p>Hello</p></ScrollFadeIn>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('starts without visible class', () => {
    const { container } = render(<ScrollFadeIn><p>Test</p></ScrollFadeIn>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('scroll-fade-in')).toBe(true);
    expect(wrapper.classList.contains('visible')).toBe(false);
  });

  it('adds visible class when intersection fires', () => {
    const { container } = render(<ScrollFadeIn><p>Test</p></ScrollFadeIn>);
    const wrapper = container.firstChild as HTMLElement;

    // Simulate intersection
    observerCallback(
      [{ isIntersecting: true, target: wrapper } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );

    expect(wrapper.classList.contains('visible')).toBe(true);
  });

  it('unobserves after first intersection (fires once)', () => {
    const { container } = render(<ScrollFadeIn><p>Test</p></ScrollFadeIn>);
    const wrapper = container.firstChild as HTMLElement;

    observerCallback(
      [{ isIntersecting: true, target: wrapper } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );

    expect(mockUnobserve).toHaveBeenCalledWith(wrapper);
  });

  it('applies custom delay as transition-delay', () => {
    const { container } = render(<ScrollFadeIn delay={200}><p>Test</p></ScrollFadeIn>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.transitionDelay).toBe('200ms');
  });

  it('passes through className', () => {
    const { container } = render(<ScrollFadeIn className="extra"><p>Test</p></ScrollFadeIn>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('extra')).toBe(true);
  });
});
```

- [ ] **Step 2: Implement**

Create `src/components/ScrollFadeIn.tsx`:
- `'use client'` directive
- Props: `children`, `delay?: number`, `className?: string`
- Uses `useRef` for the wrapper div and `useEffect` to set up `IntersectionObserver` with `threshold: 0.1` and `rootMargin: '0px 0px -40px 0px'`
- On intersection: add `visible` class and `unobserve` (fire once)
- Wrapper div has class `scroll-fade-in` (plus `visible` when triggered)
- Apply `transitionDelay` inline style from `delay` prop
- Cleanup: disconnect observer on unmount

- [ ] **Step 3: Verify**

Run `npx vitest run tests/unit/scroll-fade-in.test.tsx` -- all 6 tests pass.

---

### Task 3: ConfidenceCountUp Client Component

**Files:**
- Create: `src/components/ConfidenceCountUp.tsx`
- Create: `tests/unit/confidence-count-up.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/confidence-count-up.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConfidenceCountUp from '@/components/ConfidenceCountUp';

let observerCallback: IntersectionObserverCallback;
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', vi.fn((cb) => {
    observerCallback = cb;
    return { observe: mockObserve, unobserve: mockUnobserve, disconnect: vi.fn() };
  }));
  mockObserve.mockClear();
  mockUnobserve.mockClear();
});

describe('ConfidenceCountUp', () => {
  it('renders the target value with percent sign', () => {
    render(<ConfidenceCountUp value={92} />);
    // Before animation, should show 0% or the value (depending on implementation)
    // After mounting and IO trigger, should eventually show 92%
    expect(screen.getByText(/\d+%/)).toBeInTheDocument();
  });

  it('displays final value after intersection (end state)', () => {
    // The component shows the final value as text content for accessibility
    // even if the animation hasn't run
    const { container } = render(<ConfidenceCountUp value={88} />);
    // The data-target attribute stores the real value for screen readers
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('aria-label')).toContain('88');
  });

  it('passes through className', () => {
    const { container } = render(<ConfidenceCountUp value={90} className="custom" />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('custom')).toBe(true);
  });
});
```

- [ ] **Step 2: Implement**

Create `src/components/ConfidenceCountUp.tsx`:
- `'use client'` directive
- Props: `value: number` (0-100), `className?: string`
- Uses `useState` for displayed number (starts at 0), `useRef` for the element
- `useEffect` sets up `IntersectionObserver` (threshold 0.1, fire once)
- On intersection: animate from 0 to `value` over 800ms using `requestAnimationFrame` with ease-out curve (`1 - Math.pow(1 - progress, 3)`)
- Renders `<span aria-label="{value}% confidence">{displayedValue}%</span>`
- Respects `prefers-reduced-motion`: if reduced, skip animation and show final value immediately (check via `window.matchMedia`)

- [ ] **Step 3: Verify**

Run `npx vitest run tests/unit/confidence-count-up.test.tsx` -- all 3 tests pass.

---

### Task 4: ScenarioCard Component

**Files:**
- Create: `src/components/ScenarioCard.tsx`
- Create: `tests/unit/scenario-card.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/scenario-card.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScenarioCard from '@/components/ScenarioCard';
import type { ScenarioConfig } from '@/lib/showcase';

// Mock IntersectionObserver (needed by ScrollFadeIn child)
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', vi.fn((cb) => ({
    observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn(),
  })));
});

const mockScenario: ScenarioConfig = {
  slug: 'budget',
  title: 'Budget Season',
  icon: '\u{1F4B0}',
  color: '#f59e0b',
  jurisdiction: 'King County, WA',
  narrative: 'Your property taxes are going up 8.2%. Here is where the money goes.',
  story: 'Full story paragraph.',
  documentTitle: 'King County 2026 Proposed Budget',
  briefId: '00000000-0000-0000-0000-000000000101',
  sourceUrl: 'https://kingcounty.gov/budget.pdf',
};

describe('ScenarioCard', () => {
  it('renders title', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={0.92} index={0} />);
    expect(screen.getByText('Budget Season')).toBeInTheDocument();
  });

  it('renders narrative text', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={0.92} index={0} />);
    expect(screen.getByText(/property taxes are going up/)).toBeInTheDocument();
  });

  it('renders jurisdiction badge', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={0.92} index={0} />);
    expect(screen.getByText('King County, WA')).toBeInTheDocument();
  });

  it('renders confidence value', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={0.92} index={0} />);
    expect(screen.getByText(/92%/)).toBeInTheDocument();
  });

  it('links to the correct detail page', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={0.92} index={0} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/showcase/budget');
  });

  it('has correct aria-label', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={0.92} index={0} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-label', 'Read about Budget Season - King County, WA');
  });

  it('renders error state when confidence is null', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={null as unknown as number} index={0} />);
    expect(screen.getByText('Brief unavailable')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(<ScenarioCard scenario={mockScenario} confidence={0.92} index={0} />);
    expect(screen.getByText('\u{1F4B0}')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

Create `src/components/ScenarioCard.tsx`:
- Server component (no `'use client'` needed; the ScrollFadeIn and ConfidenceCountUp children are client components)
  - Actually, since it uses ScrollFadeIn wrapper and hover interactions require CSS only (no JS state), keep it as a server-renderable component that wraps content in client sub-components.
- Props: `ScenarioCardProps` per spec (scenario, confidence, index)
- Renders as an `<a>` tag (href `/showcase/{slug}`) with `aria-label`
- Layout: colored icon panel (80px wide, scenario.color gradient) + content area (title as `<h2>`, narrative, jurisdiction badge, confidence via ConfidenceCountUp, arrow)
- Wrap in `<ScrollFadeIn delay={index * 100}>`
- Error state: if confidence is falsy, show "Brief unavailable" instead of narrative, hide confidence badge
- All styling via inline styles (consistent with existing component patterns in the codebase)
- Mobile: icon panel becomes header bar via media query (or inline style with conditional check)

- [ ] **Step 3: Verify**

Run `npx vitest run tests/unit/scenario-card.test.tsx` -- all 8 tests pass.

---

### Task 5: ScenarioHero Component

**Files:**
- Create: `src/components/ScenarioHero.tsx`
- Create: `tests/unit/scenario-hero.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/scenario-hero.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScenarioHero from '@/components/ScenarioHero';
import type { ScenarioConfig } from '@/lib/showcase';

const mockScenario: ScenarioConfig = {
  slug: 'budget',
  title: 'Budget Season',
  icon: '\u{1F4B0}',
  color: '#f59e0b',
  jurisdiction: 'King County, WA',
  narrative: 'Short narrative.',
  story: 'Maria checks her mailbox and finds a 247-page county budget document. She needs to know: will her property taxes go up?',
  documentTitle: 'King County 2026 Proposed Budget',
  briefId: '00000000-0000-0000-0000-000000000101',
  sourceUrl: 'https://kingcounty.gov/budget.pdf',
};

describe('ScenarioHero', () => {
  it('renders title as h1', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.92} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Budget Season');
  });

  it('renders story paragraph', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.92} />);
    expect(screen.getByText(/Maria checks her mailbox/)).toBeInTheDocument();
  });

  it('renders jurisdiction', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.92} />);
    expect(screen.getByText('King County, WA')).toBeInTheDocument();
  });

  it('renders document title', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.92} />);
    expect(screen.getByText('King County 2026 Proposed Budget')).toBeInTheDocument();
  });

  it('renders source link', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.92} />);
    const link = screen.getByRole('link', { name: /source/i });
    expect(link).toHaveAttribute('href', 'https://kingcounty.gov/budget.pdf');
  });

  it('renders confidence score', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.92} />);
    expect(screen.getByText(/92%/)).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0.92} />);
    expect(screen.getByText('\u{1F4B0}')).toBeInTheDocument();
  });

  it('renders error state when confidence is 0', () => {
    render(<ScenarioHero scenario={mockScenario} confidence={0} />);
    expect(screen.getByText(/brief is currently unavailable/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

Create `src/components/ScenarioHero.tsx`:
- Server component (no client-side state needed)
- Props: `ScenarioHeroProps` per spec (scenario, confidence)
- Renders: icon (large, with scenario.color background), title as `<h1>`, story paragraph, jurisdiction badge, document title, confidence percentage, source link (opens in new tab with `rel="noopener noreferrer"`)
- Uses `@keyframes slideUp` animation on the wrapper div (CSS class `scenario-hero-animate`)
- Error state: if confidence is 0 or falsy, show "This brief is currently unavailable. Please try again later."
- Inline styles consistent with existing component patterns
- Back link to `/showcase` at the top

- [ ] **Step 3: Verify**

Run `npx vitest run tests/unit/scenario-hero.test.tsx` -- all 8 tests pass.

---

### Task 6: `/showcase` Page

**Files:**
- Create: `src/app/showcase/page.tsx`

- [ ] **Step 1: Write failing test**

No dedicated unit test (Server Component with Supabase calls). Covered by E2E in Task 10. Write a minimal smoke check:

```typescript
// Add to tests/unit/showcase.test.ts (extend Task 1's test file)
it('getScenarioBySlug returns undefined for invalid slug', () => {
  const { getScenarioBySlug } = require('@/lib/showcase');
  expect(getScenarioBySlug('')).toBeUndefined();
  expect(getScenarioBySlug('nonexistent')).toBeUndefined();
});
```

- [ ] **Step 2: Implement**

Create `src/app/showcase/page.tsx`:
- Server Component (async, no `'use client'`)
- Import `scenarios` from `@/lib/showcase`
- Import `getServerClient` from `@/lib/supabase`
- For each scenario, fetch the brief from Supabase using `.maybeSingle()`:
  ```typescript
  const briefResults = await Promise.all(
    scenarios.map(async (s) => {
      try {
        const { data } = await db
          .from('briefs')
          .select('id, sources(factuality_score)')
          .eq('id', s.briefId)
          .maybeSingle();
        return data;
      } catch {
        return null;
      }
    })
  );
  ```
- Render page title `<h1>` ("Civic Brief in Action"), subtitle explaining the showcase
- Render `ScenarioCard` for each scenario, passing confidence from the fetched brief (or null if fetch failed)
- Max-width 800px centered container
- Graceful fallback: if Supabase is not configured, render cards without confidence scores (error state)

- [ ] **Step 3: Verify**

Run `npm run dev`, navigate to `/showcase`. All 5 cards should render. If Supabase is not configured, cards show in error state with "Brief unavailable." Verify responsive layout at 768px breakpoint.

---

### Task 7: `/showcase/[scenario]` Page

**Files:**
- Create: `src/app/showcase/[scenario]/page.tsx`

- [ ] **Step 1: Write failing test**

Covered by E2E in Task 10. Manual verification step here.

- [ ] **Step 2: Implement**

Create `src/app/showcase/[scenario]/page.tsx`:
- Server Component (async)
- `params` is a Promise (Next.js 16): `const { scenario } = await params;`
- Look up slug via `getScenarioBySlug(scenario)`. If not found, call `notFound()`.
- Fetch brief from Supabase by `scenarioConfig.briefId` using the same pattern as `brief/[id]/page.tsx`:
  ```typescript
  const { data: brief } = await db
    .from('briefs')
    .select(`
      id, headline, summary, content, source_id, language_id,
      sources(id, source_url, title, factuality_score, confidence_level),
      languages(bcp47, name)
    `)
    .eq('id', scenarioConfig.briefId)
    .maybeSingle();
  ```
- Fetch all translations for the same source_id (same pattern as `brief/[id]/page.tsx`)
- Render `ScenarioHero` with the scenario config and confidence score
- Render `CivicBrief` below the hero (reuse existing component with all its props)
- If brief is not found: render ScenarioHero in error state, no CivicBrief
- Container: `container-narrow` class, consistent with brief detail page
- Generate `metadata` export for page title: `${scenarioConfig.title} | Civic Brief Showcase`

- [ ] **Step 3: Verify**

Run `npm run dev`, navigate to `/showcase/budget`. Should render ScenarioHero + CivicBrief. If Supabase is not configured, hero shows error state. Verify all 5 slugs work and invalid slugs return 404.

---

### Task 8: Homepage Modification

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write failing test**

```
// This will be verified in E2E Task 10. The test expects:
// - A link with href="/showcase" exists on the homepage
// - The link text contains "See it in action"
```

- [ ] **Step 2: Implement**

Add a "See it in action" section between the PIPELINE section and the VERIFICATION section (after line ~248, before line ~251 in `src/app/page.tsx`):

```tsx
{/* SHOWCASE CTA */}
<section style={{
  textAlign: 'center',
  padding: '48px 24px',
}}>
  <a
    href="/showcase"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '14px 32px',
      borderRadius: '12px',
      background: 'var(--civic)',
      color: 'white',
      fontSize: '16px',
      fontWeight: 600,
      fontFamily: "'Outfit', sans-serif",
      transition: 'transform 200ms ease-out, box-shadow 200ms ease-out',
    }}
  >
    See it in action &#8594;
  </a>
</section>
```

Keep it minimal: one link, no loading/empty/error states (it is a static link per the spec).

- [ ] **Step 3: Verify**

Run `npm run dev`, navigate to `/`. The "See it in action" link should appear between "How it works" and "AI that earns civic trust" sections. Clicking it navigates to `/showcase`.

---

### Task 9: CSS Animations + Globals

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing test**

No unit test for CSS. Visual verification + E2E axe-core scan in Task 10.

- [ ] **Step 2: Implement**

Append the following to `src/app/globals.css`:

```css
/* ── Showcase: ScrollFadeIn ── */
.scroll-fade-in {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 500ms ease-out, transform 500ms ease-out;
}

.scroll-fade-in.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Showcase: Hero slide-up ── */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.scenario-hero-animate {
  animation: slideUp 400ms ease-out forwards;
}

/* ── Showcase: Brief content fade ── */
.showcase-brief-fade {
  animation: slideUp 300ms ease-out 200ms forwards;
  opacity: 0;
}

/* ── Showcase: Card hover ── */
.scenario-card-link {
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}

.scenario-card-link:hover {
  transform: scale(1.02);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
}

.scenario-card-link:focus-visible {
  outline: 2px solid var(--civic);
  outline-offset: 2px;
}

/* ── Showcase: Arrow hover shift ── */
.scenario-card-arrow {
  transition: transform 200ms ease-out;
}

.scenario-card-link:hover .scenario-card-arrow {
  transform: translateX(4px);
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .scroll-fade-in {
    opacity: 1;
    transform: none;
    transition: none;
  }

  .scenario-hero-animate,
  .showcase-brief-fade {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .scenario-card-link {
    transition: none;
  }

  .scenario-card-link:hover {
    transform: none;
  }

  .scenario-card-arrow {
    transition: none;
  }

  .scenario-card-link:hover .scenario-card-arrow {
    transform: none;
  }
}
```

- [ ] **Step 3: Verify**

Run `npm run dev`. Navigate to `/showcase`. Cards should fade in as they scroll into view with staggered delays. Hovering a card should scale it slightly with elevated shadow. Navigate to `/showcase/budget`; hero should slide up on mount. Verify in Chrome DevTools with "Emulate CSS media feature prefers-reduced-motion: reduce" -- all animations should be instant.

---

### Task 10: E2E Tests

**Files:**
- Create: `tests/e2e/showcase.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/e2e/showcase.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Reuse the a11y helper pattern from pages.spec.ts
async function checkA11y(page: import('@playwright/test').Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations.filter(
    (v) => !['color-contrast'].includes(v.id)
  );

  if (violations.length > 0) {
    const summary = violations
      .map((v) => `${v.id}: ${v.description} (${v.nodes.length} instances)`)
      .join('\n');
    console.warn(`Accessibility issues on ${name}:\n${summary}`);
  }

  const serious = violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  expect(serious, `Serious a11y violations on ${name}`).toHaveLength(0);
}

test.describe('Showcase page', () => {
  test('loads and shows page title', async ({ page }) => {
    await page.goto('/showcase');
    await expect(page.locator('h1')).toContainText('Civic Brief in Action');
  });

  test('renders all 5 scenario cards', async ({ page }) => {
    await page.goto('/showcase');
    const cards = page.locator('a[href^="/showcase/"]');
    await expect(cards).toHaveCount(5);
  });

  test('each card has correct link', async ({ page }) => {
    await page.goto('/showcase');
    const expectedSlugs = ['budget', 'school-board', 'zoning', 'legislation', 'multilingual'];
    for (const slug of expectedSlugs) {
      await expect(page.locator(`a[href="/showcase/${slug}"]`)).toBeVisible();
    }
  });

  test('cards show titles', async ({ page }) => {
    await page.goto('/showcase');
    await expect(page.getByText('Budget Season')).toBeVisible();
    await expect(page.getByText('School Board')).toBeVisible();
    await expect(page.getByText('Zoning Change')).toBeVisible();
    await expect(page.getByText('State Legislation')).toBeVisible();
    await expect(page.getByText('Multilingual')).toBeVisible();
  });

  test('passes accessibility checks', async ({ page }) => {
    await page.goto('/showcase');
    await checkA11y(page, 'Showcase');
  });

  test('has security headers', async ({ page }) => {
    const response = await page.goto('/showcase');
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
    expect(response?.headers()['x-frame-options']).toBe('DENY');
  });
});

test.describe('Showcase detail page', () => {
  test('loads budget scenario', async ({ page }) => {
    await page.goto('/showcase/budget');
    await expect(page.locator('h1')).toContainText('Budget Season');
  });

  test('shows back link to showcase', async ({ page }) => {
    await page.goto('/showcase/budget');
    await expect(page.locator('a[href="/showcase"]')).toBeVisible();
  });

  test('renders scenario hero with story text', async ({ page }) => {
    await page.goto('/showcase/budget');
    // Story text should be visible (the longer narrative)
    const heroSection = page.locator('[data-testid="scenario-hero"]');
    await expect(heroSection).toBeVisible();
  });

  test('shows jurisdiction', async ({ page }) => {
    await page.goto('/showcase/budget');
    await expect(page.getByText(/King County/)).toBeVisible();
  });

  test('returns 404 for invalid scenario', async ({ page }) => {
    const response = await page.goto('/showcase/nonexistent');
    expect(response?.status()).toBe(404);
  });

  test('passes accessibility checks', async ({ page }) => {
    await page.goto('/showcase/budget');
    await checkA11y(page, 'Showcase Detail');
  });
});

test.describe('Homepage showcase link', () => {
  test('has "See it in action" link to /showcase', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('a[href="/showcase"]');
    await expect(link).toBeVisible();
    await expect(link).toContainText('See it in action');
  });
});
```

- [ ] **Step 2: Run and iterate**

Run `npx playwright test tests/e2e/showcase.spec.ts`. Fix any failures. Common issues:
- Cards not rendering: check Supabase fetch error handling (should render error state, not crash)
- Security headers: should be handled by existing proxy.ts
- a11y: check heading hierarchy, aria-labels, focus styles

- [ ] **Step 3: Verify**

All E2E tests pass on both desktop and mobile (Pixel 5) viewports. Run `npx playwright test tests/e2e/showcase.spec.ts --reporter=list` for verbose output.

---

### Task 11: Document Sourcing (Manual Step)

**Files:**
- Modify: `src/lib/showcase.ts` (update briefIds and sourceUrls)

This is a manual step. No automated test. Document the URLs found.

- [ ] **Step 1: Find 5 real WA government PDFs**

Search for and record one PDF per scenario:

| Scenario | What to Find | Where to Look |
|----------|-------------|---------------|
| Budget | Seattle or King County 2025/2026 proposed or adopted budget | seattle.gov, kingcounty.gov |
| School Board | Issaquah School District board resolution or meeting minutes | issaquah.wednet.edu |
| Zoning | Sammamish or nearby city zoning/land use proposal | sammamish.us |
| Legislation | WA state bill (housing, education, or transportation) | leg.wa.gov |
| Multilingual | Seattle public notice (utility rates, public hearing) | seattle.gov |

Record each URL. Verify the PDF is publicly accessible and under 10MB.

- [ ] **Step 2: Process each PDF through the upload page**

For each PDF:
1. Navigate to the live site's `/upload` page (or local dev)
2. Upload the PDF with the source URL
3. Wait for the pipeline to complete
4. Record the resulting brief UUID from the URL (`/brief/{id}`)
5. Verify the brief displays correctly with confidence score

- [ ] **Step 3: Update showcase.ts with real IDs**

Replace the placeholder UUIDs in `src/lib/showcase.ts` with the real brief IDs from Step 2. Update `sourceUrl` values to match the actual government document URLs.

- [ ] **Step 4: Verify**

Navigate to `/showcase`. All 5 cards should show real confidence scores. Click each card; the detail page should show a real civic brief generated from the actual government document. Verify the source links open the original PDFs.

---

## Post-Implementation Checklist

- [ ] All existing tests still pass: `npm test` (228+ unit/integration tests)
- [ ] All existing E2E tests still pass: `npx playwright test tests/e2e/pages.spec.ts`
- [ ] New unit tests pass: `npx vitest run tests/unit/showcase.test.ts tests/unit/scroll-fade-in.test.tsx tests/unit/confidence-count-up.test.tsx tests/unit/scenario-card.test.tsx tests/unit/scenario-hero.test.tsx`
- [ ] New E2E tests pass: `npx playwright test tests/e2e/showcase.spec.ts`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Responsive layout verified at 768px breakpoint
- [ ] Reduced motion verified in Chrome DevTools
- [ ] 5 real government PDFs processed and IDs recorded
