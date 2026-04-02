# Design Principles

The visual identity of Civic Brief. Every component, page, and interaction should feel modern, purposeful, and fast. This guide codifies the design system for consistency across contributors.

Last updated: 2026-03-22

---

## Philosophy

Government information is dense, bureaucratic, and visually hostile. Civic Brief is the opposite: warm, clear, and inviting. The design should feel like a thoughtful friend explaining something important, not a government website or a corporate dashboard.

Three principles guide every design decision:

1. **Clarity over decoration.** Every visual element must serve comprehension. If it doesn't help the reader understand civic information, remove it.
2. **Warmth over sterility.** Warm paper tones, serif headings, generous whitespace. Government docs feel cold; we feel human.
3. **Speed over spectacle.** Animations exist to guide attention, not to impress. Every transition must feel instant. If a user notices the animation, it's too slow.

---

## Color Palette

### Core Tokens (CSS Custom Properties)

| Token | Value | Usage |
|-------|-------|-------|
| `--ink` | `#1b1b1f` | Primary text, primary buttons, inverted section backgrounds |
| `--paper` | `#fcfaf7` | Page background, nav background base |
| `--warm` | `#f5f0e8` | Section backgrounds, blockquotes, warm fills |
| `--accent` | `#b44d12` | Burnt orange. CTAs, highlights, section numbers, dashed border hover |
| `--accent-glow` | `rgba(180,77,18,0.15)` | Subtle accent fills (drop zone hover, highlights) |
| `--civic` | `#1e3a5f` | Deep navy. Source links, civic-themed icons, form submit |
| `--civic-light` | `#e8eef5` | Light navy wash for civic icon backgrounds |
| `--muted` | `#8a8a92` | Secondary text, placeholders, labels, footer links |
| `--border` | `#e2ddd4` | All borders, dividers, input outlines |
| `--green` | `#2d6a4f` | Success, action items, high confidence |
| `--green-light` | `#e9f5ec` | Success backgrounds, completion indicators |

### Semantic Color Pairings

Each civic section uses a background + foreground pair for its icon:

| Meaning | Background | Foreground | Usage |
|---------|-----------|------------|-------|
| Financial / Change | `#fef3e2` | `var(--accent)` | "What changed", "Where money goes" |
| Civic / Who | `var(--civic-light)` | `var(--civic)` | "Who is affected" |
| Action / Success | `var(--green-light)` | `var(--green)` | "What you can do", completion |
| Context / Background | `#f3e8ff` | `#7c3aed` | "Context", background info |
| Warning / Cuts | `#fee2e2` | `#dc2626` | Errors, budget cuts, low confidence |

### Inverted Sections (Dark Background)

For sections using `var(--ink)` as background:

| Element | Color |
|---------|-------|
| Primary text | `#ffffff` |
| Body copy | `rgba(255,255,255,0.55)` |
| Fine print | `rgba(255,255,255,0.4)` |
| Badge outlines | `rgba(255,255,255,0.12)` |

### Rules

- Never introduce new colors without adding them as CSS custom properties in `globals.css`.
- Contrast ratios must meet WCAG AA: 4.5:1 for body text, 3:1 for large text (18px+ bold or 24px+ regular).
- The warm palette (`--paper`, `--warm`, `--accent`) is the primary identity. Use `--civic` and `--green` as functional accents, not decorative.
- Error red (`#dc2626`) is reserved for genuine errors and warnings. Never use it decoratively.

---

## Typography

### Font Stack

| Font | Style | Usage | Weight Range |
|------|-------|-------|-------------|
| **Fraunces** | Serif, optical size | Headings, display text, logo, stats, quotes | 400, 600, 800 |
| **Outfit** | Sans-serif | Body copy, labels, navigation, buttons, UI text | 300, 400, 500, 600, 700 |

System fallbacks: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

### Type Scale

