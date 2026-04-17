# Civic-Context Prompt Methodology

## The core problem with generic summarization

Most document summarizers answer one question: "What does this document say?" That's useful for reading comprehension but not for civic action. A 400-page city budget summarized as "the city proposes $2.1 billion in spending across 14 departments" tells you nothing useful.

Civic Brief asks six different questions instead. Every brief is structured around what a citizen actually needs to know to participate in local government.

---

## The six civic questions

The summarization prompt (`src/lib/prompts/civic-summarize.ts`) instructs the model to answer these six questions for every document:

**1. What changed?**
The specific action, decision, or policy change. Not a description of the document -- the actual thing that happened. Vote counts are required when present ("passed 30-18," "approved unanimously"). For land use and transportation changes, the prompt explicitly flags these as high-impact and asks the model to name the specific policy (e.g., "eliminates parking minimums within half a mile of transit stops").

**2. Who is affected?**
Named groups, not vague demographics. "Homeowners in single-family zones north of 85th Street" rather than "some residents." For zoning changes, this means specific neighborhoods. For budget cuts, this means specific programs and the people who use them.

**3. What can you do?**
Public comment periods, hearing dates, how to submit testimony, deadlines. If the document doesn't mention any participation mechanisms, the brief says so -- citizens should know whether there's an opportunity to weigh in.

**4. Where does the money go?**
Dollar amounts, budget line items, year-over-year comparisons, contract values, tax rate changes. This field is nullable: if a document contains no financial information, the brief says null rather than inventing context.

**5. Key deadlines**
Dates pulled directly from the source: comment period closes, effective date, next scheduled vote, appeal window. Stored as an array so the UI can display them as a scannable list.

**6. Context**
How this connects to prior decisions. What does it replace or amend? Is this the third reading of a bill that was introduced six months ago? Context prevents citizens from seeing each document in isolation.

---

## Why structured JSON output

The summarization prompt produces a fixed JSON schema, not a narrative paragraph. This is a deliberate architecture choice with several consequences:

**Consistent display.** Every brief renders with the same six sections in the same order. A resident who reads one brief knows exactly where to look in the next one.

**Machine-readable for verification.** The LLM-as-Judge step (see below) receives the JSON summary alongside the source text and checks each claim independently. Structured output makes this comparison tractable. Checking "what_changed: passed 30-18" against a source document is precise. Checking a narrative paragraph is not.

**Translation-safe.** The translation prompt receives the JSON object and returns the same JSON object with all text fields translated. Proper nouns (names, dollar amounts, dates) stay unchanged because they're values in the structure, not embedded in flowing prose.

**Database storage.** The `content` column in the `briefs` table is JSONB. Each field is indexed and queryable. The `what_action` and `deadline` columns are denormalized from the JSON for fast filtering.

The schema enforced by the prompt:

```typescript
interface CivicContent {
  title: string;           // headline, max 100 chars
  what_changed: string;    // the specific decision or action
  who_affected: string;    // named groups
  what_to_do: string;      // participation opportunities
  money: string | null;    // financial details, or null
  deadlines: string[];     // array of dated items
  context: string;         // prior decisions, amendments, history
  key_quotes: string[];    // 1-3 direct quotes from the source
  document_type: string;   // budget | legislation | minutes | ...
}
```

---

## Source-only rule

The prompt includes an absolute constraint: use only information from the source document. No general knowledge, no speculation, no information from other sources.

This is enforced by explicit instruction and then verified. If a document mentions a budget increase but doesn't explain why, the brief doesn't explain why either. If vote counts are present, they go in the brief. If they're not present, the brief doesn't say "the vote count is unknown" -- it just doesn't mention a vote.

The rule is strict for a reason. Government documents are primary sources. Adding context from general knowledge introduces two failure modes: the AI may be wrong about the context, and citizens may not be able to distinguish added context from document facts. Both are democratic harms.

---

## The LLM-as-Judge verification step

After the summary is generated, a second model call checks the summary against the source. The verifier (`src/lib/prompts/civic-verify.ts`) receives both the original document text and the generated JSON, then produces:

- A confidence score (0.00 to 1.00)
- A confidence level (high/medium/low)
- A list of verified claims (traceable to source text)
- A list of unverified claims (cannot be found in the source)
- A list of important omissions (things in the source the brief missed)
- Reasoning explaining the score

The scoring rubric is intentional:

| Score | Level | Meaning |
|-------|-------|---------|
| 0.90-1.00 | High | All claims verified, no significant omissions |
| 0.70-0.89 | High | Minor imprecision, no factual errors |
| 0.50-0.69 | Medium | Some unverified claims or notable omissions |
| 0.00-0.49 | Low | Significant errors or critical omissions |

The verifier is explicitly told: "Civic misinformation is a democratic harm, not just a quality issue." It penalizes wrong numbers, wrong dates, misattributed quotes, overstated certainty, and missing caveats. It does not penalize for simplifying legal language, as long as the meaning is preserved.

Briefs with medium or low confidence scores are flagged in the UI. Community feedback (see the `community_feedback` table) can also trigger re-verification: two or more "factual_error" or "misleading" reports on a brief trigger an automatic re-verify pass.

---

## Translation: civic terminology, not literal translation

The translation prompt (`src/lib/prompts/civic-translate.ts`) is separate from the summarization prompt for a specific reason: translation of civic documents requires domain knowledge.

The prompt instructs the model to use terminology that is natural in the target language for civic contexts. "Public hearing" in English becomes "audiencia publica" in Spanish, not a word-for-word transliteration. Legal and procedural terms should read the way a native speaker of that language would encounter them in a government context.

Dollar amounts, percentages, dates, and proper nouns (names of people, places, organizations) are preserved exactly. The currency is not converted. The date format follows the source.

The same JSON structure goes in and comes back out with all text fields translated. This means the verification score from the English brief applies to the translated brief as well -- the facts haven't changed, only the language.

---

## What the model is not asked to do

Just as important as what the prompts ask for is what they explicitly exclude:

- No opinion or editorializing ("This budget prioritizes...")
- No predictions ("This is likely to...")
- No comparison to other cities or jurisdictions unless the source document makes that comparison
- No explanation of terms the source document doesn't explain
- No context the model knows from training data

If a field has no relevant information in the document, the brief says so: nullable fields return null, required text fields return "Not specified in this document." This prevents hallucination under pressure -- the model is never forced to invent content to fill a required field.

---

## Prompt versioning

The model and prompt version are stored on every brief record (`model_used` and `prompt_version` columns). The current version is `civic-v1.0` using `claude-sonnet-4-20250514`.

When the prompt changes in a way that affects output semantics, the version number increments. This makes it possible to re-process existing sources with a new prompt version and compare outputs, rather than having mixed-version briefs in the database with no way to distinguish them.

---

## Real-world accuracy

Four government PDFs were processed during initial testing (April 2026): a city budget, a zoning ordinance, a council resolution, and a public notice. Confidence scores ranged from 88% to 93%. No hallucinations were detected by the LLM-as-Judge verifier across any of the four documents. The lowest score (88%) was due to the summary omitting a minor budget line item that the verifier flagged as potentially relevant.
