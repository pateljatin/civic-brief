-- Seed: Civic topic taxonomy
insert into topics (slug, name, description) values
  ('budget', 'Budget & Finance', 'Government budgets, taxes, spending, and financial decisions'),
  ('education', 'Education', 'Schools, school boards, education policy'),
  ('housing', 'Housing & Zoning', 'Zoning changes, housing policy, development'),
  ('infrastructure', 'Infrastructure', 'Roads, utilities, public works, transportation'),
  ('public-safety', 'Public Safety', 'Police, fire, emergency services'),
  ('health', 'Health & Environment', 'Public health, environmental policy, parks'),
  ('governance', 'Governance', 'Elections, council decisions, administrative changes'),
  ('social-services', 'Social Services', 'Social programs, community services, equity')
on conflict (slug) do nothing;

-- Subtopics
insert into topics (parent_id, slug, name, description) values
  ((select id from topics where slug = 'budget'), 'property-tax', 'Property Tax', 'Property tax rates and assessments'),
  ((select id from topics where slug = 'budget'), 'contracts', 'Contracts & Procurement', 'Government contracts and vendor selection'),
  ((select id from topics where slug = 'education'), 'school-board', 'School Board', 'School board decisions and meetings'),
  ((select id from topics where slug = 'housing'), 'zoning', 'Zoning Changes', 'Rezoning applications and amendments'),
  ((select id from topics where slug = 'housing'), 'development', 'Development', 'New development projects and permits'),
  ((select id from topics where slug = 'infrastructure'), 'transportation', 'Transportation', 'Transit, roads, bike lanes'),
  ((select id from topics where slug = 'governance'), 'elections', 'Elections', 'Election results, ballot measures, candidates')
on conflict (slug) do nothing;
