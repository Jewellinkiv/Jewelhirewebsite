-- Default assessment library, matching lib/local-admin-store (GemMatch core +
-- the 3 migrated legacy tests). Idempotent. created_at ordered so GemMatch
-- leads and the legacy tests follow (list is ordered created_at desc).

insert into admin_assessment_defaults (id, name, kind, scope, status, questions, note, origin, created_at, updated_at)
values
  ('gemmatch', 'GemMatch Personality Assessment', 'Trait profile', 'All plans', 'Published', 48,
   'The core pick-10 profile. Default for every company.', 'builtin',
   '2026-06-04T12:00:00.000Z', '2026-06-04T12:00:00.000Z'),
  ('legacy-12-essentials', '12 Essentials: Understanding your potential', 'Trait profile', 'All plans', 'Published', 36,
   'Keep as legacy comparison data; consider folding into JewelCert coaching notes.', 'legacy',
   '2026-06-03T12:00:00.000Z', '2026-06-03T12:00:00.000Z'),
  ('legacy-sales-personality', 'Sales Personality Profiling Test', 'Trait profile', 'All plans', 'Published', 24,
   'Use as a bridge from legacy sales traits to the new JewelCert profile language.', 'legacy',
   '2026-06-02T12:00:00.000Z', '2026-06-02T12:00:00.000Z'),
  ('legacy-jewelry-knowledge', 'Jewelry Basic Knowledge Assessment', 'Knowledge check', 'All plans', 'Published', 22,
   'Seed as an answer-key knowledge check with category scoring and training recommendations.', 'legacy',
   '2026-06-01T12:00:00.000Z', '2026-06-01T12:00:00.000Z')
on conflict (id) do update set
  name = excluded.name,
  kind = excluded.kind,
  scope = excluded.scope,
  status = excluded.status,
  questions = excluded.questions,
  note = excluded.note,
  origin = excluded.origin,
  updated_at = excluded.updated_at;
