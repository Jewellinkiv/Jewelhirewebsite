# JewelLink Migration Drift Recovery Audit

Created: 2026-07-21T03:02:56.040Z
Result: FAIL
Values printed: false

## Scope

- JewelLink repo: /Users/sterling/.codex/tmp/jewellink-app-origin-main-20260720
- Reviewed ref: origin/main
- Reviewed repo commit: 55032dbbebc519d1718aa14871da2048f60d9487
- Git fetch attempted: true
- Git fetch status: ok
- Pull-ref fetch attempted: true
- Pull-ref fetch status: ok
- Refs searched: 302
- Active production migrations: 127
- Reviewed repo migrations: 127
- Full checksum drift: 25
- Drift rows with exact SQL recovered from fetched git history: 1
- Cloud Build source search attempted: true
- Cloud Build source search status: ok
- Cloud Build source search range: 2026-05-19T20:30:14.778Z to 2026-07-09T20:05:53.030Z
- Cloud Build successful builds considered: 489
- Cloud Build source revisions searched: 258
- Cloud Build source revisions reachable locally: 258
- Cloud Build source revisions unreachable locally: 0
- Cloud Build exact SQL matches: 0
- Drift rows matching reviewed SQL with CRLF line endings: 21
- Drift rows with exact SQL recovered from any searched source: 22
- Drift rows still unrecovered: 3
- Database owner acceptance attempted: false
- Database owner acceptance valid: false
- Database owner accepted migration count: 0

## Drift Recovery

