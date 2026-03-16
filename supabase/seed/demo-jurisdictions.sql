-- Seed: Jurisdiction levels for US
insert into jurisdiction_levels (country_id, slug, name, depth) values
  ((select id from countries where iso_alpha2 = 'US'), 'federal', 'Federal', 0),
  ((select id from countries where iso_alpha2 = 'US'), 'state', 'State', 1),
  ((select id from countries where iso_alpha2 = 'US'), 'county', 'County', 2),
  ((select id from countries where iso_alpha2 = 'US'), 'city', 'City', 3),
  ((select id from countries where iso_alpha2 = 'US'), 'township', 'Township', 3),
  ((select id from countries where iso_alpha2 = 'US'), 'village', 'Village', 3),
  ((select id from countries where iso_alpha2 = 'US'), 'special_district', 'Special District', 4)
on conflict (country_id, slug) do nothing;

-- Seed: Demo jurisdictions (WA state hierarchy)
-- Federal
insert into jurisdictions (id, parent_id, level_id, country_id, name, slug, ocd_id, fips_code, population, timezone, website_url) values
  ('00000000-0000-0000-0000-000000000001', null,
   (select id from jurisdiction_levels where slug = 'federal' and country_id = (select id from countries where iso_alpha2 = 'US')),
   (select id from countries where iso_alpha2 = 'US'),
   'United States', 'united-states', 'ocd-division/country:us', null, 331900000, 'America/New_York', 'https://www.usa.gov')
on conflict (id) do nothing;

-- Washington State
insert into jurisdictions (id, parent_id, level_id, country_id, name, slug, ocd_id, fips_code, population, timezone, website_url) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   (select id from jurisdiction_levels where slug = 'state' and country_id = (select id from countries where iso_alpha2 = 'US')),
   (select id from countries where iso_alpha2 = 'US'),
   'Washington', 'washington', 'ocd-division/country:us/state:wa', '53', 7785786, 'America/Los_Angeles', 'https://wa.gov')
on conflict (id) do nothing;

-- King County
insert into jurisdictions (id, parent_id, level_id, country_id, name, slug, ocd_id, fips_code, population, timezone, website_url) values
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002',
   (select id from jurisdiction_levels where slug = 'county' and country_id = (select id from countries where iso_alpha2 = 'US')),
   (select id from countries where iso_alpha2 = 'US'),
   'King County', 'king-county', 'ocd-division/country:us/state:wa/county:king', '53033', 2269675, 'America/Los_Angeles', 'https://kingcounty.gov')
on conflict (id) do nothing;

-- Seattle
insert into jurisdictions (id, parent_id, level_id, country_id, name, slug, ocd_id, fips_code, population, timezone, website_url) values
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003',
   (select id from jurisdiction_levels where slug = 'city' and country_id = (select id from countries where iso_alpha2 = 'US')),
   (select id from countries where iso_alpha2 = 'US'),
   'Seattle', 'seattle', 'ocd-division/country:us/state:wa/place:seattle', '5363000', 749256, 'America/Los_Angeles', 'https://seattle.gov')
on conflict (id) do nothing;

-- Sammamish
insert into jurisdictions (id, parent_id, level_id, country_id, name, slug, ocd_id, fips_code, population, timezone, website_url) values
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003',
   (select id from jurisdiction_levels where slug = 'city' and country_id = (select id from countries where iso_alpha2 = 'US')),
   (select id from countries where iso_alpha2 = 'US'),
   'Sammamish', 'sammamish', 'ocd-division/country:us/state:wa/place:sammamish', '5361545', 65892, 'America/Los_Angeles', 'https://www.sammamish.us')
on conflict (id) do nothing;

-- Issaquah
insert into jurisdictions (id, parent_id, level_id, country_id, name, slug, ocd_id, fips_code, population, timezone, website_url) values
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003',
   (select id from jurisdiction_levels where slug = 'city' and country_id = (select id from countries where iso_alpha2 = 'US')),
   (select id from countries where iso_alpha2 = 'US'),
   'Issaquah', 'issaquah', 'ocd-division/country:us/state:wa/place:issaquah', '5334825', 40051, 'America/Los_Angeles', 'https://www.issaquahwa.gov')
on conflict (id) do nothing;