| Element | Font | Size | Weight | Line Height | Letter Spacing |
|---------|------|------|--------|-------------|----------------|
| Hero h1 | Fraunces | `clamp(38px, 5vw, 58px)` | 800 | 1.08 | — |
| Section h2 | Fraunces | `clamp(30px, 4vw, 44px)` | 800 | 1.2 | — |
| Card headline | Fraunces | 24px | 700 | 1.2 | — |
| Stats number | Fraunces | `clamp(32px, 4vw, 48px)` | 800 | — | — |
| Quote | Fraunces | `clamp(22px, 3.5vw, 34px)` | 400 italic | 1.45 | — |
| Body copy | Outfit | 18px | 300–400 | 1.65 | — |
| Nav / footer links | Outfit | 14px / 13px | 500 | — | — |
| Section label | Outfit | 11px | 700 | — | 0.5px, uppercase |
| Eyebrow | Outfit | 12px | 600 | — | 3px, uppercase |
| Pipeline description | Outfit | 13px | 300 | — | — |
| Badge text | Outfit | 13px | 600 | — | — |

### Rules

- Headings are always Fraunces. Body is always Outfit. No exceptions.
- Use `clamp()` for headings that need to scale. Do not use viewport units alone.
- Body copy line-height is 1.65. Tighter line-height (1.2-1.4) only for headings and labels.
- Never go below 11px for any text. Prefer 13px as the minimum for readable content.
- Uppercase text always gets `letter-spacing` (0.5px minimum). Uppercase without spacing looks compressed.

---

## Spacing

### Scale (4px base)

```
4  8  12  16  20  24  32  40  48  56  80  120
```

All spacing values should come from this scale. The primary rhythm:
- **4px** — tight gaps (badge dot to text, icon to label)
- **8px** — compact spacing (between related items)
- **12–16px** — standard spacing (padding within components, gap between form elements)
- **24px** — primary gutter (column gaps, section internal padding)
- **40px** — section padding (top/bottom within major sections)
- **80–120px** — section separation (vertical space between major page sections)

### Rules

- Prefer multiples of 4. Avoid arbitrary pixel values (17px, 23px, etc.).
- Generous whitespace is part of the brand. When in doubt, add more space, not less.
- Mobile padding is 16px horizontal. Desktop padding is 24px horizontal.
- Section vertical rhythm: 80-120px between major sections, 40px within sections.

---

## Layout

### Containers

| Container | Max Width | Usage |
|-----------|-----------|-------|
| `.container` | 1280px | Full-width page sections |
| `.container-narrow` | 720px | Text-heavy content, briefs |
| CivicBrief card | 640px | Brief display component |

All containers are horizontally centered with `margin: 0 auto` and `padding: 0 24px`.

### Breakpoints

| Name | Value | Usage |
|------|-------|-------|
| Desktop | > 900px | Multi-column layouts, side-by-side content |
| Tablet | <= 900px | Stack columns, reduce padding |
| Mobile | <= 640px | Single column, bottom sheets, compact nav |
| Small mobile | <= 480px | Tighter spacing, single-column stats |

### Rules

- Mobile-first is the default. Design for 375px width first, then enhance for larger screens.
- Never use horizontal scroll for content. Horizontal scroll is allowed only for code blocks.
- Max content width is 720px for readability. Lines of text should not exceed ~75 characters.
- Navigation is fixed with frosted glass effect: `backdrop-filter: blur(16px)` over semi-transparent `--paper`.

---

## Border Radius

### Scale

| Value | Usage |
|-------|-------|
| 4px | Tiny elements (mini badges, progress indicators) |
| 8px | Small components (feedback buttons, expand panels, banners) |
| 10px | Medium components (input fields, submit buttons, pipeline cards, source links) |
| 12px | Standard cards (verification cards, showcase cards) |
| 16px | Large cards (CivicBrief, bottom sheets — top corners only) |
| 20px | Pills (confidence badge, language toggle, tab bar) |
| 50% | Circles (dots, spinners, avatars) |

### Rules

- Larger components get larger radii. A 16px card should not have 4px corners.
- Pill shapes (fully rounded ends) use 20px or higher. Reserve for badges, toggles, and tabs.
- Consistency within component groups: all buttons at the same level share the same radius.

