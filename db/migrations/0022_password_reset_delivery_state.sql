-- Password-reset delivery is a two-phase operation: persist a hashed pending
-- bearer in a short transaction, send through Postmark without a database
-- connection, then settle the candidate in another short transaction. Pending
-- candidates remain redeemable if the process exits after Postmark accepts the
-- email but before settlement; successful redemption still consumes every
-- sibling token atomically.

alter table auth_action_tokens
  add column if not exists delivery_state text not null default 'active';

alter table auth_action_tokens
  drop constraint if exists auth_action_tokens_delivery_state_check;
alter table auth_action_tokens
  add constraint auth_action_tokens_delivery_state_check
  check (delivery_state in ('pending', 'active', 'rejected', 'superseded'));

-- Account claims retain strict one-outstanding-link replacement semantics.
-- Password resets may temporarily have one active link plus independently
-- pending deliveries; finalization or redemption collapses them safely.
drop index if exists auth_action_tokens_one_outstanding_uidx;
create unique index auth_action_tokens_one_outstanding_uidx
  on auth_action_tokens(purpose, user_id)
  where used_at is null and purpose = 'account_claim';

create index if not exists auth_action_tokens_pending_reset_delivery_idx
  on auth_action_tokens(user_id, created_at)
  where purpose = 'password_reset'
    and used_at is null
    and delivery_state = 'pending';
