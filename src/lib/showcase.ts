// ─── Scenario Showcase ───
// Five real government documents from across the country, processed through
// the Civic Brief pipeline. Each demonstrates a different type of civic
// document that affects people's daily lives.

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
    jurisdiction: 'Philadelphia, PA',
    narrative:
      'Philadelphia just proposed a $6.7 billion budget with tax cuts and a plan to build 30,000 housing units. But there is a $421 million deficit projected by 2029.',
    story:
      "Mayor Cherelle Parker, Philadelphia's first Black woman mayor, proposed a $6.74 billion budget built around five priorities: safer communities, cleaner neighborhoods, economic opportunity, housing, and education. Homicides are down 37%. There is a nurse in every school. The H.O.M.E. Initiative aims to create or preserve 30,000 housing units. But the 120-page document also reveals a structural deficit growing to $421 million by FY2029, driven by rising pension and healthcare costs. Most Philadelphians will never read this document. The ones who do will understand where their tax dollars are going, and where the city is making bets it might not be able to afford.",
    documentTitle: 'Philadelphia FY2026 Budget in Brief (Proposed)',
    briefId: 'bf915fc2-413a-43cc-8d7c-d8112fb415ff',
    sourceUrl: 'https://phlcouncil.com/wp-content/uploads/2025/03/budget-in-brief-FY2026-proposed.pdf',
  },
  {
    slug: 'school-board',
    title: 'School Closures',
    icon: '🏫',
    color: '#2a1f1f',
    jurisdiction: 'Atlanta, GA',
    narrative:
      'Atlanta Public Schools voted unanimously to close 16 schools. If your child attends one of them, you have months to figure out where they go next.',
    story:
      "Atlanta Public Schools has 70,000 seats for 50,000 students. That gap costs the district $20-25 million a year in maintenance for buildings that are half empty. In October 2025, the district recommended closing or repurposing 16 schools, mostly elementary, with closures phased between spring 2027 and 2028. The board voted unanimously to approve in December. The 17-page presentation includes maps of every affected zone, dollar figures for each school, and boundary realignment plans. For parents, this is the document that tells them their child's school is closing. Most families found out through word of mouth, not by reading the facilities report.",
    documentTitle: 'APS 2040 Facility Recommendations',
    briefId: 'a723a4e0-e116-4e9f-b251-fdb18cd15503',
    sourceUrl: 'https://resources.finalsite.net/images/v1764550118/atlantapublicschoolsus/k7erwodvjiymjzh0wlqy/APS_Recommendations_Oct28_v3.pdf',
  },
  {
    slug: 'zoning',
    title: 'Zoning Change',
    icon: '🏗️',
    color: '#1f2a1f',
    jurisdiction: 'Brooklyn, New York City',
    narrative:
      "NYC passed its most ambitious zoning reform in decades. Five of eight Brooklyn community boards voted against it. The Borough President approved it anyway, with conditions.",
    story:
      "The City of Yes for Housing Opportunity is New York City's plan to allow 82,000 new homes across all 59 community districts. The Brooklyn Borough President's 20-page review explains why neighborhoods are fighting it: fears of displacement, inadequate affordability requirements, loss of neighborhood character. But it also makes the case for approval, arguing that the housing crisis demands action. The document names specific neighborhoods, Park Slope, Flatbush, Crown Heights, and explains what changes in each. It discusses parking mandates, accessory dwelling units, transit-oriented development, and the tension between building more housing and keeping it affordable. This is what democracy looks like when it gets complicated.",
    documentTitle: 'City of Yes for Housing Opportunity: Brooklyn Borough President Review',
    briefId: 'c0502aa2-ba75-475d-82a1-9b6a152a46e9',
    sourceUrl: 'https://www.brooklynbp.nyc.gov/wp-content/uploads/2024/09/City-of-Yes-for-Housing-Opportunity-N240290ZRY.pdf',
  },
  {
    slug: 'legislation',
    title: 'Insulin Costs',
    icon: '💊',
    color: '#2a2a1f',
    jurisdiction: 'California',
    narrative:
      'California capped insulin copays at $35 a month. 3.2 million Californians have diabetes. Most of them do not know this law exists.',
    story:
      "Before SB 40, insulin copays in California could hit $300 to $500 a month. People rationed a drug they need to survive. The bill, signed into law in October 2025, caps copays at $35 and bans step therapy requirements that forced patients to try cheaper alternatives first. But the actual legislative analysis is a 62-page document full of actuarial tables, Health and Safety Code references, and implementation timelines split across different plan types. A person with diabetes cannot read this document and understand whether they are covered, when the cap takes effect for their plan, or what to do if their insurer does not comply. That is exactly the gap this brief fills.",
    documentTitle: 'California SB 40: Insulin Cost-Sharing and Step Therapy (CHBRP Analysis)',
    briefId: 'f369d484-2c7f-4fb3-a0db-2fc4cd8936a9',
    sourceUrl: 'https://www.chbrp.org/sites/default/files/bill-documents/SB40/SB%2040%20Insulin_March%2015%202025_Final.pdf',
  },
  {
    slug: 'drug-pricing',
    title: 'Medicare Drug Pricing',
    icon: '🏥',
    color: '#1f1f2a',
    jurisdiction: 'US Federal',
    narrative:
      'The federal government proposed using international drug prices to lower what Medicare pays. The comment period is open, and almost no one is commenting.',
    story:
      "The GUARD Model is a proposed rule from the Centers for Medicare and Medicaid Services that would use international reference pricing to lower Medicare drug costs. It is 92 pages of regulatory prose published in the Federal Register, and it could change what every Medicare beneficiary pays at the pharmacy. The document describes a pricing formula based on what other countries pay, implementation timelines, affected drug categories, and the comment process. Most of those comment periods expire with fewer than 100 public comments, even though the rule affects over 50 million people. One comment from an affected patient carries real weight in the administrative record. This is how you participate in federal rulemaking.",
    documentTitle: 'CMS GUARD Model: Guarding U.S. Medicare Against Rising Drug Costs',
    briefId: '0b20525c-d722-4821-9373-cfd15d3577f3',
    sourceUrl: 'https://www.govinfo.gov/content/pkg/FR-2025-12-23/pdf/2025-23705.pdf',
  },
];

export function getScenarioBySlug(slug: string): ScenarioConfig | undefined {
  return scenarios.find((s) => s.slug === slug);
}
