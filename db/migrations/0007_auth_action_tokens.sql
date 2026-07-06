-- Single-use, expiring tokens for auth actions that arrive by email:
-- password reset and (later) account/JewelCert claim. The raw token is emailed;
-- only its hash is stored. used_at enforces single use.

create table if not exists auth_action_tokens (
  id text primary key,
  purpose text not null check (purpose in ('password_reset', 'account_claim')),
  user_id text not null,
  email_normalized text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_action_tokens_lookup_idx on auth_action_tokens (purpose, token_hash);
create index if not exists auth_action_tokens_user_idx on auth_action_tokens (user_id);
