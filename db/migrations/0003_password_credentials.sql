create table if not exists password_credentials (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists password_credentials_user_id_idx on password_credentials(user_id);