---

## Shadows

### Elevation Levels

| Level | Shadow | Usage |
|-------|--------|-------|
| Level 0 | None | Default state, flat elements |
| Level 1 | `0 2px 12px rgba(0,0,0,0.06)` | Subtle lift (doc pages, resting cards) |
| Level 2 | `0 12px 32px rgba(0,0,0,0.06)` | Hover state (verify cards, interactive elements) |
| Level 3 | `0 12px 32px rgba(0,0,0,0.18)` | Prominent lift (CTA hover, focused elements) |
| Level 4 | `0 20px 60px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)` | Floating elements (phone mocks, modals) |
| Upward | `0 -4px 24px rgba(0,0,0,0.15)` | Bottom sheets (mobile feedback panel) |

### Rules

- Shadows use black at low opacity (0.06-0.18). Never use colored shadows.
- Layered shadows (ambient + key light) for floating elements. Single shadow for hover states.
- Shadow transitions always paired with `transform` for GPU compositing.

---

## Buttons

### Hierarchy

| Level | Style | Usage | Example |
|-------|-------|-------|---------|
| **Primary** | `bg: var(--ink)`, `color: white`, no border | Main page CTA, form submit | "Try it now", "Generate Civic Brief" |
| **Secondary** | `bg: white`, `border: var(--border)`, `color: var(--civic)` | Supporting actions | Source link, "View original" |
| **Ghost** | `bg: white`, `border: var(--border)`, `color: var(--ink)` | Utility actions, toolbars | Feedback categories, expand toggles |
| **Pill toggle** | Active: `bg: var(--ink)`, Inactive: `bg: white` | Selection groups | Language toggle, tab bar |
| **Disclosure** | `bg: none`, `border: none`, `color: var(--muted)` | Show/hide, expand | "Show verification details" |

### Shared Properties

```
font-family: Outfit
font-weight: 500-600
transition: all 0.2s ease-out
cursor: pointer
```

### Sizing

| Size | Padding | Font Size | Radius | Usage |
|------|---------|-----------|--------|-------|
| Large | 16px 32px | 16px | 14px | Hero CTA, full-width submit |
| Medium | 12px 20px | 14px | 10px | Standard buttons, source link |
| Small | 6px 16px | 13px | 20px (pill) or 8px | Toggles, badges, compact actions |

### Hover States

- Primary: `translateY(-2px)` + Level 3 shadow
- Secondary/Ghost: border color shifts to `var(--accent)` or `var(--civic)`
- Pill toggle: no transform, color/bg swap is sufficient
- Disclosure: color shifts from `--muted` to `--ink`

### Rules

- One primary button per visible section. Two primaries competing for attention = zero primaries.
- Disabled state: `background: var(--muted)`, `cursor: not-allowed`, no hover effects.
- Button text is always Outfit, never Fraunces.
- Minimum touch target: 44x44px (WCAG). Small buttons get extra padding or margin to meet this.

---

## Motion Design

### Core Philosophy

Motion guides attention, confirms actions, and creates spatial continuity. It is never decorative. Every animation must have a purpose: "this appeared," "this responded to you," or "this is connected to that."

### GPU-Composited Transitions Only

**Only animate `transform` and `opacity`.** These two properties are handled by the GPU compositor thread, bypassing layout and paint. This is why they feel smooth at 60fps even on low-end devices.

**Never animate:** `width`, `height`, `top`, `left`, `margin`, `padding`, `border`, `background-color` (as primary animation). These trigger layout recalculation and cause jank.

**Exception:** `background-color` and `border-color` transitions are acceptable for hover states on small elements (buttons, links) where the repaint cost is negligible. Keep these under 200ms.

### Timing

| Duration | Usage |
|----------|-------|
| 150ms | Snappiest micro-interactions (category button press) |
| 200ms | Standard micro-interactions (button hover, toggle, link hover) |
| 300ms | Moderate transitions (tab switch, content fade) |
| 400-500ms | Entrance animations (hero slide-up, card fade-in) |

