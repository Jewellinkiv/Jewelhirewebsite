-- Contract phase for recipient-bound v2 JewelCert links. This migration must
-- run only after the v2-writing application revision owns all production
-- traffic and its rollback-compatible smoke has passed. Any version-1 row that
-- became active during the expand window stops the contract until an operator
-- cancels and reissues it from the hardened revision.

do $$
begin
  if exists (
    select 1
    from jewelcert_invites
    where status in ('sent', 'started')
      and claim_token_version < 2
  ) then
    raise exception 'Cancel every active legacy JewelCert invite before applying 0024';
  end if;
end
$$;

alter table jewelcert_invites
  drop constraint if exists jewelcert_invites_active_claim_token_version_check;
alter table jewelcert_invites
  add constraint jewelcert_invites_active_claim_token_version_check
  check (status not in ('sent', 'started') or claim_token_version >= 2);
