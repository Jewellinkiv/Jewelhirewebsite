create table if not exists legal_consents (
  id text primary key,
  email_normalized text not null,
  source text not null check (source in ('public_application', 'applicant_signup', 'store_signup')),
  policy_version text not null,
  privacy_version text not null,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb
);

create index if not exists legal_consents_email_accepted_idx
  on legal_consents (email_normalized, accepted_at desc);

create index if not exists legal_consents_source_accepted_idx
  on legal_consents (source, accepted_at desc);
