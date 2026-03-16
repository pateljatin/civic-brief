# Test Government PDFs for Civic Brief

Curated collection of real, publicly available government documents for testing the Civic Brief pipeline. Every URL links directly to a PDF hosted on an official government domain. Documents selected for diversity of type, jurisdiction size, civic impact, and complexity.

Last updated: March 16, 2026

---

## Summary Table

| # | Document | Type | Jurisdiction | Pages (est.) | Size (est.) |
|---|----------|------|-------------|-------------|-------------|
| 1 | Seattle 2025-2026 Budget Summary | Budget | Seattle, WA (750K) | 30-40 | 2-4 MB |
| 2 | Bellevue 2025-2026 Budget Ordinance | Budget | Bellevue, WA (155K) | 15-25 | 500 KB-1 MB |
| 3 | Lake Stevens 2025 Annual Budget Book | Budget | Lake Stevens, WA (45K) | 80-120 | 3-6 MB |
| 4 | Renton 2025-2026 Budget Overview | Budget | Renton, WA (107K) | 20-30 | 2-4 MB |
| 5 | Issaquah School District Board Minutes (Oct 2025) | Meeting Minutes / Resolution | Issaquah, WA (40K) | 5-10 | 200-500 KB |
| 6 | Seattle Public Schools F-195 Budget | School Budget | Seattle, WA (750K) | 20-40 | 1-3 MB |
| 7 | Yakima Levy Lid Lift Resolution | Resolution | Yakima, WA (98K) | 3-6 | 100-300 KB |
| 8 | Seattle Neighborhood Residential Zoning Update | Zoning / Planning | Seattle, WA (750K) | 10-20 | 1-3 MB |
| 9 | Seattle One Seattle Plan Zoning FAQ | Zoning / Planning | Seattle, WA (750K) | 8-15 | 500 KB-1 MB |
| 10 | WA HB 1491: Transit-Oriented Housing | Legislation | Washington State | 8-15 | 200-500 KB |
| 11 | WA HB 2266: Supportive Housing | Legislation | Washington State | 5-10 | 150-400 KB |
| 12 | WA SB 6026: Residential Dev./Zones (Bill Report) | Legislation | Washington State | 5-10 | 200-400 KB |
| 13 | Seattle Executive Order 2026-02: Housing & Shelter | Executive Order | Seattle, WA (750K) | 3-5 | 100-300 KB |
| 14 | Sammamish CIP Summary 2026-2031 | Capital Plan | Sammamish, WA (67K) | 10-20 | 1-3 MB |

---

## City Budgets

### 1. Seattle 2025-2026 Proposed Budget Summary

**URL:** https://www.seattle.gov/documents/departments/financedepartment/2526proposedbudget/2526_proposedbudgetsummary.pdf

**Type:** City Budget Summary
**Jurisdiction:** City of Seattle, WA (pop. ~750,000)
**Estimated pages:** 30-40
**Estimated size:** 2-4 MB

**Why this is a good test case:**
Large city, major budget ($8.3B proposed). The summary version is digestible (not the full 400+ page budget book) but still contains real dollar amounts, departmental breakdowns, and policy priorities. Tests whether the civic summarizer can extract "where does the money go" from a complex financial document.

**What a good civic brief should highlight:**
- Total budget size and year-over-year change
- Top spending priorities (public safety, housing/homelessness, transportation)
- New investments or cuts that affect residents directly
- How the budget addresses homelessness, affordable housing, transit
- Any fee increases or tax changes
- Key departmental allocations

---

### 2. Bellevue 2025-2026 Biennial Budget Ordinance

**URL:** https://mrsc.org/getmedia/d7bcec7b-9d9b-4c36-b314-5b04aecf6576/b44bbo2025-2026.pdf

**Type:** Budget Ordinance
**Jurisdiction:** City of Bellevue, WA (pop. ~155,000)
**Estimated pages:** 15-25
**Estimated size:** 500 KB-1 MB

**Why this is a good test case:**
Mid-size Eastside city. Budget ordinances are the legal documents that authorize spending; they are denser and more legalistic than summary presentations. Tests whether the engine can parse formal legislative language and extract the civic meaning. Total budget of $1.86B. Hosted on MRSC (Municipal Research and Services Center), a common source for Washington municipal documents.

