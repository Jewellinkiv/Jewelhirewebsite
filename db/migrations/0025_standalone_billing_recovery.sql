-- Paid standalone recovery for retained JewelLink companies.
-- Checkout requests are opaque, expiring correlation records. Stripe may only
-- activate an existing company when a signed webhook presents one of these
-- references and the exact configured monthly/annual Checkout offer.

alter table pending_store_signups
  add column if not exists billing_interval text not null default 'month'
  check (billing_interval in ('month', 'year'));

alter table pending_store_signups
  add column if not exists provider_checkout_session_id text;

create unique index if not exists pending_store_signups_checkout_session_uidx
  on pending_store_signups(provider_checkout_session_id)
  where provider_checkout_session_id is not null;

create table if not exists standalone_checkout_requests (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  requested_for_user_id text references users(id) on delete set null,
  created_by_user_id text references users(id) on delete set null,
  billing_interval text not null check (billing_interval in ('month', 'year')),
  amount_cents integer not null,
  constraint standalone_checkout_requests_offer_check check (
    (billing_interval = 'month' and amount_cents = 14900)
    or (billing_interval = 'year' and amount_cents = 129900)
  ),
  status text not null default 'pending' check (status in ('pending', 'activated', 'cancelled', 'expired')),
  provider_checkout_session_id text,
  provider_subscription_id text,
  expires_at timestamptz not null default (now() + interval '1 day'),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists standalone_checkout_requests_session_uidx
  on standalone_checkout_requests(provider_checkout_session_id)
  where provider_checkout_session_id is not null;

create index if not exists standalone_checkout_requests_company_status_idx
  on standalone_checkout_requests(company_id, status, created_at desc);

create index if not exists standalone_checkout_requests_expiry_idx
  on standalone_checkout_requests(status, expires_at)
  where status = 'pending';
