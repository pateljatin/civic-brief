# Design Principles Audit -- March 22, 2026

Audit of existing code and documentation against `docs/standards/DESIGN_PRINCIPLES.md`.

---

## Files Checked

### Documentation
- `docs/standards/DESIGN_PRINCIPLES.md` (reference)
- `docs/FORCivicBrief.md`
- `docs/ROADMAP.md`
- `docs/Civic-Brief-PRD.md`
- `docs/standards/ENGINEERING_FUNDAMENTALS.md`
- `docs/standards/PRODUCT_FUNDAMENTALS.md`
- `docs/standards/AGENTIC_AI_STRATEGY.md`
- `docs/standards/NAMING_CONVENTIONS.md`
- `docs/superpowers/specs/*.md`
- `docs/superpowers/plans/*.md`
- `docs/superpowers/retros/*.md`
- `docs/research/*.md`
- `CLAUDE.md`
- `README.md`

### Source Code
- `src/app/globals.css`
- `src/app/page.tsx` (including inline `landingStyles`)
- `src/app/layout.tsx`
- `src/app/upload/page.tsx`
- `src/components/CivicBrief.tsx`
- `src/components/UploadForm.tsx`
- `src/components/ConfidenceScore.tsx`
- `src/components/LanguageToggle.tsx`
- `src/components/SourceLink.tsx`
- `src/components/FeedbackSection.tsx`
- `src/components/AuthButton.tsx`

### Tests
- `tests/` directory (scanned for Apple-style references)

---

## "Apple-style" Language References

**Result: None found.**

A full-repo search for "Apple-style", "Apple-like", "Apple-inspired", "Apple-esque", and "Apple-quality" returned zero matches across all files. The only occurrence of "apple" in the codebase is the legitimate `-apple-system` CSS font fallback in `docs/standards/DESIGN_PRINCIPLES.md:80`, which is correct and should remain.

---

## Animation Violations

### 1. Scroll-reveal transition exceeds 500ms

| File | Line | Current | Rule | Recommended |
|------|------|---------|------|-------------|
| `src/app/page.tsx` | 426 | `.reveal` transition: `opacity 0.7s, transform 0.7s` | Never exceed 500ms | `opacity 0.5s ease-out, transform 0.5s ease-out` |

The `.reveal` class used for scroll-triggered section animations runs at 700ms. The design principles cap entrance animations at 400-500ms.

### 2. Document float animation uses 800ms

| File | Line | Current | Rule | Recommended |
|------|------|---------|------|-------------|
| `src/app/page.tsx` | 317 | `.l-doc-page` animation: `docFloat 0.8s forwards` | Never exceed 500ms | `docFloat 0.5s ease-out forwards` |

### 3. Phone slide animation uses 800ms

| File | Line | Current | Rule | Recommended |
|------|------|---------|------|-------------|
| `src/app/page.tsx` | 330 | `.l-phone-hero` animation: `phoneSlide 0.8s 1s forwards` | Never exceed 500ms | `phoneSlide 0.5s 1s ease-out forwards` |

### 4. Progress bar transition uses 2000ms and animates `width`

| File | Line | Current | Rule | Recommended |
|------|------|---------|------|-------------|
| `src/app/upload/page.tsx` | 182 | `transition: 'width 2s linear'` | Never exceed 500ms; never animate width | Use `transform: scaleX()` with `transform-origin: left` instead. Duration can exceed 500ms for progress bars (functional, not decorative), but the property must be GPU-composited. |

This is the most significant violation: animating `width` triggers layout recalculation on every frame.

### 5. Mini-bar chart animates `height`

| File | Line | Current | Rule | Recommended |
|------|------|---------|------|-------------|
| `src/app/page.tsx` | 386 | `.mini-bar` transition: `height 0.5s` | Never animate height | Use `transform: scaleY()` with `transform-origin: bottom` |

### 6. Looping animations run indefinitely on resting page