**What a good civic brief should highlight:**
- Total appropriation by fund
- Property tax levy amounts
- Capital improvement program highlights
- Effective date and any conditions
- Comparison to previous biennium if mentioned

---

### 3. Lake Stevens 2025 Annual Budget Book

**URL:** https://www.lakestevenswa.gov/DocumentCenter/View/14082/2025-Annual-Budget-Book

**Type:** Annual Budget
**Jurisdiction:** City of Lake Stevens, WA (pop. ~45,000)
**Estimated pages:** 80-120
**Estimated size:** 3-6 MB

**Why this is a good test case:**
Small, fast-growing city in Snohomish County. Full budget book with narrative sections, charts, and department breakdowns. Tests handling of a longer document. Lake Stevens has rapidly grown from ~12K to ~45K residents in a decade, so the budget reflects infrastructure scaling challenges. Good stress test for the "what changed" and "who is affected" prompts.

**What a good civic brief should highlight:**
- Revenue sources (property tax, sales tax, utility taxes)
- Infrastructure and capital project spending
- Public safety staffing levels
- Parks and recreation investments
- How growth is being managed and funded
- Any new fees or rate changes

---

### 4. Renton 2025-2026 Budget Overview

**URL:** https://www.rentonwa.gov/files/assets/city/v/1/finance/budget-amp-accounting/documents/2025-2026-budget-overview-10.7.2024.pdf

**Type:** Budget Overview / Presentation
**Jurisdiction:** City of Renton, WA (pop. ~107,000)
**Estimated pages:** 20-30
**Estimated size:** 2-4 MB

**Why this is a good test case:**
Mid-size South King County city. Budget overview documents are presentation-style with charts, graphs, and bullet points rather than dense legal text. Tests whether the engine handles slide-deck-style PDFs well. Renton uses a "budgeting for outcomes" approach organized around six service areas, which maps well to civic summarization. $648M in spending, $645M in revenue, a near-balanced budget with interesting tension.

**What a good civic brief should highlight:**
- Six key service areas and spending allocation
- Revenue vs. expenditure gap (if any)
- Public safety investments
- Infrastructure and transportation priorities
- Community services and human services funding
- Any rate or fee changes affecting residents

---

## School Board Documents

### 5. Issaquah School District Board Minutes (October 9, 2025)

**URL:** https://resources.finalsite.net/images/v1760561543/issaquah/svjndvzshi8zqzskujuw/10-9-2025RegularBoardMeetingMinutesUnofficial.pdf

**Type:** Board Meeting Minutes with Resolution
**Jurisdiction:** Issaquah School District #411, WA (serves Issaquah, Sammamish, parts of Bellevue/Renton)
**Estimated pages:** 5-10
**Estimated size:** 200-500 KB

**Why this is a good test case:**
Contains Resolution #1249, authorizing levies for technology and critical facility repairs/improvements. Board minutes include vote counts, public comment summaries, and multiple agenda items. Tests the engine's ability to parse meeting minutes format and identify the most civically important actions. Directly relevant to the founder's home jurisdiction (Sammamish/Issaquah area).

**What a good civic brief should highlight:**
- Resolution #1249: what it authorizes, dollar amounts, what it funds
- Vote results (unanimous or contested)
- What "technology and critical repairs" means in practical terms (safety, security, equipment)
- Tax impact on property owners in the district
- Any other significant actions taken at this meeting
- Public comment topics if mentioned

---

### 6. Seattle Public Schools F-195 Budget (FY 2025-2026)

**URL:** https://www.seattleschools.org/wp-content/uploads/2025/11/Seattle-Public-Schools-F-195-Budget.pdf

**Type:** Official State Budget Form (F-195)
**Jurisdiction:** Seattle Public Schools, WA
**Estimated pages:** 20-40
**Estimated size:** 1-3 MB

**Why this is a good test case:**
The F-195 is the official Washington state budget certification form that all school districts must file. It is a structured financial document with enrollment data, revenue sources, and expenditure breakdowns. Tests whether the engine can parse tabular/form-style data. Context: Seattle Public Schools faced significant budget pressures and considered school closures, making this budget particularly impactful.

**What a good civic brief should highlight:**
- Total budget and per-pupil spending
- Enrollment trends (declining enrollment has been a major issue)
- Revenue breakdown (state funding, local levies, federal)
- Where spending is allocated (instruction, administration, transportation, maintenance)
- Any fund balance concerns or deficit indicators
- Staff-to-student ratios

