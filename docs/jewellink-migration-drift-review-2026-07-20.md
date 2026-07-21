# JewelLink Migration Drift Review - 2026-07-20

This records the read-only review of the JewelLink production Prisma checksum
drift found during pilot readiness. No database rows were changed.

## Inputs

| Item | Value |
| --- | --- |
| JewelLink reviewed repo | `/Users/sterling/.codex/tmp/jewellink-app-origin-main-20260720` |
| Reviewed live baseline | `55032dbbebc519d1718aa14871da2048f60d9487` |
| Local no-push patch head | `f12e67d7202a6a567007605f7164d141638b5dbc` |
| Ledger evidence | `docs/qa-runs/migration-ledgers-2026-07-21T05-45-00-000Z/migration-ledger-report.md` |
| Repeatable recovery audit | `docs/qa-runs/jewellink-migration-drift-2026-07-21T03-45-00-000Z/jewellink-migration-drift-recovery-report.md` |
| Object-state audit | `docs/qa-runs/jewellink-migration-object-state-2026-07-21T03-16-00-000Z/jewellink-migration-object-state-report.md` |
| Owner acceptance request | Not required by the latest passing recovery audit |

## Findings

- JewelHire's production migration ledger is clean.
- JewelLink's seven JewelHire integration/auth migrations are active and
  checksum-clean.
- JewelLink has 25 older active Prisma rows whose stored production checksums
  do not match the raw reviewed repository files, but all 25 now have
  repeatable recovery evidence.
- A full `git fetch --all --tags --prune` and a GitHub PR-head ref fetch were
  run before searching history.
- The latest repeatable audit also searched successful Cloud Build source
  revisions near each drifted row's applied window: 489 successful Cloud Build
  records and 258 reachable source revisions.
- Exact-content history search found one matching committed file:
  `20260708110000_add_pos_foundation_ledger_audit` at commit `e87bbaf744f8`.
- Cloud Build source revision search found zero additional exact SQL matches,
  but deterministic reviewed-SQL byte-variant recovery matched the remaining
  24 checksums: 21 with full CRLF line endings and 3 with a terminal CRLF line
  ending.
- 0 historical non-integration checksums remain unrecovered.
- The repeatable report now records each drifted row's applied start/finish
  window, which narrows artifact/backup recovery to May 20, May 30, June 4,
  June 12, June 15, June 24, June 26, July 2, and July 8, 2026.
- The repeatable recovery audit now codifies this check in
  `scripts/jewellink-migration-drift-recovery-audit.mjs`. Its latest production
  run reviewed `origin/main` at `55032dbbebc519d1718aa14871da2048f60d9487`,
  searched 302 refs plus Cloud Build source revisions, and produced a
  25 recovered / 0 unrecovered PASS result without printing secrets.
- No database-owner acceptance file is required by the latest passing audit.
  The acceptance template remains only as a fallback if future evidence
  regresses or new unrecovered historical drift appears.
- A read-only object-state audit also checks the live schema objects implied by
  the three rows that previously lacked byte-variant recovery. It passes 20/20
  without reading customer rows or printing secrets, verifying the expected
  `hiddenLessonIds` column,
  `course_package.tag` column, and feature-announcement tables, indexes, primary
  keys, and cascading foreign keys.

## Drift Rows

| Migration | Exact checksum match in fetched git history | Cloud Build source match | Reviewed SQL byte-variant match |
| --- | --- | --- | --- |
| `20260520152458_add_hidden_lesson_ids` | No match | No match | terminal CRLF line ending |
| `20260530033000_add_pos_register_sessions` | No match | No match | CRLF line endings |
| `20260530040000_add_pos_tender_settings` | No match | No match | CRLF line endings |
| `20260530043000_add_pos_refund_lines` | No match | No match | CRLF line endings |
| `20260530050000_add_pos_inventory_movements` | No match | No match | CRLF line endings |
| `20260530060000_add_pos_service_settings` | No match | No match | CRLF line endings |
| `20260530070000_add_pos_service_activity` | No match | No match | CRLF line endings |
| `20260530080000_add_pos_service_checkout_lines` | No match | No match | CRLF line endings |
| `20260530090000_add_pos_commissions` | No match | No match | CRLF line endings |
| `20260530101500_add_pos_commission_workflow` | No match | No match | CRLF line endings |
| `20260530110000_add_inventory_catalog_fields` | No match | No match | CRLF line endings |
| `20260531004500_add_whatsapp_models` | No match | No match | CRLF line endings |
| `20260602090000_add_pos_appearance_settings` | No match | No match | CRLF line endings |
| `20260603151500_add_pos_device_settings` | No match | No match | CRLF line endings |
| `20260603163000_linkd_lite_pos_appearance_defaults` | No match | No match | CRLF line endings |
| `20260604125555_course_package_tag` | No match | No match | terminal CRLF line ending |
| `20260604142331_feature_announcements` | No match | No match | terminal CRLF line ending |
| `20260604160127_webchat_sms_merge` | No match | No match | CRLF line endings |
| `20260611120000_add_payment_reconciliation_fields` | No match | No match | CRLF line endings |
| `20260612110000_shopify_inventory_import_foundation` | No match | No match | CRLF line endings |
| `20260623120000_make_stripe_primary_payment_provider` | No match | No match | CRLF line endings |
| `20260624182000_add_company_pos_sources` | No match | No match | CRLF line endings |
| `20260625105500_add_reminder_automation_delay_unit` | No match | No match | CRLF line endings |
| `20260701130000_add_pos_payment_reference_unique` | No match | No match | CRLF line endings |
| `20260708110000_add_pos_foundation_ledger_audit` | `e87bbaf744f8` | No match | No match |

## Readiness Impact

This gate is closed for pilot readiness by
`docs/qa-runs/jewellink-migration-drift-2026-07-21T03-45-00-000Z/jewellink-migration-drift-recovery-report.md`.
All 25 drifted active rows are either recovered from fetched git history or
matched to deterministic reviewed-SQL byte variants, and the seven JewelHire
integration/auth rows remain checksum-clean.

Do not update `_prisma_migrations` checksums directly. No ledger repair is
authorized or needed for this closure evidence.
