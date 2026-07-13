# JewelHire production rollout checklist

Updated: 2026-07-13

## Current release-candidate status

- [x] Production build compiles and TypeScript passes.
- [x] Store owner, manager, location-scoped manager, applicant, and platform-admin role policy audits pass.
- [x] Cross-store application and JewelLink integration isolation checks pass.
- [x] JewelLink SSO, hire handoff, and JewelCert handoff source audits pass.
- [x] Chrome QA confirms the local JewelLink button and profile-menu entry open JewelHire in a new tab.
- [x] Live-like local database QA confirms a JewelLink Director is provisioned as
  `store_owner`, a Manager as location-scoped `manager`, and a Student as an
  applicant with no store membership.
- [x] The one-time SSO exchange completed through both running products, left no
  outstanding authorization code, and rendered the provisioned organization,
  location, and user identity rather than demo branding.
- [x] Pausing the local JewelLink company removes both launchers and direct SSO
  fails closed on a branded retained-data recovery screen.
- [x] Public careers, application, résumé, preview-token, SEO, consent, and aggregate-analytics audits pass.
- [x] Billing, notification wiring, Firebase, legal-source, and invalid-input audits pass. The config-exposure audit passes secret/public-data checks and intentionally holds on explicit live-email acknowledgement.
- [x] Local SSO QA database has migrations `0012` through `0018` applied.
- [x] Production role-readiness audit confirms active users, manager mappings,
  applicants, and at least one active store owner per active store are valid.
- [x] Temporary applications, résumé files, and synthetic analytics used during QA were removed.

## Blocking gates before traffic is moved

Read-only baseline: `premerge-production-baseline.md`. Backup and rollback
evidence template: `production-backup-and-rollback.md`.

- [ ] Apply the seven pending JewelHire migrations, `0012` through
  `0018_public_careers_daily_events.sql`, with the guarded candidate-image job.
  Migrations `0017` and `0018` must exist before the new application-detail and
  analytics queries run.
- [ ] Apply the three pending JewelLink integration migrations in order:
  `20260712043000_add_jewelhire_sso_codes`,
  `20260712052000_add_jewelhire_hire_provisioning`, and
  `20260712053000_add_jewelhire_jewelcert_results`.
- [ ] Obtain and store a privileged JewelLink `MIGRATION_DATABASE_URL`. The
  current runtime database user cannot create schema objects. A 2026-07-13
  read-only ledger comparison found 109 applied repository migrations, zero
  failed rows, no applied-but-missing drift, and only the three reviewed
  JewelHire integration migrations pending. Re-run and record that comparison
  against the exact no-traffic candidate before executing the migration job.
- [ ] Record the JewelLink production dependency audit disposition. On
  2026-07-13, `npm audit --omit=dev --audit-level=high` passes with zero high or
  critical findings and reports three moderate advisories in Prisma tooling.
  Keep the report with the release evidence and do not broaden the dependency
  upgrade inside this cutover.
- [ ] Configure `JEWELLINK_URL=https://ai.jewellink.com`, `JEWELLINK_SSO_SHARED_SECRET`, and `JEWELLINK_INTEGRATION_SHARED_SECRET` on the JewelHire Cloud Run service. They are absent from the current production revision and no matching Secret Manager entries exist yet.
- [ ] Configure the matching high-entropy SSO and integration secrets on the production JewelLink service and verify its JewelHire callback/base URL points to `https://app.jewelhire.com`.
- [ ] Deploy the current release candidate. The currently deployed revision redirects `/privacy` and `/terms` to login; the local release candidate returns `200` for both.
- [ ] Explicitly approve the production email posture. `EMAIL_NOTIFICATIONS_ENABLED=true` and a secret-backed Postmark token are currently mounted; `POSTMARK_DRY_RUN` is not mounted, so notifications are live rather than dry-run.
- [ ] Send one controlled internal Postmark smoke for application confirmation and one manager notification, then verify delivery and metadata scrubbing. Do not use a real applicant during this test.
- [ ] Exercise one Stripe test-mode checkout and signed webhook reconciliation against the release candidate. The code/readiness audit is green, but no checkout mutation was performed in this QA pass.

## Deployment order

1. Back up both production databases and record both current Cloud Run revisions.
2. Provision the integration secrets and dedicated JewelLink migration identity
   using `production-integration-provisioning.md`.
3. Deploy JewelLink from the reviewed `origin/main` with the JewelHire rollout
   master switch disabled. Its script creates a no-traffic candidate, applies
   migrations from that candidate's immutable image, smokes `/login`, and only
   then moves traffic.
4. Mount the JewelLink URL and both shared secrets on JewelHire with no traffic.
5. Decide whether launch email should be dry-run or live and mount
   `POSTMARK_DRY_RUN` explicitly.
6. Run the manual JewelHire production workflow. It creates a no-traffic
   candidate, applies migrations from the exact candidate image, smokes public
   routes, and only then moves traffic.
7. Create a second JewelLink no-traffic candidate with `pilot` mode and one
   approved company ID. Run the full SSO and role smoke against its tagged URL
   before explicitly promoting it.
8. Run the post-deploy checks below. Roll traffic back to the recorded revision
   if any blocking check fails.

## Required post-deploy smoke

- [ ] `/privacy`, `/terms`, `/signup`, and `/signup/store` return `200` without a session.
- [ ] Unauthenticated private APIs return `401`; a store owner cannot access platform-admin APIs.
- [ ] JewelLink Director opens JewelHire in a new tab and lands as store owner.
- [ ] JewelLink Manager lands as manager, can access scoped hiring pages, and cannot access billing, ownership, integrations, or user administration.
- [ ] JewelLink Student lands in the applicant portal and cannot access store or admin routes.
- [ ] A published careers page loads on mobile with no horizontal overflow and its open job can reach step 2 of the application flow.
- [ ] A private draft preview is `noindex`, cannot submit, and a modified preview token returns `404`.
- [ ] One controlled application with a small PDF résumé creates exactly one application; retrying the same idempotency key creates no duplicate.
- [ ] The résumé returns `401` publicly and downloads only for an authorized user in the same store/location scope.
- [ ] The careers dashboard shows real page views, apply starts, submissions, locations, and activity with no demo counts.
- [ ] A JewelHire hire sync creates or links the expected JewelLink user and records the external ID.
- [ ] A JewelCert invitation and completed result reach JewelLink and remain retryable on a simulated delivery failure.

## Rollback conditions

Roll back traffic immediately for cross-store data exposure, role escalation, invalid SSO role mapping, repeated application creation, public résumé access, migration errors, sustained 5xx responses, or notification delivery to unintended recipients.
