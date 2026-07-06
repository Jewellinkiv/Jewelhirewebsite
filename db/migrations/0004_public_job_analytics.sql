alter table public_jobs
  add column if not exists view_count integer not null default 0 check (view_count >= 0),
  add column if not exists apply_click_count integer not null default 0 check (apply_click_count >= 0);