| Migration | Applied checksum | Reviewed checksum | Applied window | History match | Cloud Build source match | Reviewed SQL byte variant | Path commits searched |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `20260520152458_add_hidden_lesson_ids` | `2758166eab11` | `f6a5195d9e4e` | 2026-05-20 20:30:14.778153+00 to 2026-05-20 20:30:14.989886+00 | No match | No match | No match | 1 |
| `20260530033000_add_pos_register_sessions` | `18f8d8e457a2` | `011414aa4dbe` | 2026-05-30 21:42:54.727668+00 to 2026-05-30 21:42:54.727668+00 | No match | No match | CRLF line endings | 1 |
| `20260530040000_add_pos_tender_settings` | `597a1ab51c31` | `a3941a32c12e` | 2026-05-30 21:43:17.727105+00 to 2026-05-30 21:43:17.727105+00 | No match | No match | CRLF line endings | 1 |
| `20260530043000_add_pos_refund_lines` | `2257dcf62ea1` | `3dd3dc030ec8` | 2026-05-30 21:43:59.817376+00 to 2026-05-30 21:43:59.817376+00 | No match | No match | CRLF line endings | 1 |
| `20260530050000_add_pos_inventory_movements` | `120e6650b049` | `3fb6acfae2e9` | 2026-05-30 21:44:05.542347+00 to 2026-05-30 21:44:05.542347+00 | No match | No match | CRLF line endings | 1 |
| `20260530060000_add_pos_service_settings` | `498886fce1ac` | `0373bece249c` | 2026-05-30 21:44:10.745588+00 to 2026-05-30 21:44:10.745588+00 | No match | No match | CRLF line endings | 1 |
| `20260530070000_add_pos_service_activity` | `c8d783df1c1b` | `3b48eda864db` | 2026-05-30 21:44:16.216233+00 to 2026-05-30 21:44:16.216233+00 | No match | No match | CRLF line endings | 1 |
| `20260530080000_add_pos_service_checkout_lines` | `70b801ce0e19` | `9f0b55fdb526` | 2026-05-30 21:44:21.3138+00 to 2026-05-30 21:44:21.3138+00 | No match | No match | CRLF line endings | 1 |
| `20260530090000_add_pos_commissions` | `010fa2706c8d` | `fc59bb6e2628` | 2026-05-30 21:44:26.519291+00 to 2026-05-30 21:44:26.519291+00 | No match | No match | CRLF line endings | 1 |
| `20260530101500_add_pos_commission_workflow` | `211d61b7e576` | `a0b46ef85be3` | 2026-05-30 21:44:31.810751+00 to 2026-05-30 21:44:31.810751+00 | No match | No match | CRLF line endings | 1 |
| `20260530110000_add_inventory_catalog_fields` | `5ccc572ae03d` | `e4fbe1dc273b` | 2026-05-30 21:44:36.905066+00 to 2026-05-30 21:44:36.905066+00 | No match | No match | CRLF line endings | 1 |
| `20260531004500_add_whatsapp_models` | `b18a8bcc7bd0` | `6d0057497e35` | 2026-06-04 16:32:23.258886+00 to 2026-06-04 16:32:23.258886+00 | No match | No match | CRLF line endings | 1 |
| `20260602090000_add_pos_appearance_settings` | `40537d7ad30a` | `1b83e89e5164` | 2026-06-04 16:32:42.389752+00 to 2026-06-04 16:32:42.389752+00 | No match | No match | CRLF line endings | 1 |
| `20260603151500_add_pos_device_settings` | `51efc5766677` | `3542a878da8d` | 2026-06-04 16:36:34.98021+00 to 2026-06-04 16:36:34.98021+00 | No match | No match | CRLF line endings | 1 |
| `20260603163000_linkd_lite_pos_appearance_defaults` | `c998622cfb7d` | `b7ac89d8c65e` | 2026-06-04 16:36:37.344408+00 to 2026-06-04 16:36:37.344408+00 | No match | No match | CRLF line endings | 1 |
| `20260604125555_course_package_tag` | `fb99db7a7342` | `e895f8bf0962` | 2026-06-04 17:56:05.123341+00 to 2026-06-04 17:56:05.346266+00 | No match | No match | No match | 1 |
| `20260604142331_feature_announcements` | `b0d1e70fd19a` | `d211b09b6a48` | 2026-06-04 19:23:40.41933+00 to 2026-06-04 19:23:40.910931+00 | No match | No match | No match | 1 |
| `20260604160127_webchat_sms_merge` | `5ce7a97b1db8` | `3ad735242c6d` | 2026-06-04 21:01:36.295656+00 to 2026-06-04 21:01:36.529891+00 | No match | No match | CRLF line endings | 1 |
| `20260611120000_add_payment_reconciliation_fields` | `b38d4e4902dd` | `3909e4381501` | 2026-06-12 13:41:55.826586+00 to 2026-06-12 13:41:56.130046+00 | No match | No match | CRLF line endings | 2 |
| `20260612110000_shopify_inventory_import_foundation` | `7c784e0e3570` | `8ad3bdb6cd3d` | 2026-06-15 21:28:23.655568+00 to 2026-06-15 21:28:25.155161+00 | No match | No match | CRLF line endings | 2 |
| `20260623120000_make_stripe_primary_payment_provider` | `52186f5cf102` | `3c49d03f9374` | 2026-06-24 17:55:59.8207+00 to 2026-06-24 17:56:00.142786+00 | No match | No match | CRLF line endings | 1 |
| `20260624182000_add_company_pos_sources` | `272d93ae1dff` | `d9030f4ed3fb` | 2026-06-24 19:52:13.090363+00 to 2026-06-24 19:52:13.090363+00 | No match | No match | CRLF line endings | 2 |
| `20260625105500_add_reminder_automation_delay_unit` | `91a5bba9c993` | `0ccd05182ba4` | 2026-06-26 16:05:44.407293+00 to 2026-06-26 16:05:44.641307+00 | No match | No match | CRLF line endings | 2 |
| `20260701130000_add_pos_payment_reference_unique` | `8c089f0cb19f` | `3bc25e619a30` | 2026-07-02 01:51:34.355406+00 to 2026-07-02 01:51:34.662976+00 | No match | No match | CRLF line endings | 1 |
| `20260708110000_add_pos_foundation_ledger_audit` | `03e2bfa11ddd` | `43c104251070` | 2026-07-08 20:05:49.575467+00 to 2026-07-08 20:05:53.030425+00 | `e87bbaf744f8` | No match | No match | 3 |

## Database Owner Acceptance

- Acceptance file provided: no
- Owner recorded: no
- Owner role recorded: no
- Accepted at: missing
- Accepted migration list matches unrecovered rows: no
- Required acknowledgements recorded: no
- Integration/auth unrecovered rows: none
- Acceptance request artifact: jewellink-migration-drift-owner-acceptance-request.md

## Closure Guidance

This remains a NO-GO item. Close it by recovering the missing applied SQL from provider backups/deployment artifacts, restoring and reviewing a production clone before controlled ledger repair, or recording named database-owner acceptance of historical non-integration drift.

## Checks

- PASS JewelLink repo exists
- PASS JewelLink git history fetch completed or was skipped
- PASS JewelLink database credential is available for read-only drift audit
- PASS JewelLink _prisma_migrations table exists
- PASS JewelLink Cloud Build source revision search completed
- PASS JewelLink active integration/auth migration rows have no checksum drift
- FAIL Every drifted JewelLink active migration has exact SQL recovered or named database-owner acceptance
- FAIL Unrecovered JewelLink historical drift has valid named owner acceptance

No database URLs, bearer tokens, passwords, cookies, customer data, or secret values are written to this report.
