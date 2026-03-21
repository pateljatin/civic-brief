/** Valid RSS 2.0 feed with one PDF item */
export const MOCK_RSS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Seattle City Council</title>
    <link>https://seattle.gov/council</link>
    <item>
      <title>Resolution 32145</title>
      <link>https://seattle.gov/docs/resolution-32145.pdf</link>
      <guid>res-32145</guid>
      <pubDate>Thu, 21 Mar 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

/** Valid Atom feed with one entry */
export const MOCK_ATOM_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>King County Legislature</title>
  <link href="https://kingcounty.gov/council"/>
  <entry>
    <title>Ordinance 19876</title>
    <link href="https://kingcounty.gov/docs/ordinance-19876.pdf"/>
    <id>ord-19876</id>
    <updated>2026-03-21T00:00:00Z</updated>
  </entry>
</feed>`;

/** RSS feed with non-PDF items */
export const MOCK_RSS_MIXED_FORMATS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Seattle News</title>
    <item>
      <title>Budget Report</title>
      <link>https://seattle.gov/budget.pdf</link>
      <guid>budget-2026</guid>
    </item>
    <item>
      <title>Council Agenda</title>
      <link>https://seattle.gov/agenda.docx</link>
      <guid>agenda-0321</guid>
    </item>
    <item>
      <title>Meeting Minutes</title>
      <link>https://seattle.gov/minutes.html</link>
      <guid>minutes-0321</guid>
    </item>
  </channel>
</rss>`;

/** XXE attack payload */
export const MOCK_RSS_XXE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE rss [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<rss version="2.0">
  <channel>
    <title>&xxe;</title>
    <item>
      <title>Test</title>
      <link>https://evil.com/doc.pdf</link>
      <guid>xxe-test</guid>
    </item>
  </channel>
</rss>`;

/** XML bomb (billion laughs) */
export const MOCK_RSS_XML_BOMB = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE rss [
  <!ENTITY a "aaaaaaaaaa">
  <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">
  <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">
  <!ENTITY d "&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;">
]>
<rss version="2.0">
  <channel><title>&d;</title></channel>
</rss>`;

/** Legistar API matters response */
export function mockLegistarMattersResponse(count = 2) {
  return Array.from({ length: count }, (_, i) => ({
    MatterId: 1000 + i,
    MatterGuid: `matter-guid-${i}`,
    MatterTitle: `Ordinance ${2026100 + i}`,
    MatterLastModifiedUtc: new Date().toISOString(),
    MatterTypeName: 'Ordinance',
  }));
}

/** Legistar API attachments response */
export function mockLegistarAttachmentsResponse(matterId: number) {
  return [
    {
      MatterAttachmentId: matterId * 10,
      MatterAttachmentName: `Ordinance_${matterId}.pdf`,
      MatterAttachmentHyperlink: `https://seattle.legistar.com/docs/Ordinance_${matterId}.pdf`,
      MatterAttachmentMatterVersion: 1,
    },
  ];
}

/** OpenStates API bills response */
export function mockOpenStatesResponse(count = 2) {
  return {
    results: Array.from({ length: count }, (_, i) => ({
      id: `ocd-bill/wa-${i}`,
      identifier: `HB ${1000 + i}`,
      title: `An act relating to civic transparency ${i}`,
      updated_at: new Date().toISOString(),
      texts: [
        {
          url: `https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bills/HB${1000 + i}.pdf`,
          media_type: 'application/pdf',
          note: 'As Introduced',
        },
      ],
    })),
    pagination: { total_items: count, page: 1, max_page: 1 },
  };
}
