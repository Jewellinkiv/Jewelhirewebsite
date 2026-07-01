# JewelHire Launch Gap Report

Source repo: `/Users/williamiv/Desktop/Jewelhire`
Production app: `https://app.jewelhire.com`
Google Cloud project: `jewelhire-prod-20260626`
Last updated: 2026-07-01

## Current Launch State

- Cloud Run is serving Desktop JewelHire revision `jewelhire-00040-x7v` at 100% traffic after database password rotation.
- `https://app.jewelhire.com/login` is publicly reachable over HTTPS and served by Google Frontend.
- `DATABASE_URL` is mounted from Google Secret Manager secret `jewelhire-database-url` version `latest`.
- The hosted login screen now includes standard email/password login plus Google/Firebase fallback.
- The production database has `0003_password_credentials.sql` applied.
- Password auth stores salted scrypt hashes in `password_credentials`; no plaintext passwords are stored.
- Temporary smoke credentials are stored in Google Secret Manager secret `jewelhire-smoke-test-credentials`.
- No database credential values are committed to the repo or written in this report.

## Evidence

Commands run on 2026-07-01:

```bash
npm run build
npm audit --audit-level=moderate
npm run qa:auth -- --skip-cloud-setup
npm run qa:live
npm run qa:security:live
npm run qa:invalid-input
npm run qa:browser
npm run qa:notifications
npm run qa:postmark
npm run qa:billing
npm run qa:handoff
npm run qa:signup-policy
npm run qa:provider-handoff
npm run qa:manual-smoke-handoff
npm run db:migrate:status
gcloud run services describe jewelhire --project jewelhire-prod-20260626 --region us-central1 --format='value(status.latestReadyRevisionName,status.traffic[0].percent)'
```

Results:

- Build passed; latest local rerun compiled successfully with TypeScript on 2026-07-01.
- Dependency audit passed with 0 vulnerabilities at `moderate` threshold.
- Auth readiness passed, including live standard email/password form detection, Google fallback visibility, invalid Firebase token rejection, and invalid password redirect behavior.
- Live browser QA passed against `https://app.jewelhire.com` with 15 checks, 0 failures, and 0 warnings.
- Live security release audit passed against `https://app.jewelhire.com`, including security headers, locked private APIs, invalid Firebase token rejection, and secret-exposure checks.
- Invalid-input and abuse audit passed against `https://app.jewelhire.com`, including malformed application, auth failure, unsigned webhook, and unauthenticated billing mutation probes with no 5xx responses.
- Browser Phase 1 smoke passed locally with route, public apply, store interview, applicant portal, admin company, workflow API, and privacy checks.
- Notification readiness passed with a send adapter present, seven expected triggers wired, zero blockers, and zero warnings.
- Postmark safety passed with live sends disabled during the default QA loop.
- Billing readiness passed, including Stripe webhook, reconciliation, discount/promotion support, and live auth-boundary checks.
- Provider handoff audit passed; dashboard verification checklist is documented, forbids live provider actions by default, and links the latest safe Postmark/Billing evidence.
- Signup policy audit passed; public self-serve signup is disabled for this build and `/signup` is not public.
- Manual browser smoke handoff audit passed; role checklist and evidence template are documented.
- Invalid password attempts redirect back to `https://app.jewelhire.com/login`.
- Database migration status shows `0001_phase1_core.sql`, `0002_applicant_notification_prefs.sql`, and `0003_password_credentials.sql` applied.
- Cloud Run revision `jewelhire-00040-x7v` is latest ready and serving 100% traffic; hosted login returned HTTP 200 through Google Frontend on 2026-07-01.
- Config exposure audit passed with Cloud Run env mount checks and no public private-env exposure.
- Cloud-backed Postmark safety audit passed with the token secret-backed and live sends disabled during the default QA loop.
- Secret Manager-backed tester handoff audit can read the smoke-credential secret, validates all five smoke users, and does not print passwords.
- Latest auth readiness artifact: `docs/qa-runs/auth-readiness-2026-07-01T11-42-53-280Z/auth-readiness-report.md`.
- Latest config exposure artifact: `docs/qa-runs/config-exposure-2026-07-01T11-42-53-276Z/config-exposure-report.md`.
- Latest Postmark safety artifact: `docs/qa-runs/postmark-safety-2026-07-01T11-42-53-275Z/postmark-safety-report.md`.
- Latest local browser smoke artifact: `docs/qa-runs/2026-07-01T07-47-03-711Z/browser-smoke-report.md`.
- Latest live QA artifact: `docs/qa-runs/live-2026-07-01T11-58-57-967Z/report.md`.
- Latest live security artifact: `docs/qa-runs/security-release-2026-07-01T08-41-03-153Z/security-release-report.md`.
- Latest invalid-input artifact: `docs/qa-runs/invalid-input-2026-07-01T08-59-12-641Z/invalid-input-report.md`.
- Latest notification readiness artifact: `docs/qa-runs/notification-readiness-2026-07-01T11-05-56-878Z/notification-readiness-report.md`.
- Latest billing readiness artifact: `docs/qa-runs/billing-readiness-2026-07-01T11-23-13-218Z/billing-readiness-report.md`.
- Latest provider handoff artifact: `docs/qa-runs/provider-handoff-2026-07-01T11-44-43-768Z/provider-handoff-report.md`.
- Latest signup policy artifact: `docs/qa-runs/signup-policy-2026-07-01T07-11-01-215Z/signup-policy-report.md`.
- Latest manual smoke handoff artifact: `docs/qa-runs/manual-smoke-handoff-2026-07-01T11-23-44-371Z/manual-smoke-handoff-report.md`.
- Latest tester handoff artifact: `docs/qa-runs/tester-handoff-2026-07-01T11-59-39-383Z/tester-handoff-report.md`.

