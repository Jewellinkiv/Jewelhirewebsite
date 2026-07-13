-- JewelLink-initiated JewelCert invites and result-delivery state.

alter table applications drop constraint if exists applications_source_check;
alter table applications add constraint applications_source_check
  check (source in ('public_store_page', 'manual_store_entry', 'referral', 'admin_import', 'jewellink_employee'));

alter table jewelcert_invites add column if not exists external_request_id text;
alter table jewelcert_invites add column if not exists external_user_id text;
alter table jewelcert_invites add column if not exists external_company_id text;
alter table jewelcert_invites add column if not exists external_location_id text;
create unique index if not exists jewelcert_invites_store_external_request_uidx
  on jewelcert_invites(store_id, external_request_id)
  where external_request_id is not null;

alter table gemmatch_invites add column if not exists result_sync_status text;
alter table gemmatch_invites add column if not exists result_sync_error text;
alter table gemmatch_invites drop constraint if exists gemmatch_invites_result_sync_status_check;
alter table gemmatch_invites add constraint gemmatch_invites_result_sync_status_check
  check (result_sync_status is null or result_sync_status in ('pending', 'synced', 'failed'));
