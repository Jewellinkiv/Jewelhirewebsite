create table if not exists application_attachments (
  id text primary key,
  application_id text not null references applications(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  kind text not null check (kind in ('resume')),
  original_filename text not null,
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  file_size_bytes integer not null check (file_size_bytes > 0 and file_size_bytes <= 5242880),
  sha256 text not null check (length(sha256) = 64),
  content bytea not null,
  created_at timestamptz not null default now(),
  unique (application_id, kind)
);

create index if not exists application_attachments_store_application_idx
  on application_attachments (store_id, application_id);
