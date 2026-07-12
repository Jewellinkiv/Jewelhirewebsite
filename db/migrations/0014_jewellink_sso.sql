-- Stable JewelLink user identity for SSO provisioning.

alter table users add column if not exists jewellink_user_id text;
create unique index if not exists users_jewellink_user_id_uidx
  on users(jewellink_user_id)
  where jewellink_user_id is not null;

alter table store_users add column if not exists source text not null default 'manual';
alter table store_users drop constraint if exists store_users_source_check;
alter table store_users add constraint store_users_source_check
  check (source in ('manual', 'jewellink'));
