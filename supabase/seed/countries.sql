-- Seed: Countries (US only for demo, expand as needed)
insert into countries (iso_alpha2, iso_alpha3, iso_numeric, name, official_name, identifier_system) values
  ('US', 'USA', '840', 'United States', 'United States of America', 'fips')
on conflict (iso_alpha2) do nothing;
