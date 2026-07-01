create table if not exists applicant_notification_prefs (
  applicant_profile_id text primary key references applicant_profiles(id) on delete cascade,
  invites boolean not null default true,
  interviews boolean not null default true,
  status_updates boolean not null default true,
  marketing boolean not null default false,
  updated_at timestamptz not null default now()
);
