-- JewelLink identity, organization entitlement, and manager location-scope
-- foundation. This migration does not enable SSO by itself.

alter table companies add column if not exists jewellink_company_id text;
create unique index if not exists companies_jewellink_company_id_uidx
  on companies(jewellink_company_id)
  where jewellink_company_id is not null;

alter table locations add column if not exists jewellink_location_id text;
create unique index if not exists locations_jewellink_location_id_uidx
  on locations(jewellink_location_id)
  where jewellink_location_id is not null;

-- Existing store memberships retain all-location access. JewelLink-provisioned
-- managers can instead be created with all_locations=false plus explicit grants.
alter table store_users add column if not exists all_locations boolean not null default true;

create table if not exists store_user_location_scopes (
  id text primary key,
  store_user_id text not null references store_users(id) on delete cascade,
  location_id text not null references locations(id) on delete cascade,
  source text not null default 'manual' check (source in ('manual', 'jewellink')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_user_id, location_id)
);

create index if not exists store_user_location_scopes_location_idx
  on store_user_location_scopes(location_id, store_user_id);

-- Entitlements are organization-level. Stripe billing and JewelLink-included
-- access both resolve into this table so authorization never depends on an
-- email domain or on an individual user's payment state.
create table if not exists company_access_entitlements (
  company_id text primary key references companies(id) on delete cascade,
  source text not null check (source in ('stripe', 'jewellink_included', 'comped', 'contract')),
  plan_code text not null,
  status text not null default 'active' check (status in ('active', 'past_due', 'paused', 'cancelled', 'expired')),
  billing_interval text check (billing_interval in ('month', 'year')),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  provider_customer_id text,
  provider_subscription_id text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_access_entitlements_source_status_idx
  on company_access_entitlements(source, status);
