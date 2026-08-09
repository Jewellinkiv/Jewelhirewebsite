-- A public role can now target every store location or a selected set. Keep
-- the legacy `location` text for backwards-compatible display and exports.
alter table public_jobs
  add column if not exists location_scope text not null default 'selected'
    check (location_scope in ('all', 'selected')),
  add column if not exists location_ids jsonb not null default '[]'::jsonb;

-- Backfill exact legacy single-location matches where possible. Jobs whose
-- historic label cannot be matched remain selectable as legacy single-site
-- roles until an operator updates them in the new editor.
update public_jobs pj
set location_ids = coalesce((
  select jsonb_agg(l.id order by l.name)
  from locations l
  where l.store_id = pj.store_id
    and lower(trim(l.name)) = lower(trim(coalesce(pj.location, '')))
), '[]'::jsonb)
where pj.location_scope = 'selected'
  and pj.location_ids = '[]'::jsonb;

create index if not exists public_jobs_location_ids_gin_idx
  on public_jobs using gin (location_ids);

-- Candidate preference is intentionally stored on the application, not the
-- profile: a candidate can be open to different stores for different roles.
alter table applications
  add column if not exists preferred_location_scope text not null default 'any'
    check (preferred_location_scope in ('any', 'selected')),
  add column if not exists preferred_location_ids jsonb not null default '[]'::jsonb;

create index if not exists applications_preferred_location_ids_gin_idx
  on applications using gin (preferred_location_ids);
