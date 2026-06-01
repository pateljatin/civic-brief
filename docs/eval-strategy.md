# Evaluation Strategy

Civic Brief uses a three-judge system to evaluate quality and accuracy. All judges run automatically. Human feedback can trigger re-evaluation.

## Judge 1: Factuality

Claude Sonnet compares every claim in the brief against the original source document. It reads the government PDF or webpage, extracts text in memory, and scores on a 0 to 1 scale based on this rubric.

| Score | Level | Meaning |
|-------|-------|---------|
| 0.90–1.00 | High | All claims verified, no significant omissions |
| 0.70–0.89 | High | Minor imprecision, no factual errors |
| 0.50–0.69 | Medium | Some unverified claims or notable omissions |
| 0.00–0.49 | Low | Significant factual errors or critical omissions |

Legal simplification is allowed. The judge penalizes: wrong numbers, wrong dates, misattributed quotes, overstated certainty, missing important caveats.

## Judge 2: Readability and Tone

Two components, calculated independently and combined into one badge.

### Readability (Flesch-Kincaid)

Computed instantly when the brief is created. We use the same standard as the US Department of Defense: a grade 8 reading level or lower is plain language.

| Grade | Normalized | Note |
|-------|-----------|------|
| ≤ 8 | 1.0 | Target |
| 9 | 0.7 | Acceptable |
| 10 | 0.4 | Too formal |
| ≥ 11 | 0.1 | Fails plain-language standard |

### Tone and Jargon (Gemini Flash)

Scored asynchronously and backfilled into the badge. The judge rates two dimensions on a 1 to 5 scale.

**Tone** (35% weight):
| 5 | Knowledgeable neighbor explaining local government |
| 4 | Clear and accessible, minor stiffness |
| 3 | Understandable but noticeably formal |
| 2 | Reads like a government press release |
| 1 | Dense and bureaucratic |

**Jargon** (25% weight):
| 5 | No jargon, every high schooler understands |
| 4 | One or two terms, clear from context |
| 3 | Several unexplained specialized terms |
| 2 | Frequent legal or government terminology |
| 1 | Dense unexplained technical, legal, or financial terms |

### Composite Score

Readability (40% weight) + Tone (35%) + Jargon (25%).

```
overall = (0.40 × readabilityNorm) + (0.35 × (toneScore - 1) / 4) + (0.25 × (jargonScore - 1) / 4)
```

The result is a 0 to 1 score displayed as a colored badge: green (> 0.70), yellow (0.50–0.70), red (< 0.50).

## Judge 3: Human Community Verification

Any logged-in user can flag a brief. Five flags per user per minute, enforced by rate limiting. One flag per type per brief per user.

| Type | Action at threshold |
|------|---------------------|
| factual_error | Triggers auto re-verify (Claude) at 2+ flags |
| missing_info | Triggers auto re-verify (Claude) at 2+ flags |
| translation_error | Triggers auto re-translate at 2+ flags |
| misleading | Logged for review |
| outdated | Logged for review |
| helpful | Positive quality signal |

## The Feedback Loop

When factual_error or missing_info flags hit the threshold (2 or more):

1. The system assembles flag details as context.
2. It re-fetches the original source document from its public URL. Nothing is ever stored locally; re-verification re-fetches from government websites.
3. Text is extracted in memory.
4. Judge 1 runs again with human flag context visible to Claude.
5. If the new score is lower, the brief's factuality score updates.

**Trust-degrades-only invariant**: Re-verification can lower the score but never raise it. This prevents gaming through coordinated flag campaigns.

Translation flags work similarly. At 2+ translation_error flags, the brief is re-translated by Claude with the human feedback as context.

## What Is Not Yet Automated

Judge 2 does not yet recalibrate from community feedback. If users consistently flag briefs as misleading despite a good readability score, that signals Flesch-Kincaid grade alone is insufficient as a quality proxy. Recalibrating grade thresholds and tone weights from community disagreement is a v1.2 roadmap item.

## Privacy

Civic Brief never stores uploaded documents or the original government PDFs. When processing begins, text is extracted in memory, the brief is generated, and the document is discarded. Re-verification re-fetches from the original public government URL using the same in-memory pipeline as initial processing.

Human feedback (flags) is stored and linked to the brief and flag type, but not to user identity (no accounts exist). Community feedback is used only for re-evaluation and quality analysis.
