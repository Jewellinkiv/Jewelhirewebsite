-- Fixed-window rate-limit counters for public auth endpoints. Each row counts
-- hits for a (bucket, window_start) pair; the app increments atomically via an
-- upsert and compares against a per-endpoint limit. Old windows are purged
-- opportunistically by the app.
create table if not exists rate_limit_hits (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

create index if not exists rate_limit_hits_window_idx on rate_limit_hits (window_start);