---

## Resolutions

### 7. Yakima Levy Lid Lift Election Resolution (R-2025-109)

**URL:** https://legistarweb-production.s3.amazonaws.com/uploads/attachment/pdf/3461034/Yakima_2025_Levy_Lid_Lift_Election_Resolution.final.pdf

**Type:** City Council Resolution
**Jurisdiction:** City of Yakima, WA (pop. ~98,000)
**Estimated pages:** 3-6
**Estimated size:** 100-300 KB

**Why this is a good test case:**
Short, high-impact resolution that directly affects taxpayers. Proposes a $0.50/$1,000 property tax increase to cover a $6M budget deficit for public safety, streets, and parks. Tests the engine's ability to extract precise dollar amounts and explain the civic impact in plain language. Yakima has a ~50% Hispanic/Latino population, making this an ideal test for the Spanish-language translation feature. Includes exemptions for seniors and disabled veterans.

**What a good civic brief should highlight:**
- What the levy increase is: $0.50 per $1,000 assessed value
- What the new maximum rate would be: $2.46 per $1,000
- What services it funds: public safety, streets, parks
- Who is exempt: seniors, disabled veterans, people with disabilities
- Election date (November 4, 2025)
- Context: covers a $6M annual budget deficit
- How much a typical homeowner would pay additionally

---

## Zoning and Planning

### 8. Seattle: Updating Neighborhood Residential Zoning

**URL:** https://www.seattle.gov/documents/departments/opcd/seattleplan/updatingneighborhoodresidentialzoning.pdf

**Type:** Zoning Policy / Planning Document
**Jurisdiction:** City of Seattle, WA
**Estimated pages:** 10-20
**Estimated size:** 1-3 MB

**Why this is a good test case:**
Seattle overhauled its neighborhood residential zoning as part of the One Seattle Plan, implementing HB 1110 (which requires cities to allow duplexes, triplexes, and fourplexes in single-family zones). This document explains the changes in relatively accessible language with maps and diagrams. Tests the engine's ability to summarize zoning changes, which are among the most impactful but least understood local government actions. Effective January 21, 2026.

**What a good civic brief should highlight:**
- What types of housing are now allowed in formerly single-family zones
- How density limits changed (FAR, height, lot coverage)
- Where the changes apply (maps, neighborhood names)
- Affordable housing incentives included
- How this relates to state law (HB 1110 compliance)
- Impact on existing homeowners and potential new housing supply

---

### 9. Seattle One Seattle Plan Zoning Update FAQ

**URL:** https://www.seattle.gov/documents/Departments/OPCD/SeattlePlan/OneSeattlePlanZoningUpdateFAQ.pdf

**Type:** Zoning / Planning FAQ
**Jurisdiction:** City of Seattle, WA
**Estimated pages:** 8-15
**Estimated size:** 500 KB-1 MB

**Why this is a good test case:**
FAQ-format document about the comprehensive zoning overhaul. Already written in a question-and-answer format, making it a good benchmark for whether the engine can improve on or match human-written plain-language explanations. Tests whether the civic summarizer adds value when the source document is already somewhat accessible.

**What a good civic brief should highlight:**
- What the One Seattle Plan changes for residential zones
- Phase 1 vs. Phase 2 implementation timeline
- Centers and corridors vs. neighborhood residential changes
- How affordable housing requirements work
- What existing property owners need to know
- Relationship to state mandates (HB 1110)

---

## State Legislation

### 10. WA HB 1491: Transit-Oriented Housing Development (Bill Report)

**URL:** https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bill%20Reports/House/1491-S3%20HBR%20SA%2025.pdf

**Type:** Legislative Bill Report
**Jurisdiction:** Washington State Legislature
**Estimated pages:** 8-15
**Estimated size:** 200-500 KB

**Why this is a good test case:**
Major state housing legislation signed into law (Chapter 267, 2025). Requires cities to allow high-density development near transit stations. Bill reports from the Washington Legislature are structured documents with background, summary, analysis, and vote counts. Tests whether the engine can translate legislative analysis into civic impact. Directly affects every city with rail or bus rapid transit in Washington.

