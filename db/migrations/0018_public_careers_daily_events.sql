create table if not exists public_careers_daily_events (
  store_id text not null references stores(id) on delete cascade,
  public_page_id text not null references store_public_pages(id) on delete cascade,
  job_id text not null default '',
  event_date date not null default current_date,
  event_type text not null check (event_type in ('page_view', 'application_start')),
  event_count integer not null default 0 check (event_count >= 0),
  primary key (public_page_id, job_id, event_date, event_type)
);

create index if not exists public_careers_daily_events_store_date_idx
  on public_careers_daily_events (store_id, event_date desc);
