-- Applicant self-service signup must prove possession of the email address
-- before creating a user, adopting application history, or setting a password.
-- The raw verification token is delivered by email and never persisted; only
-- its SHA-256 hash is stored. Resends create independent rows so a provider
-- timeout or another ambiguous outcome can never invalidate a link that may
-- already be in flight. Completion serializes by normalized email and removes
-- every outstanding row only after one verified identity wins.

create table if not exists pending_applicant_signups (
  id text primary key,
  email text not null,
  email_normalized text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email_normalized = lower(btrim(email_normalized)))
);

create index if not exists pending_applicant_signups_expires_idx
  on pending_applicant_signups (expires_at);

create index if not exists pending_applicant_signups_email_normalized_idx
  on pending_applicant_signups (email_normalized);
