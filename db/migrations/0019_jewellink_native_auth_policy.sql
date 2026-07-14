-- JewelLink-managed identities remain SSO-only unless an explicit retained-
-- account claim converts them after paid/contract entitlement verification.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'users'
      and column_name = 'native_auth_enabled'
  ) then
    alter table users
      add column native_auth_enabled boolean not null default true;
  end if;
end
$$;

-- Fail closed for every identity linked before this policy existed. A legacy
-- action-token used_at timestamp cannot prove redemption because bulk invalidation
-- writes the same field, and password timestamps cannot safely disambiguate the
-- two events. Production has not applied the pending JewelLink SSO migration
-- tranche, so no live linked-account conversion needs an inferred backfill.
-- Any exceptional retained-account conversion must be a separately reviewed,
-- explicit, audited post-migration action after standalone entitlement checks.
update users
set native_auth_enabled = false,
    updated_at = now()
where jewellink_user_id is not null;

create index if not exists users_native_auth_enabled_idx
  on users(email_normalized)
  where status = 'active' and native_auth_enabled = true;

-- Account-claim authority belongs to one exact company. Legacy unbound claims
-- cannot be proven safe, so expire them instead of inferring their company from
-- the user's mutable primary-company field.
alter table auth_action_tokens
  add column if not exists company_id text references companies(id) on delete cascade;

update auth_action_tokens
set used_at = now()
where purpose = 'account_claim'
  and company_id is null
  and used_at is null;

-- Repair any historical issuance race before enforcing one outstanding token
-- for each user and purpose. The newest row wins deterministically.
with ranked_tokens as (
  select
    id,
    row_number() over (
      partition by purpose, user_id
      order by created_at desc, id desc
    ) as token_rank
  from auth_action_tokens
  where used_at is null
)
update auth_action_tokens token
set used_at = now()
from ranked_tokens ranked
where token.id = ranked.id
  and ranked.token_rank > 1;

alter table auth_action_tokens
  drop constraint if exists auth_action_tokens_active_claim_company_check;
alter table auth_action_tokens
  add constraint auth_action_tokens_active_claim_company_check
  check (purpose <> 'account_claim' or company_id is not null or used_at is not null);

create unique index if not exists auth_action_tokens_one_outstanding_uidx
  on auth_action_tokens(purpose, user_id)
  where used_at is null;

create index if not exists auth_action_tokens_company_idx
  on auth_action_tokens(company_id)
  where company_id is not null;