| File | Line | Current | Rule | Recommended |
|------|------|---------|------|-------------|
| `src/app/page.tsx` | 328 | `@keyframes arrowPulse` runs with `infinite` | Looping animations reserved for loading states | Fire once or remove. The flow arrow is decorative, not a loading indicator. |
| `src/app/page.tsx` | 371 | `@keyframes arrowBounce` runs with `infinite` | Same rule | Same fix. |

### 7. No `prefers-reduced-motion` in globals.css or any component

| File | Current | Rule | Recommended |
|------|---------|------|-------------|
| `src/app/globals.css` | No reduced-motion media query | All animations must respect `prefers-reduced-motion: reduce` | Add the standard reduced-motion override from DESIGN_PRINCIPLES.md |
| `src/app/page.tsx` | Scroll-reveal uses IntersectionObserver JS but no reduced-motion check | JS animations must check `matchMedia` | Add `prefersReducedMotion` check in the `useEffect` |

This is the most important accessibility gap. None of the existing animations respect reduced motion preferences.

### 8. Easing inconsistencies

| File | Line | Current | Rule | Recommended |
|------|------|---------|------|-------------|
| `src/app/page.tsx` | 426 | `.reveal` has no easing specified (defaults to `ease`) | Entrance animations should use `ease-out` | Add `ease-out` explicitly |
| `src/app/page.tsx` | 317 | `.l-doc-page` animation has no easing (defaults to `ease`) | Same | `ease-out` |
| `src/app/page.tsx` | 330 | `.l-phone-hero` animation has no easing | Same | `ease-out` |
| `src/app/page.tsx` | 340 | `.l-pcard` animation `pcardIn` has no easing | Same | `ease-out` |

---

## Component Violations

### Border Radius

| Component | File | Current | Scale Value | Notes |
|-----------|------|---------|-------------|-------|
| Drop zone | `UploadForm.tsx:101` | `14px` | Not on scale (nearest: 12px or 16px) | Minor. 14px is between scale values. |
| Tab buttons | `page.tsx:358` | `.l-tab-btn` 24px | Not on scale (nearest: 20px) | Should be 20px (pill) per the scale. |
| Phone mock | `page.tsx:332` | `.l-phone` 32px | Not on scale | Acceptable: phone mock is decorative, not a reusable component. |
| Phone mock sm | `page.tsx:376` | `.l-phone-sm` 28px | Not on scale | Same rationale. |
| Brief icon | `page.tsx:382` | `.brief-icon` 6px | Not on scale (nearest: 4px or 8px) | Should be 8px. |
| Pipeline icon | `page.tsx:398` | `.l-pipe-icon` 14px | Not on scale (nearest: 12px or 16px) | Should be 16px for a 56px element. |
| Phone notch | `page.tsx:333` | 14px | Not on scale | Decorative, acceptable. |

### Shadow Values

| Component | File | Current | Expected Level | Notes |
|-----------|------|---------|----------------|-------|
| Verify card hover | `page.tsx:408` | `0 12px 32px rgba(0,0,0,0.06)` | Level 2 | Correct. Matches Level 2. |
| Hero CTA hover | `page.tsx:312` | `0 12px 32px rgba(0,0,0,0.18)` | Level 3 | Correct. Matches Level 3. |
| Phone mock | `page.tsx:332` | `0 20px 60px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)` | Level 4 | Correct. Matches Level 4. |
| Doc page | `page.tsx:317` | `0 2px 12px rgba(0,0,0,0.06)` | Level 1 | Correct. Matches Level 1. |
| Bottom sheet | `FeedbackSection.tsx:511` | `0 -4px 24px rgba(0,0,0,0.15)` | Upward | Correct. Matches Upward level. |

Shadow values are consistent with the design principles. No violations found.

### Button Hierarchy

