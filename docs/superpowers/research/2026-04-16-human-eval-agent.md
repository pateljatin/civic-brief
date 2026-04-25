# Human Eval Agent for Design and UX Quality: Research Report

**Date:** 2026-04-16
**Status:** Research complete, ready for spec writing

---

## The Problem We're Solving

Right now, Civic Brief's quality assurance has two lanes: unit tests (Vitest) and E2E + accessibility (Playwright + axe-core). What's missing is a third lane that answers a qualitative question: does this page actually look and feel right? Does the summary we produced read like plain language or like legalese? Does the UI honor the design system we've defined?

The goal is a "Civic Eval Agent" that runs automatically and produces a structured, per-page report with pass/fail scores against design, accessibility, and content quality criteria.

---

## What Already Exists in the Project

Before proposing new tools, take stock of what's in place:

- **axe-core + Playwright** (`tests/e2e/pages.spec.ts`): WCAG 2.1 AA scans on every page, viewports (desktop + Pixel 5). Fails on serious/critical violations. Color contrast exceptions are currently whitelisted. This covers structural accessibility well.
- **LLM-as-Judge** (`src/lib/prompts/civic-verify.ts`): Already scores factuality of civic brief content. Can be extended.
- **Design system**: Defined in `src/app/globals.css`. Fraunces (headings), Outfit (body), a named CSS variable palette (--ink, --paper, --warm, --accent, --civic, etc.), mobile-first layout.

The existing test suite catches roughly 30-40% of real WCAG violations (the industry estimate for automated tools). The design system and content tone are entirely unverified by any automated system.

---

## Layer 1: Lighthouse CI (Performance, Best Practices, SEO)

**What it is:** Google Lighthouse packaged for CI pipelines. Runs audits for Performance (Core Web Vitals), Accessibility (augments axe), SEO, and Best Practices. Each category scores 0-100.

**How it works with Next.js / Vercel:** Run as a CI step after deployment using `lhci autorun`. Compares scores against budgets defined in `lighthouserc.json`. Can assert minimum scores (e.g., Accessibility >= 90, Performance >= 85) and block merges if thresholds fail.

**Unlighthouse** is a wrapper worth knowing about. It auto-discovers every URL from your sitemap or by crawling internal links, then runs Lighthouse on all of them in parallel using `puppeteer-cluster`. For Civic Brief, that means scanning `/`, `/upload`, `/brief/[id]`, `/landing`, and `/showcase/*` without maintaining a manual URL list. Outputs a unified dashboard.

**What Lighthouse catches that axe doesn't:**
- Image lazy loading / LCP candidates
- Third-party script impact
- Missing meta descriptions
- Render-blocking resources
- Deprecated APIs

**What Lighthouse misses:** Keyboard navigation flows, custom widget patterns, design consistency, content quality.

**Integration path:**
```
# lighthouserc.json
{
  "ci": {
    "collect": { "url": ["https://civic-brief.vercel.app/", "/upload", "/landing"] },
    "assert": {
      "assertions": {
        "categories:accessibility": ["error", { "minScore": 0.90 }],
        "categories:performance": ["warn", { "minScore": 0.85 }],
        "categories:best-practices": ["error", { "minScore": 0.90 }]
      }
    }
  }
}
```

**Effort:** Low. Add `@lhci/cli` as dev dependency, add a GitHub Actions step post-deploy. One day of work.

---

## Layer 2: Playwright Visual Regression

**What it is:** Screenshot-diffing that catches unexpected visual regressions. Playwright has built-in `toHaveScreenshot()` that compares against stored baselines.

**The tool landscape in 2026:**
- **Playwright built-in**: Free, local. Good for catching regressions. No cloud rendering or AI diffing.
- **Percy (BrowserStack)**: Cloud rendering across real browsers. Free tier: 5,000 snapshots, limited parallelization. Charges for parallelization upgrades.
- **Chromatic**: Free tier: 5,000 snapshots, unlimited parallelization. Integrates with Playwright 1:1 mapping. Can run 2,000 tests in under 2 minutes. Better bang for free tier.

**For Civic Brief specifically:** The Playwright built-in is sufficient for early-stage work. The key risk isn't cross-browser visual drift; it's unintentional layout breaks. A simple baseline test suite costs nothing.

**What visual regression does not catch:** Whether the design looks *right* by design principles. It only catches changes from a known-good baseline. If the baseline itself has a bad layout, the test passes.

**Effort:** Low for built-in Playwright. Medium for Chromatic integration.

---

## Layer 3: LLM Vision Evaluation (The Novel Part)

