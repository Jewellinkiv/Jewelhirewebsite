# JewelHire Launch Gap Report

Source repo: `/Users/williamiv/Desktop/Jewelhire`
Production app: `https://app.jewelhire.com`
Google Cloud project: `jewelhire-prod-20260626`
Last updated: 2026-07-01

## Current Launch State

- Cloud Run is serving Desktop JewelHire revision `jewelhire-00040-x7v` at 100% traffic after database password rotation.
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

- Build passed.
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
- Latest auth readiness artifact: `docs/qa-runs/auth-readiness-2026-07-01T07-29-00-620Z/auth-readiness-report.md`.
- Latest local browser smoke artifact: `docs/qa-runs/2026-07-01T07-47-03-711Z/browser-smoke-report.md`.
- Latest live QA artifact: `docs/qa-runs/live-2026-07-01T05-06-15-175Z/report.md`.
- Latest live security artifact: `docs/qa-runs/security-release-2026-07-01T05-23-00-528Z/security-release-report.md`.
- Latest invalid-input artifact: `docs/qa-runs/invalid-input-2026-07-01T05-46-04-892Z/invalid-input-report.md`.
- Latest notification readiness artifact: `docs/qa-runs/notification-readiness-2026-07-01T06-17-36-290Z/notification-readiness-report.md`.
- Latest billing readiness artifact: `docs/qa-runs/billing-readiness-2026-07-01T06-35-08-144Z/billing-readiness-report.md`.
- Latest provider handoff artifact: `docs/qa-runs/provider-handoff-2026-07-01T06-53-32-362Z/provider-handoff-report.md`.
- Latest signup policy artifact: `docs/qa-runs/signup-policy-2026-07-01T07-11-01-215Z/signup-policy-report.md`.
- Cloud Run revision re-check with `gcloud run services describe` is currently blocked by local `gcloud` reauthentication; hosted HTTP/browser smoke remains passing.
- Secret Manager-backed handoff audit re-run is also blocked until `gcloud auth login` is refreshed; the non-secret manual smoke handoff audit still passes.

## Remaining Launch Gaps

1. Rotate smoke/test passwords before handing them to external testers if broader access is needed.
2. Decide whether a future release adds public self-serve signup. Current launch stance is invite/admin-created accounts only.
3. Run manual browser smoke with real testers using `docs/manual-browser-smoke-handoff.md` and the Secret Manager smoke credentials.
4. Confirm Postmark sender/domain and Stripe products/webhooks in provider dashboards before accepting live customer traffic. Use `docs/provider-readiness-handoff.md`.

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

Run after launch credentials are created:

```bash
npm run qa:auth -- --skip-cloud-setup
npm run qa:live
npm run qa:security:live
npm run qa:notifications
npm run qa:postmark
npm run qa:billing
npm run qa:handoff
npm run qa:signup-policy
npm run qa:provider-handoff
npm run qa:manual-smoke-handoff
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
