-- Native session cookies carry this durable per-user epoch. Any credential
-- replacement increments it in the same transaction, so every cookie minted
-- before that replacement fails closed on its next authenticated request.
-- JewelLink SSO sessions use their upstream assurance instead and deliberately
-- do not depend on this native-only value.

alter table users
  add column if not exists native_auth_epoch integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'users'::regclass
      and conname = 'users_native_auth_epoch_nonnegative_check'
  ) then
    alter table users
      add constraint users_native_auth_epoch_nonnegative_check
      check (native_auth_epoch >= 0);
  end if;
end
$$;