**Never exceed 500ms.** Anything longer feels sluggish. If an animation feels slow at 500ms, the animation is wrong, not the duration.

### Easing

| Curve | CSS | Usage |
|-------|-----|-------|
| **Ease-out** | `ease-out` or `cubic-bezier(0.0, 0.0, 0.2, 1)` | Default for everything. Fast start, gentle landing. Mimics real physics. |
| **Ease-in-out** | `ease-in-out` | Only for looping animations (pulse, bounce) |
| **Linear** | `linear` | Only for spinners and continuous rotation |

**Ease-out is the default.** It is the most natural curve because it matches how objects decelerate in the physical world. Objects don't start slowly (ease-in); they start with energy and settle.

### Scroll-Triggered Animations

Elements that enter the viewport animate in using `IntersectionObserver`:

```
Initial state:  opacity: 0, transform: translateY(24px)
Final state:    opacity: 1, transform: translateY(0)
Duration:       500ms
Easing:         ease-out
Trigger:        IntersectionObserver, threshold: 0.1
Fire once:      Yes (unobserve after first intersection)
```

**Staggered reveals:** When multiple items enter together (card grid, list items), stagger with `transition-delay: index * 100ms`. Maximum total stagger: 500ms (5 items at 100ms each). Beyond that, the last item waits too long.

### Micro-Interactions

| Interaction | Properties | Duration |
|-------------|-----------|----------|
| Card hover | `transform: scale(1.02)`, shadow Level 2 → Level 3 | 200ms |
| Button hover | `transform: translateY(-2px)`, shadow lift | 200ms |
| Arrow nudge | `transform: translateX(4px)` | 200ms |
| Link hover | `color` shift, `border-color` shift | 200ms |
| Focus ring | `outline: 2px solid var(--accent)`, `outline-offset: 2px` | instant |

### Reduced Motion

All animations must respect `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

For JavaScript-driven animations (e.g., count-up), check on mount:
```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReducedMotion) {
  // Skip animation, render final state immediately
}
```

### Keyframe Patterns

Standard entrance (used for hero, sections, cards):
```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Standard content reveal (used for tab content, brief sections):
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

**Compositing hint:** Add `will-change: transform, opacity` to elements that will animate. Remove it after animation completes to free GPU memory. Never apply `will-change` to more than ~10 elements simultaneously.

### Rules

- One entrance animation per element. Do not chain fadeUp → scale → color.
- Hover animations are reversible. The "unhover" uses the same duration and easing.
- Never animate on page load without user scroll. Above-the-fold content renders immediately; below-the-fold content animates on scroll.
- Looping animations (spinners, pulses) are reserved for loading states. Nothing should loop indefinitely on a resting page.
- Test all animations at 6x slowdown (Chrome DevTools → Animations → 0.1x) to verify smoothness.

---

## Component Patterns

### Card Anatomy

```
┌─────────────────────────────────┐
│  Header (badge, toggle, meta)   │  padding: 24px 24px 0
├─────────────────────────────────┤
│  Headline (Fraunces 700)        │  padding: 0 24px
├─────────────────────────────────┤
│  Section rows                   │  padding: 0 24px
│  ┌──┬─────────────────────┐    │
│  │ⓘ│ Label (uppercase)    │    │  icon: 36x36, radius 10px
│  │  │ Content (body copy)  │    │  gap: 12px
│  └──┴─────────────────────┘    │  margin-bottom: 20px
├─────────────────────────────────┤
│  Footer (source link, actions)  │  padding: 16px 24px 24px
├─────────────────────────────────┤
│  Feedback zone                  │  padding: 16px 24px, border-top
└─────────────────────────────────┘

Card: bg white, border var(--border), radius 16px, overflow hidden
```

### Section Labels

All section labels within cards follow this pattern:
- Font: Outfit 700, 11px
- Transform: uppercase
- Letter-spacing: 0.5px
- Color: `var(--muted)`
- Margin-bottom: 4-6px