**What a good civic brief should highlight:**
- Density requirements: 3.5 FAR near rail stations, 2.5 FAR near BRT stops
- Parking reform: eliminates off-street parking requirements in station areas
- 20-year property tax exemption for affordable housing
- Which cities and transit systems are affected
- Vote count (passed Senate 30-18)
- Effective date (July 27, 2025)
- Impact on housing supply and transit ridership

---

### 11. WA HB 2266: Permanent Supportive Housing (Bill Text)

**URL:** https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bills/House%20Bills/2266-S.pdf

**Type:** Legislative Bill Text (Substitute)
**Jurisdiction:** Washington State Legislature
**Estimated pages:** 5-10
**Estimated size:** 150-400 KB

**Why this is a good test case:**
Bill text (not a report) in formal legislative language with section-and-clause structure. Requires cities to allow supportive housing in any zone where residential or hotels are permitted. Tests whether the engine can handle raw legislative text with strikethrough/underline formatting for amendments. Engrossed March 4, 2026; delivered to Governor March 12, 2026.

**What a good civic brief should highlight:**
- What the bill requires: cities cannot prohibit permanent supportive housing, transitional housing, or emergency shelters in residential/hotel zones
- What "permanent supportive housing" means in plain language
- Permitting restrictions it eliminates
- Which jurisdictions are affected (all cities in WA)
- How this changes the status quo for siting shelters and supportive housing
- Any exemptions or conditions

---

### 12. WA SB 6026: Residential Development in Commercial Zones (Bill Report)

**URL:** https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bill%20Reports/Senate/6026%20SBR%20WM%20TA%2026.pdf

**Type:** Legislative Bill Report (Senate Ways & Means)
**Jurisdiction:** Washington State Legislature
**Estimated pages:** 5-10
**Estimated size:** 200-400 KB

**Why this is a good test case:**
Governor Ferguson's housing agenda centerpiece. Requires mid-sized cities and urban counties to allow residential uses in commercial zones and limits ground-floor retail mandates. Bill report format with fiscal analysis. Tests the engine on a bill that crosses traditional zoning boundaries (commercial vs. residential) and has significant fiscal implications.

**What a good civic brief should highlight:**
- Core requirement: allow residential in commercial zones
- Which cities are affected (mid-sized cities, urban counties)
- 40% cap on ground-floor commercial requirements
- Fiscal impact on local governments
- Governor's housing agenda context
- How this could increase housing supply
- Timeline for local compliance

---

## Executive Orders

### 13. Seattle Executive Order 2026-02: Accelerate Housing and Shelter

**URL:** https://wilson.seattle.gov/wp-content/uploads/sites/43/2026/01/Executive-Order-202602-Accelerate-housing-and-shelter.pdf

**Type:** Executive Order
**Jurisdiction:** City of Seattle, WA
**Estimated pages:** 3-5
**Estimated size:** 100-300 KB

**Why this is a good test case:**
Short, directive document from Mayor Katie Wilson (took office January 2026). Orders city departments to identify property, streamline permitting, and partner with behavioral health providers to expand shelter capacity. Tests the engine on a brief, action-oriented document where every sentence matters. Demonstrates the tool's value for documents that are short but dense with policy implications.

**What a good civic brief should highlight:**
- Specific directives to city departments
- Interdepartmental team creation and mandate
- City-owned property to be identified for shelter/housing
- Behavioral health partnerships
- Permitting and policy changes being explored
- How this differs from previous administration's approach
- What residents should watch for (new shelter locations, policy changes)

---

## Capital Plans

### 14. Sammamish Capital Improvement Plan Summary 2026-2031

**URL:** https://www.sammamish.us/media/hg3m0cmz/cip-summary-2026-2031-nov-3-2025.pdf

**Type:** Capital Improvement Plan (CIP) Summary
**Jurisdiction:** City of Sammamish, WA (pop. ~67,000)
**Estimated pages:** 10-20
**Estimated size:** 1-3 MB

