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

## Findings

- JewelHire's production migration ledger is clean.
- JewelLink's seven JewelHire integration/auth migrations are active and
  checksum-clean.
- JewelLink still has 25 older active Prisma rows whose stored production
  checksums do not match the reviewed repository files.
- A full `git fetch --all --tags --prune` was run before searching history.
- Exact-content history search found one matching committed file:
  `20260708110000_add_pos_foundation_ledger_audit` at commit `e87bbaf744f8`.
- The other 24 drifted checksums did not match any fetched committed version of
  their `migration.sql` files.

## Drift Rows

| Migration | Exact checksum match in fetched git history |
| --- | --- |
| `20260520152458_add_hidden_lesson_ids` | No match |
| `20260530033000_add_pos_register_sessions` | No match |
| `20260530040000_add_pos_tender_settings` | No match |
| `20260530043000_add_pos_refund_lines` | No match |
| `20260530050000_add_pos_inventory_movements` | No match |
| `20260530060000_add_pos_service_settings` | No match |
| `20260530070000_add_pos_service_activity` | No match |
| `20260530080000_add_pos_service_checkout_lines` | No match |
| `20260530090000_add_pos_commissions` | No match |
| `20260530101500_add_pos_commission_workflow` | No match |
| `20260530110000_add_inventory_catalog_fields` | No match |
| `20260531004500_add_whatsapp_models` | No match |
| `20260602090000_add_pos_appearance_settings` | No match |
| `20260603151500_add_pos_device_settings` | No match |
| `20260603163000_linkd_lite_pos_appearance_defaults` | No match |
| `20260604125555_course_package_tag` | No match |
| `20260604142331_feature_announcements` | No match |
| `20260604160127_webchat_sms_merge` | No match |
| `20260611120000_add_payment_reconciliation_fields` | No match |
| `20260612110000_shopify_inventory_import_foundation` | No match |
| `20260623120000_make_stripe_primary_payment_provider` | No match |
| `20260624182000_add_company_pos_sources` | No match |
| `20260625105500_add_reminder_automation_delay_unit` | No match |
| `20260701130000_add_pos_payment_reference_unique` | No match |
| `20260708110000_add_pos_foundation_ledger_audit` | `e87bbaf744f8` |

## Readiness Impact

This remains a NO-GO item. Because 24 applied checksums could not be matched to
fetched git history, the drift cannot be safely closed by a simple source-file
restore from the current repository history.

Acceptable closure paths:

1. Recover the exact applied SQL from provider backups, deployment artifacts, or
   another authoritative archive, then restore those migration files in a
   JewelLink PR.
2. Restore production to a verified clone and run an explicit schema/object
   review proving the active database shape matches the intended reviewed
   schema, then approve a controlled ledger repair.
3. If the drift is accepted as historical non-integration drift, record a named
   database owner approval and keep the seven JewelHire integration/auth rows as
   the hard launch boundary.

Do not update `_prisma_migrations` checksums directly without a provider backup,
restore plan, named database owner, and explicit approval.