| Component | File | Current | Expected | Violation? |
|-----------|------|---------|----------|------------|
| Hero CTA | `page.tsx:311` | `bg: var(--ink)`, white text | Primary | Correct |
| Submit button | `UploadForm.tsx:228-231` | `bg: var(--ink)`, white text | Primary | Correct |
| Source link | `SourceLink.tsx:73-76` | `bg: white`, `color: var(--civic)`, border | Secondary | Correct |
| Feedback helpful | `FeedbackSection.tsx:466-480` | `bg: white`, border, `color: var(--ink)` | Ghost | Correct |
| Verification toggle | `CivicBrief.tsx:289-298` | `bg: none`, `border: none`, `color: var(--muted)` | Disclosure | Correct |
| Language toggle active | `LanguageToggle.tsx:42` | `bg: var(--ink)`, white text | Pill toggle active | Correct |
| Language toggle inactive | `LanguageToggle.tsx:42-43` | `bg: white`, border, muted text | Pill toggle inactive | Correct |
| Feedback submit | `FeedbackSection.tsx:421` | `bg: var(--civic)` | Should be `var(--ink)` for primary | Minor. Uses civic blue instead of ink black. Acceptable as a contextual variant within the feedback form. |

Button hierarchy is well-implemented across all components.

### Spacing (4px Grid)

| Component | File | Value | On Grid? | Notes |
|-----------|------|-------|----------|-------|
| SourceLink padding | `SourceLink.tsx:27` | `10px 16px` | 10px is not on grid | Should be 12px 16px |
| Feedback category padding | `FeedbackSection.tsx:375` | `12px 10px` | 10px is not on grid | Should be 12px |
| Mini bar chart margin-top | `page.tsx:16` (inline HTML) | `margin-top:-4px` | Negative values acceptable | OK |
| Brief val margin-top | `page.tsx` (inline HTML) | `margin-top:1px` | Not on grid | Minor, inline HTML demo content |
| Pcard padding | `page.tsx:339` | `10px 12px` | 10px not on grid | Should be 12px |
| Tab button padding | `page.tsx:358` | `10px 22px` | Neither on grid | Should be 12px 24px |

---

## Stale Documentation Updated

### `docs/ROADMAP.md`
- C7 (Automatic document feed ingestion) changed from `[ ]` to `[x]` with "(shipped PR #34, March 2026)"
- C8 (Community verification UI) changed from `[ ]` to `[x]` with "(shipped PR #29, March 2026)"

### `docs/FORCivicBrief.md`
- Added "Post-Demo Features (Shipped March 2026)" section documenting C7 and C8 architecture, key design decisions, and what was added to the codebase.

---

## Recommended Follow-Up Work (Prioritized)

### P0: Accessibility (must fix)

1. **Add `prefers-reduced-motion` to globals.css.** This is a WCAG requirement. Add the standard media query that reduces all animation/transition durations to near-zero. Without this, users with vestibular disorders have no way to disable motion.

2. **Add reduced-motion check to scroll-reveal JS.** The `IntersectionObserver` in `page.tsx` should check `matchMedia('(prefers-reduced-motion: reduce)')` and skip animation if true, rendering elements in their final visible state immediately.

### P1: Performance (should fix)

3. **Replace `width` animation on progress bar** (`upload/page.tsx:182`) with `transform: scaleX()`. This is the only layout-triggering animation that runs during actual user interaction (not just page load).

4. **Replace `height` animation on mini-bar chart** (`page.tsx:386`) with `transform: scaleY()`.

### P2: Consistency (nice to fix)

5. **Cap all entrance animations at 500ms.** The `.reveal` class (700ms), `.l-doc-page` (800ms), and `.l-phone-hero` (800ms) all exceed the maximum.

6. **Add explicit `ease-out` to all entrance animations.** Several animations rely on the CSS default `ease` curve instead of the design system's `ease-out`.

7. **Remove infinite looping animations** (`arrowPulse`, `arrowBounce`) or convert to fire-once with IntersectionObserver.

8. **Normalize border-radius values to the scale.** The `.l-tab-btn` (24px should be 20px), `.brief-icon` (6px should be 8px), `.l-pipe-icon` (14px should be 16px), and drop zone (14px should be 12px or 16px).

9. **Normalize spacing values to 4px grid.** SourceLink padding (10px to 12px), tab button padding (10px 22px to 12px 24px), pcard padding (10px to 12px).

---

## GitHub Issue

Created: C29 (see `gh issue` output). Lists all violations for tracking.
