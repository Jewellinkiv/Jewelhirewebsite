-- Persist the candidate's real JewelCert trait mix + numeric fit score, instead
-- of storing only the primary code and reconstructing a canned mix at display
-- time. Nullable so existing rows are unaffected (the app falls back to the
-- reconstruction for those).
alter table gemmatch_invites add column if not exists result_mix jsonb;
alter table gemmatch_invites add column if not exists fit_score integer;