**The research question:** Can a vision-capable LLM take a screenshot of a page and evaluate it against a design principles document?

**The state of the art:** Yes, with important caveats.

The WebDevJudge paper (arxiv 2510.18560, Oct 2025) is the most relevant academic work. It benchmarks multimodal LLMs as judges for web development quality using three input modalities: source code, screenshots, and interactive sessions. Key finding: **code + screenshots together outperform either alone**. Using only screenshots produced more errors than using source code. The inter-annotator agreement for their rubric-based human labels was 89.7%, suggesting rubric-driven evaluation is reliable for humans.

The gap finding matters: LLM judges currently fail on functional equivalence (does this achieve the same goal differently?), feasibility verification, and bias toward verbose or visually complex outputs. For design principle evaluation, this gap is less severe because design principles tend to be more binary (does this heading use Fraunces? yes/no) than subjective quality judgments.

**What works today with Claude claude-sonnet-4-6 (Sonnet):**
- Font family identification from screenshots (serif vs sans-serif, approximate match)
- Color palette compliance (dominant colors, contrast ratio estimation)
- Layout structure analysis (is this mobile-first? is there sufficient whitespace?)
- Text density and readability signals

**What is unreliable today:**
- Exact pixel measurement from screenshots
- CSS variable resolution (a screenshot can't tell you `--accent` is `#b44d12`)
- Interaction state evaluation (hover, focus, active states)

**Practical architecture for Civic Brief:** Combine code analysis (parse CSS variables, check font-family declarations) with screenshot analysis for layout and visual weight. The LLM judges the screenshot; the code analysis validates the measurable claims.

---

## Layer 4: Content Quality Scoring

**The civic-specific problem:** Our summaries need to be readable by someone with an 8th-grade reading level, free of jargon, and structured around the six civic-context questions (what changed, who affected, what to do, where money goes, deadlines, context).

**Readability metrics:**
- **Flesch-Kincaid Grade Level**: The DoD and multiple US states use this as a standard for document readability. Target for civic briefs: Grade 8 or below. Implemented in `textstat` (Python) or `readable-js` (JavaScript/npm). No LLM needed.
- **Flesch Reading Ease**: Score of 60-70 targets 8th-9th grade. Score below 30 is "very difficult" (academic papers).

**Jargon detection:** The existing LLM-as-Judge verify prompt can be extended with a jargon check rubric. Alternatively, a lightweight word-list approach (flag known civic/legal jargon terms) runs faster and costs nothing.

**Civic structure completeness:** Check whether the output JSON contains non-empty content for all six sections. This is a deterministic check, no LLM required. Already partially present since the summarize prompt returns structured JSON.

**Tone evaluation:** This is where LLM-as-judge genuinely adds value. Prompt: "Does this summary sound like a knowledgeable neighbor explaining local government, or does it sound like the original government document?" Score 1-5 with rubric.

---

## Proposed System: Civic Eval Agent

### Architecture

Three components, three different runners:

```
CivicEvalAgent
├── StaticEval (runs on every PR via CI)
│   ├── Lighthouse CI (perf, a11y, best practices)
│   ├── Playwright screenshot regression (visual diff)
│   └── Deterministic checks:
│       ├── CSS variable presence (--ink, --paper, --accent, --civic)
│       ├── Font family declarations (Fraunces for h1-h4, Outfit for body)
│       └── Brief JSON structure completeness (all 6 sections non-empty)
│
├── LLMEval (runs nightly or on-demand via cron/manual trigger)
│   ├── Screenshot each page (Playwright headless)
│   ├── Claude vision: layout, color, typography compliance score
│   ├── Claude text: tone, jargon, readability rubric
│   └── Flesch-Kincaid score for every generated brief (textstat or syllable npm pkg)
│
└── Report (output to GitHub Actions summary + optional Slack/email)
    ├── Per-page pass/fail table
    ├── Score history (trend over time)
    └── Flag for human review if any score drops > 10 points from baseline
```

### Scoring Rubric (per page)

| Dimension | Automated? | Tool | Pass Threshold |
|---|---|---|---|
| Accessibility (WCAG 2.1 AA) | Yes | axe-core | 0 serious/critical violations |
| Performance (LCP, CLS, FID) | Yes | Lighthouse CI | Score >= 85 |
| Best practices | Yes | Lighthouse CI | Score >= 90 |
| Visual regression | Yes | Playwright screenshots | < 0.1% pixel diff |
| Font compliance (Fraunces/Outfit) | Yes | CSS parse | All headings use Fraunces |
| Color palette compliance | Yes | CSS parse | All vars present, no hardcoded hex |
| Readability (FK Grade Level) | Yes | textstat/syllable | Grade <= 8 |
| Civic structure completeness | Yes | JSON schema check | All 6 sections non-empty |
| Layout compliance (mobile-first) | LLM | Claude + screenshot | Score >= 4/5 |
| Tone (plain language) | LLM | Claude rubric | Score >= 4/5 |
| Jargon-free | LLM | Claude rubric | Score >= 4/5 |

### Report Format

```json
{
  "run_date": "2026-04-16",
  "pages": [
    {
      "route": "/",
      "lighthouse_accessibility": 97,
      "lighthouse_performance": 91,
      "visual_regression": "pass",
      "font_compliance": "pass",
      "llm_layout_score": 5,
      "llm_tone_score": 4,
      "overall": "pass"
    },
    {
      "route": "/upload",
      "lighthouse_accessibility": 94,
      "lighthouse_performance": 88,
      "visual_regression": "pass",
      "font_compliance": "pass",
      "llm_layout_score": 4,
      "llm_tone_score": 5,
      "overall": "pass"
    }
  ],
  "brief_sample": {
    "source": "2025-seattle-budget.pdf",
    "fk_grade_level": 7.2,
    "civic_sections_complete": true,
    "llm_jargon_score": 4,
    "overall": "pass"
  }
}
```

### Implementation Plan (rough)

**Phase 1 (1-2 days): Static eval in CI**
- Add `@lhci/cli` to devDependencies
- Create `lighthouserc.json` with Civic Brief routes and thresholds
- Add CSS/font compliance check as a Vitest test (parse globals.css, assert variable existence)
- Add brief JSON structure completeness check to existing unit tests

**Phase 2 (2-3 days): LLM eval runner**
- New script `scripts/eval-pages.ts`
- Playwright headless: navigate each route, `page.screenshot({ fullPage: true })`
- Pass screenshot as base64 to Claude with design compliance prompt
- Parse scored response, write to `eval-reports/YYYY-MM-DD.json`

**Phase 3 (1 day): Readability scoring**
- Install `syllable` npm package (pure JS, no Python dependency)
- Compute FK Grade Level for each generated brief text
- Add to eval report, gate on Grade <= 8

**Phase 4 (optional, future): Trend tracking**
- Store eval reports in Supabase (new `eval_runs` table)
- Surface score history in a `/admin/eval` route (internal only)

### Key Design Decisions

**Why not Percy or Chromatic yet?** Overkill for a project with 5-6 routes. Playwright built-in visual regression captures the main risk (accidental CSS breakage) for free. Revisit when the route count grows.

**Why separate StaticEval from LLMEval?** LLM calls cost money and take time. Deterministic checks are fast and free; they belong in every PR. LLM evaluation is a nightly quality signal, not a merge gate.

**Why Claude claude-sonnet-4-6 for design eval, not a specialized design tool?** The project already has Claude API access and a structured eval pattern (civic-verify). Reusing that infrastructure is lower operational overhead than adding a new service. The screenshot + code approach compensates for vision-only limitations.

**Why Flesch-Kincaid instead of a more sophisticated readability model?** FK is the standard the US federal government and DoD use. If we ever need to argue our content is accessible to the public, FK is the credible metric. It's also deterministic, fast, and free.

---

## Tooling Reference

- Lighthouse CI: [github.com/GoogleChrome/lighthouse-ci](https://github.com/GoogleChrome/lighthouse-ci)
- Unlighthouse (site-wide Lighthouse): [unlighthouse.dev](https://unlighthouse.dev)
- Chromatic (visual regression, Playwright integration): [chromatic.com](https://www.chromatic.com)
- WebDevJudge (LLM-as-judge for web quality): [arxiv.org/abs/2510.18560](https://arxiv.org/abs/2510.18560), [github.com/lcy2723/WebDevJudge](https://github.com/lcy2723/WebDevJudge)
- syllable (FK-compatible syllable counter, pure JS): [npmjs.com/package/syllable](https://www.npmjs.com/package/syllable)
- axe-core (already integrated): [github.com/dequelabs/axe-core](https://github.com/dequelabs/axe-core)
- Evidently AI LLM-as-judge guide: [evidentlyai.com/llm-guide/llm-as-a-judge](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- a11ypulse 2026 accessibility tools survey: [a11ypulse.com/blog/top-accessibility-tools-in-2026](https://www.a11ypulse.com/blog/top-accessibility-tools-in-2026/)
