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
npm run qa:auth -- --skip-cloud-setup
npm run qa:browser
npm run qa:notifications
npm run qa:billing
npm run qa:handoff
npm run db:migrate:status
gcloud run services describe jewelhire --project jewelhire-prod-20260626 --region us-central1 --format='value(status.latestReadyRevisionName,status.traffic[0].percent)'
```

Results:

- Build passed.
- Auth readiness passed, including live standard email/password form detection.
- Browser Phase 1 smoke passed locally with role-scoped store/admin staging sessions.
- Notification readiness passed with a send adapter present and zero blockers.
- Billing readiness passed, including Stripe webhook and auth-boundary checks.
- Invalid password attempts redirect back to `https://app.jewelhire.com/login`.
- Database migration status shows `0001_phase1_core.sql`, `0002_applicant_notification_prefs.sql`, and `0003_password_credentials.sql` applied.

## Remaining Launch Gaps

1. Rotate smoke/test passwords before handing them to external testers if broader access is needed.
2. Decide whether launch signup remains invite/admin-created only or adds a public self-serve signup flow.
3. Run manual browser smoke with real testers using the Secret Manager smoke credentials.
4. Confirm Postmark sender/domain and Stripe products/webhooks in provider dashboards before accepting live customer traffic.

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

Run after launch credentials are created:

```bash
npm run qa:auth -- --skip-cloud-setup
npm run qa:live
npm run qa:security:live
npm run qa:notifications
npm run qa:billing
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
