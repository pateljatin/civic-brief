-- Seed: Document types
insert into document_types (slug, name, description) values
  ('budget', 'Budget', 'Annual or proposed government budgets'),
  ('legislation', 'Legislation', 'Bills, acts, and proposed laws'),
  ('minutes', 'Meeting Minutes', 'Records of government meetings'),
  ('ordinance', 'Ordinance', 'Local laws enacted by city/county'),
  ('resolution', 'Resolution', 'Formal decisions by a governing body'),
  ('notice', 'Public Notice', 'Official notifications to the public'),
  ('agenda', 'Agenda', 'Upcoming meeting agendas'),
  ('report', 'Report', 'Government reports, audits, and studies'),
  ('plan', 'Plan', 'Comprehensive plans, strategic plans'),
  ('contract', 'Contract', 'Government contracts and agreements'),
  ('policy', 'Policy', 'Government policy documents')
on conflict (slug) do nothing;
