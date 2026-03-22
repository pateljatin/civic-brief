// ─── Scenario Showcase ───
// Static configuration for the five demo scenarios shown on the homepage.
// briefId is null until a real document is sourced and processed.

export interface ScenarioConfig {
  slug: string;
  title: string;
  icon: string;
  color: string;
  jurisdiction: string;
  narrative: string;
  story: string;
  documentTitle: string;
  briefId: string | null;
  sourceUrl: string;
}

export const scenarios: ScenarioConfig[] = [
  {
    slug: 'budget',
    title: 'Budget Season',
    icon: '💰',
    color: '#1a2332',
    jurisdiction: 'King County / Seattle, WA',
    narrative:
      "The city just released a 400-page budget. Your library hours, your bus route, your park maintenance — it's all in there, if you can find it.",
    story:
      "Every fall, Seattle and King County publish proposed budgets that determine what gets funded and what gets cut. Most residents never read them — not because they don't care, but because a 400-page PDF written in government accounting language is genuinely hard to parse. This brief pulls out what changed year over year, which departments gained or lost funding, and what the trade-offs mean for people who live here. Public comment is open for two weeks after release. Most people miss it.",
    documentTitle: 'Seattle 2025-2026 Proposed Budget',
    briefId: null,
    sourceUrl: 'https://www.seattle.gov/city-budget',
  },
  {
    slug: 'school-board',
    title: 'School Board',
    icon: '🏫',
    color: '#2a1f1f',
    jurisdiction: 'Issaquah, WA',
    narrative:
      'The Issaquah School Board is voting on a new attendance policy next Tuesday. If you have kids in the district, this affects you.',
    story:
      "School board meetings happen every few weeks, and the agenda is usually posted 72 hours before the meeting — not exactly prime time for busy families to notice. This scenario shows how a Civic Brief turns a dense meeting agenda into a clear summary: what motions are on the table, which policy is changing, how it compares to current rules, and whether public comment is open. The board serves roughly 20,000 students across Issaquah, Sammamish, and Bellevue. Most decisions are made with fewer than ten people in the room.",
    documentTitle: 'Issaquah School District Board Meeting Agenda',
    briefId: null,
    sourceUrl: 'https://www.issaquah.wednet.edu/district/board/meetings',
  },
  {
    slug: 'zoning',
    title: 'Zoning Change',
    icon: '🏗️',
    color: '#1f2a1f',
    jurisdiction: 'Sammamish, WA',
    narrative:
      "A rezoning proposal would allow four-story buildings on a street that's been single-family for 40 years. The hearing is in three weeks.",
    story:
      "Zoning decisions shape neighborhoods for decades, but the documents that describe them — rezoning applications, staff reports, SEPA checklists — are written for land use attorneys, not residents. This scenario walks through a real rezoning proposal in Sammamish: what the applicant wants to build, what current zoning allows, what the city staff recommends, and what neighbors can do before the decision is final. The public comment window is usually 14 days. After that, the decision goes to the hearing examiner and the window closes.",
    documentTitle: 'Sammamish Rezone Application — Eastlake Corridor',
    briefId: null,
    sourceUrl: 'https://www.sammamish.us/government/departments/community-development/planning/',
  },
  {
    slug: 'legislation',
    title: 'State Legislation',
    icon: '📜',
    color: '#2a2a1f',
    jurisdiction: 'Washington State',
    narrative:
      'A bill moving through Olympia would change how landlords can raise rent in Washington. It passed committee last week.',
    story:
      "State legislation affects millions of people, but the path from bill introduction to governor signature is hard to follow unless you're watching closely. Bills get amended in committee, referred to different chambers, and voted on multiple times under new numbers. This brief tracks a housing-related bill through the Washington State Legislature: what the original text said, what changed in committee, who voted which way, and what the final version actually does. If you rent in Washington, this is the kind of document that can change your monthly payment — and most renters never hear about it until it's law.",
    documentTitle: 'WA HB 1217 — Residential Rent Stabilization Act',
    briefId: null,
    sourceUrl: 'https://app.leg.wa.gov/billsummary',
  },
  {
    slug: 'health-insurance',
    title: 'Health Insurance & Rx Costs',
    icon: '🏥',
    color: '#1f1f2a',
    jurisdiction: 'US Federal / California',
    narrative:
      "A federal rule change could affect how much you pay for prescription drugs. The comment period closes in 30 days, and almost no one is commenting.",
    story:
      "Federal regulatory changes to Medicare and Medicaid drug pricing affect what every American pays at the pharmacy, but the notices appear in the Federal Register in dense regulatory prose with a 30-day comment window. Most of those comment periods expire with fewer than 100 public comments. This scenario shows what Civic Brief does with a proposed rule: it extracts the specific drugs affected, the estimated cost impact per patient, which populations bear the most risk, and exactly how to submit a comment before the deadline. One comment from an affected patient carries real weight in the administrative record. This is how you participate.",
    documentTitle: 'CMS Proposed Rule — Medicare Part D Drug Price Negotiation',
    briefId: null,
    sourceUrl: 'https://www.federalregister.gov/agencies/centers-for-medicare-medicaid-services',
  },
];

export function getScenarioBySlug(slug: string): ScenarioConfig | undefined {
  return scenarios.find((s) => s.slug === slug);
}
