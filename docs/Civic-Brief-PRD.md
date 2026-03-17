# Civic Brief PRD

The living product spec for Civic Brief.

---

## Part I: Strategy Kernel

### Diagnosis

The civic information supply chain is broken at every link.

**The production gap.** Close to 3,500 US newspapers have closed since 2005. 212 counties have zero local news coverage. 50 million Americans have limited access to local news. The institutions that translated government documents into public understanding are gone. ([Northwestern Medill, State of Local News 2025](https://localnewsinitiative.northwestern.edu/projects/state-of-local-news/2025/report/))

**The accessibility gap.** Government documents are published but functionally invisible. A 400-page budget PDF is "public" in the legal sense but private in the practical sense. Only 20% of Americans express confidence they understand local government spending decisions. ([GFOA](https://www.gfoa.org/materials/public-engagement-in-the-budget-process))

**The language gap.** 67.8 million Americans speak a language other than English at home ([US Census Bureau, ACS 2019](https://www.census.gov/library/stories/2022/12/languages-we-speak-in-united-states.html)). 40% of the global population lack access to information in languages they speak fluently ([UNESCO](https://www.unesco.org/en/articles/language-barriers-education)). Government translation, when it exists, is delayed weeks or never completed.

**The trust gap.** Generic AI summarization does not earn civic trust. Getting civic information wrong is not a quality issue; it is a democratic harm. No existing tool combines structured civic interpretation with independent factuality verification.

**The timing gap.** Public comment periods and deadlines pass before affected residents learn about decisions. Information arrives too late for democratic participation.

These gaps compound. A Spanish-speaking homeowner in LA County faces all five simultaneously: no local news covers the hearing, the notice is a dense PDF, it is in English, there is no independent verification, and the comment deadline is in 10 days.

### Guiding Policy

**We will be the open-source civic intelligence layer between government documents and community understanding.**

This means five explicit tradeoffs:

| We choose | Over | Why |
|-----------|------|-----|
| **Civic context** over generic summarization | Building another AI summary tool | "Will my taxes go up?" is a civic question. "Summarize this PDF" is a generic one. The prompt engineering is the product. |
| **Verification** over speed | Shipping briefs faster without quality checks | Civic misinformation is democratic harm. LLM-as-Judge + community review is slow but earns trust. Trust is the flywheel. |
| **Multilingual by default** over English-first | Adding translation as a feature later | Language access is not a nice-to-have. It is the core value proposition for the communities most underserved by civic information. |
| **Open source** over proprietary advantage | Keeping the code closed for competitive moat | Civic orgs, libraries, and newsrooms will only adopt an auditable, deployable tool. Open source is the distribution strategy. |
| **Document processing** over document storage | Building a civic document archive | Privacy by architecture. We never store uploaded documents. This is a trust decision that simplifies compliance and earns user confidence. |

**What we are NOT doing (explicit scope boundaries):**

- We are not a news organization. We do not editorialize.
- We are not a government service. We are independent.
- We are not a civic engagement platform. We do not manage petitions, votes, or campaigns.
- We are not building real-time monitoring (yet). The demo is upload-driven.
- We are not competing with GovTrack or OpenStates on raw data. We compete on interpretation and accessibility.

### Coherent Actions

Three phases of coordinated initiatives, each reinforcing the next:

**Phase 1: Prove the Value (now through April 15, 2026)**
Objective: Live demo that shows the civic intelligence pipeline end-to-end.

- Working upload-to-brief pipeline (built)
- 5 scenario demonstrations on landing page (built)
- LLM-as-Judge verification with confidence scoring (built)
- English + Spanish output (built)
- Source verification links (built)
- Google OAuth for usage tracking (built)
- Mozilla full proposal submission

**Phase 2: Close the Loop (April through September 2026)**
Objective: Turn the demo into a service with community trust.

- Automatic document feed ingestion (RSS/API monitoring)
- Community verification UI (the trust flywheel)
- Location-based subscriptions ("changes near me")
- WhatsApp/SMS sharing integration
- Budget visualization and year-over-year comparison
- Notification system (email/push)
- 3+ languages pre-generated per brief

**Phase 3: Scale the Platform (September 2026 through March 2027)**
Objective: Multi-jurisdiction, multi-language, community-sustained.

- 100+ jurisdictions monitored automatically
- Newsroom embed widget
- International jurisdiction trees (India, Nigeria, UK)
- pgvector semantic search
- Audio briefs (text-to-speech)
- Tier II Mozilla funding ($250K) application
- First civic org deployments (self-hosted instances)

---

## Part II: The Product Flywheel

```
Government publishes document
        |
        v
Civic Brief ingests + interprets
        |
        v
Citizens read plain-language brief
        |
        v
Citizens share (WhatsApp, link, embed)
        |
        v
More citizens find value, return for next document
        |
        v
Community reviewers verify flagged briefs
        |
        v
Verification improves trust + prompt quality
        |
        v
Trust drives adoption by civic orgs + libraries + newsrooms
        |
        v
Civic orgs contribute document feeds
        |
        v
More documents flow in (back to top)
```

Every scenario below feeds this loop at a different entry point. Budget tracking enters through recurring annual documents. School board enters through motivated parent networks. Zoning enters through geographic relevance. Legislation enters through advocacy distribution. Multilingual access multiplies throughput at every node.

---

## Part III: Scenario Specifications

Each scenario is structured with Socratic questions for requirements clarity.

---

### Scenario 1: Budget Tracking

#### Problem Clarity

**What specific user pain point does this solve?**
Residents cannot determine how government spending decisions affect them personally. A budget PDF says "property tax levy proposed at 1.21 per $100 assessed." A civic brief says "your $300K home will cost $270 more per year."

**Who experiences this most acutely?**
Homeowners with fixed incomes (property tax increases hit hardest), parents (school funding changes affect their kids), and small business owners (commercial assessments and fee changes).

**What is the cost of NOT solving this?**
Budget decisions are made without meaningful public input. Only 30% of residents feel local government is transparent about budget decisions ([Euna Solutions, 2024](https://eunasolutions.com/resources/how-local-governments-can-align-budgets-with-community-needs/)). Comment periods pass with 2-3 attendees. Property tax surprises arrive as bills. Service cuts happen invisibly. When residents can participate (e.g., NYC's participatory budgeting), 99,250+ residents engaged and $210M was allocated across 706 community-chosen projects ([NYC Council, 2012-2024](https://www.participatorybudgeting.org/participatory-budgeting-in-nyc/)).

#### Solution Validation

**Why is this the right solution?**
The document already contains the answers. No new data collection is needed. The gap is interpretation: translating budget line items into personal impact. Claude's structured output with civic-context prompting bridges this gap in minutes instead of the days a journalist would spend.

**What alternatives did we consider?**

| Alternative | Why not |
|-------------|---------|
| Hire journalists to cover every budget | Does not scale. 19,500+ municipalities ([US Census Bureau, 2012](https://www.census.gov/newsroom/releases/archives/governments/cb12-161.html)). |
| Train citizens to read budgets | Noble but unrealistic. Requires expertise and hours. |
| Government-produced summaries | Conflict of interest. Governments summarize favorably. |
| Generic AI summarization (ChatGPT, etc.) | Does not ask civic questions. "Summarize this" is not "what happens to my taxes?" |

**What is the simplest version?**
What we have now: upload PDF, get civic brief with personal impact language, see confidence score, read in English or Spanish. This is the demo. It works.

#### Success Criteria

**How will we measure success?**
- Primary: briefs read per budget season per jurisdiction (target: 500+ reads for a city of 50K)
- Secondary: share rate (target: 20%+ of readers share the brief)
- Signal: public comment attendance at budget hearings (qualitative, from partner orgs)

**What would indicate failure?**
- Briefs are generated but not read (<50 reads per brief)
- Community feedback flags frequent factual errors (>10% error rate on dollar amounts)
- Users upload a budget but do not return for the next quarter/year

**What metric are we moving and by how much?**
Civic awareness of budget decisions: from ~1% of residents (those who read the PDF) to ~10% (those who read or receive a brief). 10x is the bar.

#### Constraints

**What technical risks exist?**
- Large budgets (400+ pages) exceed Claude's context window. Must chunk intelligently.
- Budget formats vary wildly across municipalities. No standard schema.
- Year-over-year comparison requires structured extraction, not just summarization.

**What are we NOT doing?**
- Not building a financial auditing tool
- Not providing investment or tax advice
- Not replacing professional budget analysis

**If we had half the time, what would we cut?**
Year-over-year comparison and budget visualization. Keep the core: upload budget, get plain-language impact brief.

#### User Personas

**Maria** (primary): Homeowner, 42, mid-size city. 3 minutes on her phone. Cares about property taxes and schools.

**Alex** (secondary): Digital-first local reporter. Needs a starting point with sourced claims.

**Priya** (tertiary): Civic activist. Needs line-item changes, not just headlines.

#### User Journey

```
1. City posts FY2027 proposed budget on website
2. Maria uploads PDF to Civic Brief (future: auto-ingested)
3. Pipeline: extract -> summarize -> verify -> translate
4. Brief shows:
   - Property tax: 1.21 per $100 (up 8.2% from 1.12)
   - Personal impact: ~$270/year more on $300K home
   - Where money goes: $4.1M roads, $2.3M schools
   - What got cut: police fleet ($890K deferred)
   - Deadline: comment by April 12. Hearing April 18, 7pm.
5. Maria shares on neighborhood WhatsApp
6. Neighbors read, share further
7. Neighbor flags missing parks budget cut -> community feedback
8. Brief updated, quality improves
9. Maria attends hearing with specific questions
```

#### Feature Requirements

| ID | Feature | Status | Phase | Scenarios |
|----|---------|--------|-------|-----------|
| B1 | PDF upload + civic summarization | Built | 1 | All |
| B2 | Property tax impact calculator | Not built | 2 | Budget |
| B3 | Year-over-year budget comparison | Not built | 2 | Budget |
| B4 | Budget line-item visualization | Not built | 2 | Budget |
| B5 | Historical budget tracking per jurisdiction | Not built | 3 | Budget |

#### Key Metrics

| Metric | Target (Phase 1) | Target (Phase 2) |
|--------|-------------------|-------------------|
| Briefs generated per budget season | 10 | 100 |
| Unique readers per brief | 50 | 500 |
| Share rate | 10% | 20% |
| Community feedback per brief | 0 | 3+ |

---

### Scenario 2: School Board

#### Problem Clarity

**What specific user pain point does this solve?**
Parents learn about school board decisions after the comment period closes. Board resolutions are dense legal documents. Meeting times (weekday evenings) exclude working parents.

**Who experiences this most acutely?**
Working parents who cannot attend meetings, especially single parents and those working multiple jobs. Only 22% of public school parents attended a school board meeting in the past year ([PDK Poll, 2024](https://pdkpoll.org/2024-poll-results/)). Also: non-English-speaking parents in diverse school districts.

**What is the cost of NOT solving this?**
16,201 school districts with 90,000+ board members control $600 billion annually ([Research.com, 2024](https://research.com/education/american-school-statistics)). Decisions about bus routes, curricula, facility closures, and teacher contracts are made without parent input. Parents discover changes when their child's pickup time shifts or their school closes. The stakes are real: 80% of students with highly involved parents pursue college vs. 56% with uninvolved parents ([APA, 2019](https://www.aecf.org/blog/parental-involvement-is-key-to-student-success-research-shows)).

#### Solution Validation

**Why is this the right solution?**
School board resolutions follow predictable patterns (WHEREAS... BE IT RESOLVED...). Civic-context prompting is especially effective on these because the structure is consistent. The output answers exactly what parents need: what changed, how much, who voted, when to comment.

**What alternatives did we consider?**

| Alternative | Why not |
|-------------|---------|
| PTA volunteers summarizing resolutions | Volunteer capacity is limited and inconsistent. Quality varies. |
| School district summaries | Districts summarize selectively. Controversial decisions get less coverage. |
| Local news coverage | Most districts have no dedicated education reporter. |

**What is the simplest version?**
Same as budget: upload resolution PDF, get structured civic brief. The demo handles this already.

#### Success Criteria

**How will we measure success?**
- Primary: parent reads per resolution (target: 100+ for a district of 10K students)
- Secondary: public comments submitted with brief link as source
- Signal: PTA adoption (PTAs that make Civic Brief part of their workflow)

**What would indicate failure?**
- Parents do not find the briefs (distribution problem, not product problem)
- Briefs miss vote counts or misattribute votes (factual error on the most important data point)

#### User Personas

**David** (primary): Working parent, 38, two kids in public school. Cannot attend Tuesday 6pm meetings.

**PTA leadership** (secondary): Tracks board decisions, distributes to parent network.

**Education reporter** (tertiary): Covers education for a small newsroom. Needs to identify newsworthy decisions quickly.

#### User Journey

```
1. Board passes Resolution 2026-0142 at Tuesday meeting
2. PDF posted to district website (48-72 hours later)
3. PTA president uploads to Civic Brief
4. Brief shows:
   - What changed: new bus contract, TransitCo replaces SafeRide
   - Money: $2.4M total ($800K/year), up from $1.8M
   - Action: public comment open until March 22, next meeting April 3
   - Vote: passed 5-2 (Chen, Park, Okafor, Williams, Ruiz in favor)
5. PTA shares in parent group chat
6. Parent notices "$1.8M" should be "$1.9M" -> files factual_error
7. Brief corrected, trust maintained
8. Three parents submit comments before March 22
```

#### Feature Requirements

| ID | Feature | Status | Phase | Scenarios |
|----|---------|--------|-------|-----------|
| S1 | Vote tracking in civic summary | Partial | 1 | School, Legislation |
| S2 | District-wide resolution feed | Not built | 2 | School |
| S3 | Board member voting history | Not built | 3 | School |
| S4 | Meeting calendar integration | Not built | 2 | School, Zoning |

#### Key Metrics

| Metric | Target (Phase 1) | Target (Phase 2) |
|--------|-------------------|-------------------|
| Resolutions briefed per district | 5 | 50 |
| Parent reads per resolution | 20 | 100 |
| Public comments correlated with briefs | 0 | 5+ per resolution |

---

### Scenario 3: Zoning

#### Problem Clarity

**What specific user pain point does this solve?**
Homeowners do not know their block is being rezoned until construction starts. Zoning notices are mailed to adjacent properties (sometimes) and published in newspapers (that nobody reads). The legal text is impenetrable: "pursuant to Municipal Code 17.24.060, the Commission recommends approval subject to conditions including parking variance 17.28.040(b)."

**Who experiences this most acutely?**
Adjacent property owners. Their home values, street parking, noise levels, and neighborhood character change based on decisions they did not know about.

**What is the cost of NOT solving this?**
Zoning decisions are made with minimal public input. The typical public comment on a zoning amendment gets 2-3 responses. Developers know this and exploit it. Restrictive zoning increases house values by 17-69% depending on location ([Regional Science and Urban Economics, 2025](https://www.sciencedirect.com/science/article/abs/pii/S009411902500049X)). Residents feel blindsided and lose trust in local government. Current notification methods (newspaper legal ads, mailed notices to property owners only) fail to reach renters and younger residents entirely ([APA, 2024](https://www.planning.org/zoningpractice/2024/may/an-equitable-approach-to-zoning-notifications/)).

#### Solution Validation

**Why is this the right solution?**
Zoning is the most geographically specific civic decision. This is where our PostGIS jurisdiction model pays off. A brief tagged to a specific block, delivered to residents who set their address, is fundamentally more useful than a generic notification.

**What alternatives did we consider?**

| Alternative | Why not |
|-------------|---------|
| Better government notification (certified mail to more addresses) | Expensive, still incomprehensible legal text. |
| Nextdoor/neighborhood apps | Not structured civic intelligence. Just social discussion. |
| Real estate monitoring services (Zillow, Redfin alerts) | Focused on property value, not civic participation. |

**What is the simplest version?**
Upload zoning PDF, get brief with plain-language impact and comment deadline. Future: location-tagged alerts.

#### Success Criteria

**How will we measure success?**
- Primary: public comments per zoning application in areas with Civic Brief vs. without
- Secondary: resident subscriptions per geographic area
- Signal: neighborhood association adoption

**What would indicate failure?**
- Zoning briefs are not location-specific enough (PostGIS tagging not working)
- Residents receive briefs after comment deadline (timing problem)

#### User Personas

**Sarah** (primary): Homeowner, 55, Elm Street. Got a mailed notice she cannot parse.

**Neighborhood association** (secondary): Tracks all zoning in their area. Needs pattern detection.

**Real estate professional** (tertiary): Monitors zoning for property value impact.

#### User Journey

```
1. Developer files Zoning Amendment 47-B
2. Public notice posted on city website
3. Neighborhood association uploads to Civic Brief
4. Brief shows:
   - Location: Elm St 400-600, residential to mixed-use
   - Impact: shops/offices ground floor, housing above, 45ft max
   - Warning: parking requirement reduced
   - Deadline: comment by April 5. Council vote April 15.
5. Brief tagged to location via PostGIS
6. Future: residents near Elm St get automatic notification
7. Sarah reads, understands, writes comment
8. 15 residents comment (vs. typical 2-3)
```

#### Feature Requirements

| ID | Feature | Status | Phase | Scenarios |
|----|---------|--------|-------|-----------|
| Z1 | PostGIS location tagging per brief | Schema ready | 2 | Zoning, Budget |
| Z2 | Address-based notifications | Not built | 2 | Zoning |
| Z3 | Map visualization of zoning changes | Not built | 3 | Zoning |
| Z4 | Developer tracking / pattern detection | Not built | 3 | Zoning |

#### Key Metrics

| Metric | Target (Phase 1) | Target (Phase 2) |
|--------|-------------------|-------------------|
| Zoning briefs per municipality | 5 | 50 |
| Public comments per application | 3 | 15 |
| Address subscriptions | 0 | 500 |

---

### Scenario 4: Legislation

#### Problem Clarity

**What specific user pain point does this solve?**
Bills are written in legal language. Media coverage focuses on partisan framing ("Democrats push housing bill") not practical impact ("you can now build a rental unit in your backyard"). Citizens cannot determine if a bill helps or hurts them.

**Who experiences this most acutely?**
Citizens directly affected by specific legislation (homeowners for housing bills, patients for health bills, workers for labor bills) who lack legal training to interpret bill text.

**What is the cost of NOT solving this?**
80% of Americans cannot name their state legislator ([Johns Hopkins, 2018](https://www.route-fifty.com/management/2018/12/knowledge-gaps-state-government/153452/)). State legislatures introduce 246,405 bills per session, 12.7x more than Congress ([MultiState, 2024](https://www.multistate.us/insider/2024/12/11/state-lawmakers-introduce-over-a-quarter-million-bills-each-season)). Legislation is decided by lobbyists and advocates who understand bill text. The public participates through partisan signaling, not informed input.

#### Solution Validation

**Why is this the right solution?**
Bills have the widest blast radius of any civic document. A single state bill affects millions. The civic-context prompt converts legal text into practical impact. The structured output (what it does, who it affects, when it takes effect) is exactly what citizens need.

**What alternatives did we consider?**

| Alternative | Why not |
|-------------|---------|
| GovTrack / OpenStates | Raw data without plain-language interpretation. |
| Media explainers | Partisan framing. Not structured for personal impact. |
| Legislative staff summaries | Often biased toward the sponsor's intent. |

**What is the simplest version?**
Upload bill text PDF, get civic brief. This works today. Future: bill tracking through legislative lifecycle.

#### Success Criteria

**How will we measure success?**
- Primary: reads per legislative brief (target: 1,000+ for state-level bills)
- Secondary: advocacy organization adoption (orgs using Civic Brief for distribution)
- Signal: citizen comments on proposed rules citing Civic Brief as source

**What would indicate failure?**
- Briefs oversimplify legal nuance (lose important caveats, exceptions, effective dates)
- Advocacy orgs do not trust the output enough to distribute

#### User Personas

**Tom** (primary): Homeowner, 60. Heard about ADU laws, cannot parse bill text.

**Policy advocate** (secondary): Housing nonprofit. Tracks legislation across states.

**City planner** (tertiary): Needs to understand how state law affects local codes.

#### User Journey

```
1. State Senate introduces SB-1247 (ADU reform)
2. Bill text published on legislature website
3. Housing nonprofit uploads to Civic Brief
4. Brief shows:
   - What: easier to build backyard apartments
   - Changes: max 1,200 sqft, 60-day approval requirement
   - Who: homeowners wanting rental units, renters seeking options
   - When: January 1, 2027 if signed
5. Nonprofit shares with 5,000-person member list
6. Tom reads, realizes he qualifies
7. Policy expert flags missing setback requirements -> community feedback
8. Brief updated
9. 200 reads in first week
```

#### Feature Requirements

| ID | Feature | Status | Phase | Scenarios |
|----|---------|--------|-------|-----------|
| L1 | Bill tracking (introduced -> signed) | Not built | 2 | Legislation |
| L2 | Sponsor/co-sponsor information | Not built | 2 | Legislation |
| L3 | Cross-state bill comparison | Not built | 3 | Legislation |
| L4 | Legislative session timeline | Not built | 3 | Legislation |

#### Key Metrics

| Metric | Target (Phase 1) | Target (Phase 2) |
|--------|-------------------|-------------------|
| Bills briefed per session | 5 | 50 |
| Reads per legislative brief | 100 | 1,000 |
| Advocacy org adopters | 0 | 5 |

---

### Scenario 5: Multilingual Access

#### Problem Clarity

**What specific user pain point does this solve?**
Civic information is published in the dominant language. Non-dominant-language speakers are excluded from democratic participation not by law but by language.

**Who experiences this most acutely?**
Spanish speakers in the US (41.8 million, [US Census Bureau ACS 2019](https://www.census.gov/library/stories/2022/12/languages-we-speak-in-united-states.html)). Hindi speakers in English-medium Indian states. Any community where the government publishes in a language the majority does not read fluently.

**What is the cost of NOT solving this?**
25.7 million Americans have limited English proficiency ([Migration Policy Institute, 2021](https://www.migrationpolicy.org/research/limited-english-proficient-individuals-united-states-number-share-growth-and-linguistic)), a population that grew 80% since 1990. When language access is provided, civic participation increases dramatically: Native American voter turnout increased 50-150%, and Latino/Filipino registrations rose 20%+ ([AAJC](https://www.advancingjustice-aajc.org/sites/default/files/policymaker-full5.pdf)). Without it, entire communities are governed without their understanding or input.

#### Solution Validation

**Why is this the right solution?**
Translation is not just language conversion. "Public hearing" is "audiencia publica," not "hearing publico." Civic Brief's translation prompt preserves civic terminology, dollar amounts, dates, and legal terms. Government translation services are slow (weeks) or nonexistent.

**What alternatives did we consider?**

| Alternative | Why not |
|-------------|---------|
| Google Translate on government websites | Literal translation loses civic meaning. No structured output. |
| Government-provided translations | Delayed weeks. Often incomplete. Only covers legally required languages. |
| Bilingual community volunteers | Heroic but unsustainable. Hours of work per document. |
| India's Bhashini | Government-run (not independent), translates but does not interpret civic impact. |

**What is the simplest version?**
What we have: English + Spanish generated simultaneously, on-demand translation for other languages. This is built and working.

#### Success Criteria

**How will we measure success?**
- Primary: non-English brief reads as % of total reads (target: 40%+ in multilingual jurisdictions)
- Secondary: on-demand translation requests per language (reveals unmet demand)
- Signal: community leaders who become regular uploaders

**What would indicate failure?**
- Translations lose civic meaning (dollar amounts converted, dates reformatted, legal terms mistranslated)
- Non-English briefs are not shared (distribution problem, not quality problem)

#### User Personas

**Rosa** (primary): LA County resident, 50. Reads and thinks in Spanish. Works in English.

**Miguel** (secondary): Bilingual neighborhood council leader. Currently translates documents manually.

**Immigrant services org** (tertiary): Serves communities in 5+ languages. Cannot afford translation at scale.

#### User Journey

```
1. LA County publishes hearing notice (English, "also available" translations delayed)
2. Miguel uploads to Civic Brief
3. English + Spanish briefs generated simultaneously
4. Rosa receives Spanish brief via Miguel's WhatsApp group
5. Brief (in Spanish):
   - Que Cambia: more housing in R-3/R-4 zones
   - A Quien Afecta: tenants/homeowners in R-3/R-4 in LA County
   - Fecha Limite: comments before April 15. Hearing April 22, 10am.
   - Que Puede Hacer: submit written comments or attend hearing
6. Rosa reads in 2 minutes, submits comment in Spanish
7. Miguel shares link, 400 reads in first day
8. Hindi speaker clicks Hindi toggle -> on-demand translation, 5 seconds
9. Hindi-speaking neighbors now have access
```

#### Feature Requirements

| ID | Feature | Status | Phase | Scenarios |
|----|---------|--------|-------|-----------|
| M1 | English + Spanish simultaneous generation | Built | 1 | All |
| M2 | On-demand translation (any language) | Built | 1 | All |
| M3 | Hindi pre-generation | Prompt ready | 2 | All |
| M4 | Language preference per jurisdiction | Schema ready | 2 | All |
| M5 | Community translation verification | Not built | 2 | Multilingual |
| M6 | RTL language support | Not built | 3 | Multilingual |
| M7 | Audio briefs (text-to-speech) | Not built | 3 | All, Multilingual |
| M8 | WhatsApp sharing integration | Not built | 2 | All, Multilingual |

#### Key Metrics

| Metric | Target (Phase 1) | Target (Phase 2) |
|--------|-------------------|-------------------|
| Non-English reads as % of total | 20% | 40% |
| Languages with active readers | 2 | 5 |
| On-demand translation requests/month | 10 | 200 |
| Community translation corrections | 0 | 20/month |

---

## Part IV: Cross-Scenario Requirements

### Consolidated Feature Matrix

Every feature, deduplicated, with the scenarios it serves and its phase.

| ID | Feature | Phase | Scenarios | Status |
|----|---------|-------|-----------|--------|
| C1 | PDF upload + civic summarization | 1 | All | Built |
| C2 | LLM-as-Judge verification | 1 | All | Built |
| C3 | English + Spanish generation | 1 | All | Built |
| C4 | On-demand translation | 1 | All | Built |
| C5 | Source verification links | 1 | All | Built |
| C6 | Google OAuth + usage tracking | 1 | All | Built |
| C7 | Automatic document feed ingestion | 2 | All | Not built |
| C8 | Community verification UI | 2 | All | Not built |
| C9 | Location-based subscriptions | 2 | Zoning, Budget | Not built |
| C10 | WhatsApp/SMS sharing | 2 | All, esp. Multilingual | Not built |
| C11 | Budget visualization + YoY comparison | 2 | Budget | Not built |
| C12 | Notification system (email/push) | 2 | All | Not built |
| C13 | Bill tracking lifecycle | 2 | Legislation | Not built |
| C14 | PostGIS brief tagging | 2 | Zoning, Budget | Schema ready |
| C15 | Property tax impact calculator | 2 | Budget | Not built |
| C16 | District-wide resolution feed | 2 | School | Not built |
| C17 | Community translation verification | 2 | Multilingual | Not built |
| C18 | Newsroom embed widget | 3 | All | Not built |
| C19 | Multi-jurisdiction dashboard | 3 | All | Not built |
| C20 | International jurisdiction trees | 3 | All | Not built |
| C21 | pgvector semantic search | 3 | All | Not built |
| C22 | Audio briefs (TTS) | 3 | All, Multilingual | Not built |
| C23 | Map visualization | 3 | Zoning | Not built |

### Phase 2 Priority Stack (post-demo)

Ordered by flywheel impact, answering "why build this RIGHT NOW?"

1. **C7: Document feed ingestion** - Without this, every document is manually uploaded. This is the bottleneck that limits every scenario. It converts Civic Brief from a tool into a service.

2. **C8: Community verification UI** - The trust loop does not close without this. LLM-as-Judge provides automated trust; community verification provides human trust. Mozilla reviewers will specifically ask about this.

3. **C10: WhatsApp/SMS sharing** - The distribution channel for the multilingual scenario. In communities where Civic Brief has the most impact, WhatsApp is the primary information channel. A share button with a clean formatted message is the growth lever.

4. **C9: Location-based subscriptions** - Transforms the zoning scenario from reactive (upload and read) to proactive (get notified). Also makes budget tracking passive ("your jurisdiction published a new budget").

5. **C11: Budget visualization** - The highest-engagement feature for the highest-value scenario. Charts and impact calculators make budget briefs shareable in ways that text alone cannot.

6. **C12: Notifications** - Completes the subscription model. Without notifications, users must check the portal. With notifications, the portal comes to them.

---

## Part V: Strategic Fit

### Why build this RIGHT NOW?

Three converging forces:

1. **LLM capability threshold crossed.** Claude Sonnet 4 reliably produces structured JSON from dense legal text with 88-93% factuality (verified across 4 real government PDFs in end-to-end testing, March 2026). This was not possible 18 months ago. The prompting techniques for civic context are novel and not easily replicated.

2. **Local news collapse accelerating.** 148 newspapers closed in the past year alone. Web traffic to the 100 largest newspapers dropped 45% in four years. The gap between government document publication and public understanding widens every year. ([Northwestern Medill, 2025](https://localnewsinitiative.northwestern.edu/projects/state-of-local-news/2025/report/))

3. **Mozilla Democracy x AI funding.** $50K seed with $250K follow-on is catalytic capital for an open-source tool. The grant validates the approach and provides runway to prove the flywheel.

### How does this affect competitive position?

| Competitor | Their approach | Our advantage |
|------------|---------------|---------------|
| GovTrack / OpenStates | Raw data, no interpretation | Civic-context plain language |
| LocalLens / Saratoga Hamlet | Bespoke per-city | Open-source, any jurisdiction |
| India's Bhashini | Government-run translation | Independent, interprets impact |
| ChatGPT / generic AI | "Summarize this PDF" | Structured civic questions, verification |
| Google Translate | Literal translation | Civic terminology preservation |

No existing tool combines: civic-context prompting + independent verification + multilingual by default + open source + location-aware. This is the compound moat.

---

## Part VI: Tracking and Requirements Management

### Recommended: GitHub Issues + Milestones

For an open-source project, requirements tracking should live where contributors already are. GitHub provides everything we need without adding another tool.

**Structure:**

```
GitHub Milestones (map to phases):
  - v1.0 Demo (Phase 1) - April 15, 2026 [DONE]
  - v1.1 Trust Loop (Phase 2a) - June 2026
  - v1.2 Subscriptions (Phase 2b) - September 2026
  - v2.0 Scale (Phase 3) - March 2027

GitHub Labels (for filtering):
  scenario/budget
  scenario/school-board
  scenario/zoning
  scenario/legislation
  scenario/multilingual
  type/feature
  type/infrastructure
  type/bug
  priority/p0-critical
  priority/p1-high
  priority/p2-medium
  priority/p3-low
  status/ready
  status/needs-spec
  status/blocked
```

**Each feature from the matrix (C1-C23) becomes a GitHub Issue** with:
- Title: feature name
- Body: the Socratic Q&A from the scenario section (problem, alternatives, simplest version, success criteria, failure indicators)
- Labels: scenario(s), type, priority
- Milestone: phase
- Linked issues: dependencies (e.g., C9 depends on C14)

**Why not Linear/Jira/Notion?**
- Contributors to an open-source project should not need a separate account
- GitHub Issues are public, auditable, and integrated with PRs
- Milestones provide the roadmap view
- Labels provide the filtering
- GitHub Projects (free kanban board) adds a visual layer if needed later

### Issue Template

```markdown
## Feature: [name]

**ID:** C[number] from Civic-Brief-PRD.md
**Phase:** [1/2/3]
**Scenarios:** [which scenarios this serves]

### Problem
[From the Socratic "what specific pain point" answer]

### Solution
[What we are building]

### Simplest Version
[The MVP of this feature]

### Success Criteria
[Measurable outcomes]

### Failure Indicators
[What would tell us this is not working]

### Dependencies
[Other features that must exist first]

### Not Doing
[Explicit scope boundaries]
```

---

## Part VII: Quantified Flywheel Projections

Moderate adoption in one metro area over 12 months:

| | Month 1-3 | Month 4-6 | Month 7-9 | Month 10-12 |
|---|-----------|-----------|-----------|-------------|
| **Phase** | Demo | Trust loop | Org adoption | Network effects |
| **Jurisdictions** | 5 | 25 | 100 | 500+ |
| **Documents/month** | 50 | 200 | 1,000 | 5,000 |
| **Brief reads/month** | 500 | 5,000 | 50,000 | 500,000 |
| **Languages** | 2 | 3 | 5 | 8+ |
| **Community verifiers** | 0 | 10 | 50 | 200+ |
| **Civic org partners** | 0 | 2 | 5 | 20+ |
| **Ingestion source** | 100% manual | 50% auto | 80% auto | 90% auto |
| **Milestone** | Mozilla submission | First partner | Tier II application | Tier II funded |

---

## Part VIII: Open Questions

Questions to resolve before or during Phase 2:

1. **Monetization model.** The grant funds 12 months. What sustains Civic Brief after? Options: civic org SaaS tier, foundation grants, government contracts, donation-supported. Each has tradeoffs for independence and trust. Needs a decision by month 6.

2. **Content moderation.** What happens when someone uploads a non-government document? A campaign flyer? Misinformation? The demo does not filter by document source. Phase 2 needs a policy.

3. **Government partnership vs. independence.** Some governments will want to submit documents directly. This increases coverage but risks perceived bias. Need clear editorial independence policy.

4. **Liability for errors.** If a brief says property taxes go up 8% but it is actually 12%, is there legal exposure? Needs legal review before Phase 2 launch.

5. **Contributor governance.** As an open-source project, who decides what features get built? What is the contribution process? Need CONTRIBUTING.md and governance model before soliciting external contributors.

6. **Data retention.** We never store documents, but we do store briefs indefinitely. Should briefs expire? Should there be a retention policy? Especially relevant for briefs that community feedback has flagged as inaccurate.