**Why this is a good test case:**
CIP documents describe multi-year infrastructure investments: roads, parks, utilities, public facilities. Sammamish is a bedroom community in the Eastside suburbs (directly relevant to the founder's locale). Tests whether the engine can extract specific project names, locations, timelines, and dollar amounts from a planning document. Good for the "where does the money go" civic question.

**What a good civic brief should highlight:**
- Total CIP spending over the 6-year period
- Largest individual projects (by dollar amount)
- Road and transportation projects (specific roads, intersections)
- Parks and recreation investments
- Utility infrastructure (water, sewer, stormwater)
- Funding sources (general fund, grants, bonds, impact fees)
- Project timelines and phasing

---

## Testing Notes

### Priority Order for Demo Testing

For the April 15 demo, test in this order:

1. **Yakima Levy Resolution (#7)** -- Short, high-impact, good Spanish translation test (50% Hispanic population)
2. **Seattle Executive Order (#13)** -- Short, current, demonstrates real-time civic intelligence
3. **Issaquah School Board Minutes (#5)** -- Local to founder, has resolution with vote count
4. **WA HB 1491 Bill Report (#10)** -- State legislation, structured format, housing impact
5. **Seattle Budget Summary (#1)** -- Large city budget, tests financial extraction
6. **Bellevue Budget Ordinance (#2)** -- Legal language, tests formal document parsing
7. **Seattle Zoning Update (#8)** -- Complex planning document, maps and policy

### Test Matrix

| Document | English | Spanish | Financial Data | Vote Counts | Legal Language | Maps/Charts |
|----------|---------|---------|---------------|-------------|---------------|-------------|
| #1 Seattle Budget | X | | X | | | X |
| #2 Bellevue Budget Ord. | X | | X | | X | |
| #3 Lake Stevens Budget | X | | X | | | X |
| #4 Renton Budget | X | | X | | | X |
| #5 Issaquah Minutes | X | | | X | | |
| #6 SPS F-195 | X | | X | | | |
| #7 Yakima Levy | X | X | X | | X | |
| #8 Seattle Zoning | X | X | | | | X |
| #9 Seattle Zoning FAQ | X | X | | | | |
| #10 HB 1491 | X | X | | X | X | |
| #11 HB 2266 | X | | | | X | |
| #12 SB 6026 | X | | X | | X | |
| #13 Seattle EO | X | X | | | | |
| #14 Sammamish CIP | X | | X | | | |

### Spanish Translation Priority

Documents #7, #8, #9, #10, and #13 are the best candidates for Spanish translation testing:
- **#7 (Yakima Levy):** Yakima is ~50% Hispanic/Latino. A levy resolution directly affects every taxpayer. This is the single best document to showcase the Spanish translation feature for Mozilla reviewers.
- **#10 (HB 1491):** Transit-oriented housing affects communities statewide, including areas with large Spanish-speaking populations.
- **#13 (Seattle EO):** Homelessness policy affects all Seattle residents; the city has a growing Spanish-speaking population.
- **#8 and #9 (Zoning):** Zoning changes affect housing availability and costs for all residents.

### Expected Challenges

- **Tabular data (#3, #6):** Budget books and F-195 forms have dense tables. The PDF extraction library may struggle with column alignment.
- **Charts and maps (#1, #4, #8):** These contain visual elements that PDF text extraction will miss. The civic brief should still be useful from text alone, but won't capture everything.
- **Legal language (#2, #11):** Ordinances and bill text use formal legislative structure. The summarizer should translate this into plain English.
- **Long documents (#3):** The Lake Stevens budget book may be 100+ pages. Test whether the 10MB file size limit and processing timeout (300s on Vercel Fluid Compute) are sufficient.

### URL Verification

All URLs were verified as of March 16, 2026, to point to government-hosted PDFs. Government websites occasionally reorganize their document archives. If a URL breaks:
- Check the parent page (linked in each entry's search context)
- Search the jurisdiction's document center for the document title
- MRSC (mrsc.org) archives many Washington municipal documents
- Washington Legislature documents are stable at lawfilesext.leg.wa.gov

### Jurisdictions Covered

| State | Jurisdiction | Type | Population |
|-------|-------------|------|-----------|
| WA | Seattle | City | ~750,000 |
| WA | Bellevue | City | ~155,000 |
| WA | Renton | City | ~107,000 |
| WA | Yakima | City | ~98,000 |
| WA | Sammamish | City | ~67,000 |
| WA | Lake Stevens | City | ~45,000 |
| WA | Issaquah (school district) | School District | ~40,000 |
| WA | Washington State | State | ~7,900,000 |

12 of 14 documents are from Washington state (matching the founder's base and the demo jurisdiction seeds in the database). The mix covers small cities (Lake Stevens, 45K), mid-size cities (Renton, Yakima, Bellevue), and a major city (Seattle), plus state-level legislation and a school district.
