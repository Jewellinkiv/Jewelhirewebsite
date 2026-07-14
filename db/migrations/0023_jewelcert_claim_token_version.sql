-- Expand phase for recipient-bound v2 JewelCert links. This additive column is
-- deliberately compatible with the pre-v2 production revision: old code that
-- omits the column continues to write version 1 while the no-traffic candidate
-- is validated. The separate 0024 contract migration is applied only after the
-- v2-writing revision owns traffic and its public production smoke passes.

alter table jewelcert_invites
  add column if not exists claim_token_version smallint not null default 1;
