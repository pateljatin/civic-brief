/**
 * Domain-to-Jurisdiction Lookup
 *
 * Maps known government website domains to jurisdiction UUIDs.
 * Used to auto-suggest jurisdiction when a user provides a source URL.
 */

// Seed jurisdiction UUIDs from demo-jurisdictions.sql and 008_showcase_jurisdictions.sql
const JURISDICTION_IDS = {
  US: '00000000-0000-0000-0000-000000000001',
  WA: '00000000-0000-0000-0000-000000000002',
  KING_COUNTY: '00000000-0000-0000-0000-000000000003',
  SEATTLE: '00000000-0000-0000-0000-000000000004',
  SAMMAMISH: '00000000-0000-0000-0000-000000000005',
  ISSAQUAH: '00000000-0000-0000-0000-000000000006',
  PA: '00000000-0000-0000-0000-000000000010',
  GA: '00000000-0000-0000-0000-000000000011',
  NY: '00000000-0000-0000-0000-000000000012',
  CA: '00000000-0000-0000-0000-000000000013',
  PHILADELPHIA: '00000000-0000-0000-0000-000000000020',
  ATLANTA: '00000000-0000-0000-0000-000000000021',
  NYC: '00000000-0000-0000-0000-000000000022',
} as const;

/**
 * Map of normalized domains to jurisdiction IDs.
 * Add entries as new jurisdictions are seeded.
 */
const DOMAIN_MAP: Record<string, string> = {
  // Federal
  'congress.gov': JURISDICTION_IDS.US,
  'whitehouse.gov': JURISDICTION_IDS.US,
  'govinfo.gov': JURISDICTION_IDS.US,
  'gao.gov': JURISDICTION_IDS.US,
  'federalregister.gov': JURISDICTION_IDS.US,

  // Washington State
  'wa.gov': JURISDICTION_IDS.WA,
  'leg.wa.gov': JURISDICTION_IDS.WA,
  'governor.wa.gov': JURISDICTION_IDS.WA,

  // King County
  'kingcounty.gov': JURISDICTION_IDS.KING_COUNTY,

  // Cities - WA
  'seattle.gov': JURISDICTION_IDS.SEATTLE,
  'sammamish.us': JURISDICTION_IDS.SAMMAMISH,
  'issaquahwa.gov': JURISDICTION_IDS.ISSAQUAH,

  // Pennsylvania
  'pa.gov': JURISDICTION_IDS.PA,

  // Georgia
  'ga.gov': JURISDICTION_IDS.GA,
  'atlantaga.gov': JURISDICTION_IDS.ATLANTA,

  // New York
  'ny.gov': JURISDICTION_IDS.NY,
  'nyc.gov': JURISDICTION_IDS.NYC,
  'council.nyc.gov': JURISDICTION_IDS.NYC,

  // California
  'ca.gov': JURISDICTION_IDS.CA,

  // Philadelphia
  'phila.gov': JURISDICTION_IDS.PHILADELPHIA,
};

/**
 * Extract and normalize the domain from a URL.
 * Strips 'www.' prefix and converts to lowercase.
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Look up a jurisdiction ID from a source URL's domain.
 * Tries exact match first, then walks up subdomains.
 * Returns null if no mapping exists.
 */
export function lookupJurisdictionByDomain(url: string): string | null {
  const domain = extractDomain(url);
  if (!domain) return null;

  // Exact match
  if (DOMAIN_MAP[domain]) return DOMAIN_MAP[domain];

  // Walk up subdomains: council.nyc.gov -> nyc.gov -> gov
  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (DOMAIN_MAP[parent]) return DOMAIN_MAP[parent];
  }

  return null;
}
