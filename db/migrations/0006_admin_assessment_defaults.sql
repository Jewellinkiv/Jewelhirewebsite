-- Admin-created default assessments (the platform library every store builds
-- on: JewelCert + the migrated legacy tests + any admin-authored defaults).
-- Distinct from `assessments` (0001), which holds store-created custom ones.

create table if not exists admin_assessment_defaults (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('Trait profile', 'Aptitude', 'Knowledge check')),
  scope text not null default 'All plans',
  status text not null default 'Draft' check (status in ('Published', 'Draft')),
  questions integer not null default 0 check (questions >= 0),
  note text not null default '',
  origin text not null default 'custom' check (origin in ('builtin', 'legacy', 'custom')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_assessment_defaults_origin_idx on admin_assessment_defaults (origin, created_at desc);