### Status Badges (Confidence Score)

Pill shape: border-radius 20px, padding 6px 14px, inline-flex.

| Level | Background | Text Color | Dot Color |
|-------|-----------|------------|-----------|
| High (>= 85%) | `var(--green-light)` | `var(--green)` | `var(--green)` |
| Medium (70-84%) | `#fef3e2` | `var(--accent)` | `var(--accent)` |
| Low (< 70%) | `#fee2e2` | `#dc2626` | `#dc2626` |

### Form Inputs

- Border: `1px solid var(--border)`
- Border-radius: 10px
- Padding: 14px 16px
- Font: Outfit 400, 15px
- Focus: `border-color: var(--accent)`, `outline: none`
- Transition: `all 0.2s`
- Placeholder: `var(--muted)`

### Drop Zone

- Border: `2px dashed var(--border)`
- Border-radius: 14px
- Padding: 40px 24px
- Hover: `border-color: var(--accent)`, `background: var(--accent-glow)`
- Active/dragging: same as hover

### Blockquotes

- Border-left: `3px solid var(--accent)`
- Background: `var(--warm)`
- Border-radius: `0 8px 8px 0`
- Padding: 14px 18px
- Font: Outfit 400 italic, 14px
- Color: `var(--muted)`

---

## Accessibility

### Baseline

- WCAG 2.1 AA compliance on all pages
- axe-core scans in E2E tests; serious/critical violations fail the build

### Focus Management

- All interactive elements have a visible focus ring: `outline: 2px solid var(--accent)`, `outline-offset: 2px`
- Focus ring only appears on keyboard navigation (`:focus-visible`), not mouse clicks
- Tab order follows visual reading order (no `tabindex` > 0)

### Reduced Motion

- Mandatory `prefers-reduced-motion: reduce` support (see Motion Design section)
- No auto-playing animations on resting pages
- Spinning loaders are the only acceptable continuous animation

### Screen Readers

- Semantic HTML: `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<footer>`
- Heading hierarchy: one `<h1>` per page, sequential `<h2>`-`<h6>`
- `aria-label` on interactive elements that lack visible text (icon buttons, card links)
- `aria-live="polite"` for dynamic content updates (form status, translation loading)
- Decorative images get `alt=""`. Informative images get descriptive alt text.

### Color Independence

- Never convey meaning through color alone. The confidence badge uses color AND text AND a dot indicator.
- Error states use color AND an icon AND error text.

---

## Performance Budgets

### Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP (Largest Contentful Paint) | < 2.5s | Vercel Speed Insights |
| FID (First Input Delay) | < 100ms | Vercel Speed Insights |
| CLS (Cumulative Layout Shift) | < 0.1 | Vercel Speed Insights |
| Total JS bundle (first load) | < 150kb gzipped | Build output |
| Time to Interactive | < 3.5s on 3G | Lighthouse |

### Rules

- No animation library (Framer Motion, GSAP, etc.). CSS transitions + IntersectionObserver cover all needs.
- Images: use `next/image` with appropriate `sizes` prop. Never load a 2000px image for a 400px container.
- Fonts: loaded via `next/font` with `display: swap`. Only load the weights you use.
- `'use client'` components should be pushed as far down the tree as possible. A page-level `'use client'` defeats Server Components.
- Lazy load below-the-fold content where appropriate.

---

## File Organization

### Component Files

```
src/components/
  ComponentName.tsx          # PascalCase, matches export name
```

### Style Approach

- CSS custom properties in `globals.css` for design tokens
- Inline styles via style objects in JSX for component-specific styles
- No CSS modules, no styled-components, no Tailwind (current codebase convention)
- When a component's styles exceed ~50 lines, extract to a `const styles` object at the top of the file

### Naming

All naming follows `docs/standards/NAMING_CONVENTIONS.md`. Key points for design:
- Components: PascalCase (`ScenarioCard.tsx`)
- CSS custom properties: `--kebab-case` (`--accent-glow`)
- Style constants: camelCase (`const cardStyle = { ... }`)
