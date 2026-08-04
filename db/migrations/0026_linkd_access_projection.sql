-- Signed Linkd Access projection receipts. They make deliveries idempotent and
-- let local session revalidation reject a central authorization version that
-- has been superseded, without treating this database as identity authority.
create table if not exists linkd_access_projection_receipts (
  id text primary key,
  outbox_id text not null unique,
  idempotency_key text not null unique,
  user_id text not null references users(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  spoke_grant_id text not null,
  authorization_version integer not null check (authorization_version >= 1),
  projection_hash text not null check (projection_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists linkd_access_projection_receipts_current_idx
  on linkd_access_projection_receipts (user_id, company_id, spoke_grant_id, authorization_version desc);

alter table store_users drop constraint if exists store_users_source_check;
alter table store_users add constraint store_users_source_check
  check (source in ('manual', 'jewellink', 'linkd'));
