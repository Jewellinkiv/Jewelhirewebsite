alter table applications
  add column if not exists public_submission_key_hash text;

create unique index if not exists applications_public_submission_key_uidx
  on applications (public_submission_key_hash)
  where public_submission_key_hash is not null;
