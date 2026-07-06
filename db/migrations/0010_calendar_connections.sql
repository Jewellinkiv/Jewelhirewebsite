-- Per-store calendar OAuth connections (Google Calendar / Microsoft Graph).
-- Access/refresh tokens are stored ENCRYPTED (AES-256-GCM) by the app; the DB
-- never holds plaintext tokens. One connection per store per provider.
create table if not exists store_calendar_connections (
  store_id text not null,
  provider text not null check (provider in ('google', 'microsoft')),
  account_email text,
  access_token_enc text not null,
  refresh_token_enc text,
  scope text,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, provider)
);

-- Maps a JewelHire interview to the calendar event created for it, so the event
-- can be updated/cancelled when the interview changes.
create table if not exists interview_calendar_events (
  interview_id text not null,
  provider text not null check (provider in ('google', 'microsoft')),
  event_id text not null,
  html_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (interview_id, provider)
);
