-- Seed: Supported languages
insert into languages (bcp47, name, native_name, pg_config) values
  ('en', 'English', 'English', 'english'),
  ('es', 'Spanish', 'Espanol', 'spanish'),
  ('hi', 'Hindi', 'Hindi', 'simple')
on conflict (bcp47) do nothing;

-- Link languages to demo jurisdictions
-- King County serves English and Spanish
insert into jurisdiction_languages (jurisdiction_id, language_id, is_primary)
select
  '00000000-0000-0000-0000-000000000003'::uuid,
  l.id,
  l.bcp47 = 'en'
from languages l
where l.bcp47 in ('en', 'es')
on conflict do nothing;

-- Seattle serves English and Spanish
insert into jurisdiction_languages (jurisdiction_id, language_id, is_primary)
select
  '00000000-0000-0000-0000-000000000004'::uuid,
  l.id,
  l.bcp47 = 'en'
from languages l
where l.bcp47 in ('en', 'es')
on conflict do nothing;

-- Sammamish: English and Hindi (significant South Asian population)
insert into jurisdiction_languages (jurisdiction_id, language_id, is_primary)
select
  '00000000-0000-0000-0000-000000000005'::uuid,
  l.id,
  l.bcp47 = 'en'
from languages l
where l.bcp47 in ('en', 'hi')
on conflict do nothing;
