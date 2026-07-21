# Production Migration Ledger Audit

Created: 2026-07-21T09:00:57.848Z
Result: PASS
Values printed: false

## JewelHire

- Repository migrations: 25
- Applied migrations: 25
- Pending migrations: 0
- Missing required launch migrations: 0

## JewelLink

- Reviewed repo: /Users/sterling/.codex/tmp/jewellink-app-origin-main-20260720
- Reviewed ref: origin/main
- Reviewed repo commit: 55032dbbebc519d1718aa14871da2048f60d9487
- Reviewed repo migrations: 127
- Active applied migrations: 127
- Historical rolled-back rows: 38
- Unfinished migration rows: 0
- Missing required JewelHire integration/auth migrations: 0
- Required integration/auth checksum drift: 0
- Full active checksum drift: 25
- Drift recovery evidence: valid
- Drift recovery report: /Users/sterling/Desktop/jewelhire/docs/qa-runs/jewellink-migration-drift-2026-07-21T03-45-00-000Z/jewellink-migration-drift-recovery-report.json
- Object-state evidence required: yes
- Object-state evidence valid: yes

### Full Checksum Drift Names

- 20260520152458_add_hidden_lesson_ids
- 20260530033000_add_pos_register_sessions
- 20260530040000_add_pos_tender_settings
- 20260530043000_add_pos_refund_lines
- 20260530050000_add_pos_inventory_movements
- 20260530060000_add_pos_service_settings
- 20260530070000_add_pos_service_activity
- 20260530080000_add_pos_service_checkout_lines
- 20260530090000_add_pos_commissions
- 20260530101500_add_pos_commission_workflow
- 20260530110000_add_inventory_catalog_fields
- 20260531004500_add_whatsapp_models
- 20260602090000_add_pos_appearance_settings
- 20260603151500_add_pos_device_settings
- 20260603163000_linkd_lite_pos_appearance_defaults
- 20260604125555_course_package_tag
- 20260604142331_feature_announcements
- 20260604160127_webchat_sms_merge
- 20260611120000_add_payment_reconciliation_fields
- 20260612110000_shopify_inventory_import_foundation
- 20260623120000_make_stripe_primary_payment_provider
- 20260624182000_add_company_pos_sources
- 20260625105500_add_reminder_automation_delay_unit
- 20260701130000_add_pos_payment_reference_unique
- 20260708110000_add_pos_foundation_ledger_audit

## Checks

- PASS JewelHire database credential is available for read-only ledger audit
- PASS JewelLink database credential is available for read-only ledger audit
- PASS JewelHire schema_migrations table exists
- PASS JewelHire migration ledger has no checksum, filename, order, or pending issues
- PASS JewelHire required launch migrations are applied
- PASS JewelLink _prisma_migrations table exists
- PASS JewelLink active ledger has no unfinished failed migration rows
- PASS JewelLink active migration names are unique
- PASS JewelLink active migration names all exist in the reviewed repo
- PASS JewelLink reviewed repo migrations are all active in production
- PASS JewelLink required JewelHire integration/auth migrations are active
- PASS JewelLink required JewelHire integration/auth migration checksums match
- PASS JewelLink historical checksum drift is absent or covered by passing recovery evidence

No database URLs, tokens, passwords, cookies, customer data, or secret values are written to this report.