## Remaining Launch Gaps

1. Rotate smoke/test passwords before handing them to external testers if broader access is needed.
2. Decide whether a future release adds public self-serve signup. Current launch stance is invite/admin-created accounts only.
3. Run manual browser smoke with real testers using `docs/manual-browser-smoke-handoff.md` and the Secret Manager smoke credentials.
4. Confirm Postmark sender/domain and Stripe products/webhooks in provider dashboards before accepting live customer traffic. Use `docs/provider-readiness-handoff.md`.
5. Rerun the cloud-backed verification bundle in `docs/cloud-reauth-runbook.md` after any deploy, secret rotation, or provider config change.

## Password Credential Setup

Use an existing active JewelHire user email. Pass the temporary password through an environment variable so it is not stored in shell history:

```bash
DATABASE_URL="$(gcloud secrets versions access latest --secret=jewelhire-database-url --project=jewelhire-prod-20260626)" \
JEWELHIRE_OPERATOR_PASSWORD="<temporary-password>" \
npm run ops:password-credential -- --email "<user-email>"
```

Required smoke users:

- JewelHire admin
- Store owner
- Applicant

Current smoke credentials:

```bash
gcloud secrets versions access latest --secret=jewelhire-smoke-test-credentials --project=jewelhire-prod-20260626
```

Configured smoke identities:

- Admin: `william@jewelrysalesacademy.com`
- Store owner: `jordan@email.com`
- Store owner: `leo@harborgold.com`
- Manager: `maria@email.com`
- Applicant: `maya.chen@email.com`

## Browser QA Smoke

Tester handoff: `docs/qa-tester-handoff.md`
Provider handoff: `docs/provider-readiness-handoff.md`
Manual smoke handoff: `docs/manual-browser-smoke-handoff.md`
Cloud reauth runbook: `docs/cloud-reauth-runbook.md`

Safe to rerun without local `gcloud` access:

```bash
npm run qa:auth -- --skip-cloud-setup
npm run qa:live
npm run qa:security:live
npm run qa:notifications
npm run qa:billing
npm run qa:signup-policy
npm run qa:provider-handoff
npm run qa:manual-smoke-handoff
```

Run with active local `gcloud` access:

```bash
npm run qa:config
npm run qa:postmark
npm run qa:auth -- --expect-firebase
npm run qa:handoff
```

Manual browser smoke:

- Login page loads at `https://app.jewelhire.com/login`.
- Admin can sign in with email/password and reach admin pages.
- Store owner can sign in with email/password and reach store dashboard, jobs, pipeline, team, settings, and public page management.
- Applicant can sign in with email/password and reach portal profile, resume, applications, interviews, invites, and training.
- Google/Firebase sign-in remains visible as fallback.
- Invalid password shows the login error and stays on `app.jewelhire.com`.
- Postmark notifications are simulated or verified in provider dashboard without sending unintended live emails.
- Stripe billing readiness is verified without creating unintended live charges.
