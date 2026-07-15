-- Paid standalone recovery for retained JewelLink companies.
-- Checkout requests are opaque, expiring correlation records. Stripe may only
-- activate an existing company when a signed webhook presents one of these
-- references and the exact configured monthly/annual Checkout offer.

alter table pending_store_signups
  add column if not exists billing_interval text not null default 'month'
  check (billing_interval in ('month', 'year'));

alter table pending_store_signups
  add column if not exists provider_checkout_session_id text;

alter table pending_store_signups
  add column if not exists checkout_expires_at timestamptz;

alter table pending_store_signups
  add column if not exists cancellation_reason text;

-- Only one unpaid signup may own an open Checkout Session for an email. Keep
-- the newest legacy row pending so this index can be added safely; the release
-- gate separately requires every legacy Payment Link to be drained first.
with ranked_pending_signups as (
  select id,
         row_number() over (
           partition by owner_email_normalized
           order by created_at desc, id desc
         ) as position
  from pending_store_signups
  where status = 'pending'
)
update pending_store_signups signup
set status = 'cancelled',
    cancellation_reason = 'migration_duplicate',
    updated_at = now()
from ranked_pending_signups ranked
where signup.id = ranked.id
  and ranked.position > 1;

create unique index if not exists pending_store_signups_pending_email_uidx
  on pending_store_signups(owner_email_normalized)
  where status = 'pending';

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
  cancellation_reason text,
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

-- Subscription lifecycle events can arrive before checkout.session.completed.
-- Persist the newest signed state so checkout activation can apply it in the
-- same transaction instead of granting provisional access from stale ordering.
create table if not exists stripe_subscription_states (
  provider_subscription_id text primary key,
  checkout_reference_id text not null,
  provider_customer_id text,
  status text not null check (status in ('active', 'trialing', 'past_due', 'cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider_event_id text not null,
  provider_event_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_subscription_states_reference_idx
  on stripe_subscription_states(checkout_reference_id, provider_subscription_id);
