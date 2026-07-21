# JewelLink Migration Drift Review - 2026-07-20

This records the read-only review of the JewelLink production Prisma checksum
drift found during pilot readiness. No database rows were changed.

## Inputs

| Item | Value |
| --- | --- |
| JewelLink reviewed repo | `/Users/sterling/.codex/tmp/jewellink-app-origin-main-20260720` |
| Reviewed live baseline | `55032dbbebc519d1718aa14871da2048f60d9487` |
| Local no-push patch head | `f12e67d7202a6a567007605f7164d141638b5dbc` |
| Ledger evidence | `docs/qa-runs/migration-ledgers-2026-07-20T22-39-30-599Z/migration-ledger-report.md` |
| Repeatable recovery audit | `docs/qa-runs/jewellink-migration-drift-2026-07-21T00-55-59-144Z/jewellink-migration-drift-recovery-report.md` |
| Owner acceptance request | `docs/qa-runs/jewellink-migration-drift-2026-07-21T00-55-59-144Z/jewellink-migration-drift-owner-acceptance-request.md` |

## Findings

- JewelHire's production migration ledger is clean.
- JewelLink's seven JewelHire integration/auth migrations are active and
  checksum-clean.
- JewelLink still has 25 older active Prisma rows whose stored production
  checksums do not match the reviewed repository files.
- A full `git fetch --all --tags --prune` and a GitHub PR-head ref fetch were
  run before searching history.
- The latest repeatable audit also searched successful Cloud Build source
  revisions near each drifted row's applied window: 489 successful Cloud Build
  records and 258 reachable source revisions.
- Exact-content history search found one matching committed file:
  `20260708110000_add_pos_foundation_ledger_audit` at commit `e87bbaf744f8`.
- Cloud Build source revision search found zero additional exact SQL matches,
  so the other 24 drifted checksums still did not match any searched committed
  version of their `migration.sql` files.
- The repeatable report now records each drifted row's applied start/finish
  window, which narrows artifact/backup recovery to May 20, May 30, June 4,
  June 12, June 15, June 24, June 26, July 2, and July 8, 2026.
- The repeatable recovery audit now codifies this check in
  `scripts/jewellink-migration-drift-recovery-audit.mjs`. Its latest production
  run reviewed `origin/main` at `55032dbbebc519d1718aa14871da2048f60d9487`,
  searched 302 refs plus Cloud Build source revisions, and reproduced the same
  1 recovered / 24 unrecovered result without printing secrets.
- The latest repeatable audit also generated a database-owner acceptance
  request packet for the 24 unrecovered historical non-integration rows. The
  gate can pass by supplying an exact owner acceptance file to the audit, but
  only if the accepted migration list matches those 24 rows, all required
  acknowledgements are true, and no JewelHire integration/auth row is
  unrecovered.

## Drift Rows

| Migration | Exact checksum match in fetched git history | Cloud Build source match |
| --- | --- | --- |
| `20260520152458_add_hidden_lesson_ids` | No match | No match |
| `20260530033000_add_pos_register_sessions` | No match | No match |
| `20260530040000_add_pos_tender_settings` | No match | No match |
| `20260530043000_add_pos_refund_lines` | No match | No match |
| `20260530050000_add_pos_inventory_movements` | No match | No match |
| `20260530060000_add_pos_service_settings` | No match | No match |
| `20260530070000_add_pos_service_activity` | No match | No match |
| `20260530080000_add_pos_service_checkout_lines` | No match | No match |
| `20260530090000_add_pos_commissions` | No match | No match |
| `20260530101500_add_pos_commission_workflow` | No match | No match |
| `20260530110000_add_inventory_catalog_fields` | No match | No match |
| `20260531004500_add_whatsapp_models` | No match | No match |
| `20260602090000_add_pos_appearance_settings` | No match | No match |
| `20260603151500_add_pos_device_settings` | No match | No match |
| `20260603163000_linkd_lite_pos_appearance_defaults` | No match | No match |
| `20260604125555_course_package_tag` | No match | No match |
| `20260604142331_feature_announcements` | No match | No match |
| `20260604160127_webchat_sms_merge` | No match | No match |
| `20260611120000_add_payment_reconciliation_fields` | No match | No match |
| `20260612110000_shopify_inventory_import_foundation` | No match | No match |
| `20260623120000_make_stripe_primary_payment_provider` | No match | No match |
| `20260624182000_add_company_pos_sources` | No match | No match |
| `20260625105500_add_reminder_automation_delay_unit` | No match | No match |
| `20260701130000_add_pos_payment_reference_unique` | No match | No match |
| `20260708110000_add_pos_foundation_ledger_audit` | `e87bbaf744f8` | No match |

## Readiness Impact

This remains a NO-GO item. Because 24 applied checksums could not be matched to
fetched git history or Cloud Build source revisions, the drift cannot be safely
closed by a simple source-file restore from the current repository history.

Acceptable closure paths:

1. Recover the exact applied SQL from provider backups, deployment artifacts, or
   another authoritative archive, then restore those migration files in a
   JewelLink PR.
2. Restore production to a verified clone and run an explicit schema/object
   review proving the active database shape matches the intended reviewed
   schema, then approve a controlled ledger repair.
3. If the drift is accepted as historical non-integration drift, record a named
   database owner approval with the generated acceptance request packet, rerun
   the audit with `--database-owner-acceptance-file=<path>`, and keep the seven
   JewelHire integration/auth rows as the hard launch boundary.

Do not update `_prisma_migrations` checksums directly without a provider backup,
restore plan, named database owner, and explicit approval.
