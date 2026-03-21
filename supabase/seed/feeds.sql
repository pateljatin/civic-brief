-- Seed: Demo feed registrations for WA state hierarchy
--
-- These 5 feeds cover the demo jurisdiction tree seeded in demo-jurisdictions.sql.
-- Jurisdiction IDs match the fixed UUIDs from that seed file:
--   00000000-0000-0000-0000-000000000002  Washington State
--   00000000-0000-0000-0000-000000000003  King County
--   00000000-0000-0000-0000-000000000004  Seattle
--
-- Document type IDs (from document-types.sql insert order):
--   2  legislation
--   6  notice
--   9  plan
--
-- To apply: run after 005_feed_ingestion_and_user_infra.sql migration
-- and after demo-jurisdictions.sql + document-types.sql seeds.

insert into feeds (jurisdiction_id, document_type_id, name, feed_url, feed_type, expected_domain) values

  -- 1. Seattle City Council via Legistar
  (
    '00000000-0000-0000-0000-000000000004',
    2,
    'Seattle City Council Legislation',
    'https://legistar.council.seattle.gov/MainBody.aspx',
    'legistar',
    'legistar.council.seattle.gov'
  ),

  -- 2. King County Council via Legistar
  (
    '00000000-0000-0000-0000-000000000003',
    2,
    'King County Council Legislation',
    'https://kingcounty.legistar.com/MainBody.aspx',
    'legistar',
    'kingcounty.legistar.com'
  ),

  -- 3. Washington State Legislature via OpenStates JSON API
  (
    '00000000-0000-0000-0000-000000000002',
    2,
    'WA State Legislature (OpenStates)',
    'https://v3.openstates.org/bills?jurisdiction=ocd-division/country:us/state:wa&per_page=10',
    'json_api',
    'v3.openstates.org'
  ),

  -- 4. Seattle.gov news/plan RSS
  (
    '00000000-0000-0000-0000-000000000004',
    9,
    'Seattle.gov News RSS',
    'https://www.seattle.gov/news/rss',
    'rss',
    'www.seattle.gov'
  ),

  -- 5. WA Governor official news RSS
  (
    '00000000-0000-0000-0000-000000000002',
    6,
    'WA Governor News RSS',
    'https://www.governor.wa.gov/news-media/rss',
    'rss',
    'www.governor.wa.gov'
  )

on conflict (feed_url) do nothing;
