-- Pending store-owner signups. A row is created when a prospective owner submits
-- the store signup form; the company/store/owner account is only provisioned once
-- Stripe confirms payment (checkout.session.completed). The pending row grants no
-- access on its own and is threaded through Stripe via client_reference_id.
create table if not exists pending_store_signups (
  id text primary key,
  company_name text not null,
  owner_name text,
  owner_email text not null,
  owner_email_normalized text not null,
  plan text not null default 'starter',
  promo_code text,
  status text not null default 'pending' check (status in ('pending', 'provisioned', 'cancelled')),
  provisioned_company_id text,
  provisioned_store_id text,
  provisioned_user_id text,
  stripe_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provisioned_at timestamptz
);

create index if not exists pending_store_signups_email_idx
  on pending_store_signups (owner_email_normalized);
create index if not exists pending_store_signups_status_idx
  on pending_store_signups (status);
