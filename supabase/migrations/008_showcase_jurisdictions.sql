-- Migration 008: Add jurisdictions for showcase documents
-- Geographic diversity: Philadelphia, Atlanta, NYC, California, Federal

-- States
insert into jurisdictions (id, parent_id, level_id, country_id, name, slug, timezone)
values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 2, 1, 'Pennsylvania', 'pennsylvania', 'America/New_York'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 2, 1, 'Georgia', 'georgia', 'America/New_York'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 2, 1, 'New York', 'new-york', 'America/New_York'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 2, 1, 'California', 'california', 'America/Los_Angeles')
on conflict (id) do nothing;

-- Cities
insert into jurisdictions (id, parent_id, level_id, country_id, name, slug, timezone, population)
values
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', 4, 1, 'Philadelphia', 'philadelphia', 'America/New_York', 1603797),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000011', 4, 1, 'Atlanta', 'atlanta', 'America/New_York', 499127),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000012', 4, 1, 'New York City', 'new-york-city', 'America/New_York', 8258035)
on conflict (id) do nothing;
