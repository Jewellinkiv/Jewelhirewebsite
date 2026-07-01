# Manual Browser Smoke Handoff

Production app: `https://app.jewelhire.com`
Tester credentials: Google Secret Manager secret `jewelhire-smoke-test-credentials`
Updated: 2026-07-01

This checklist is for human browser QA with the smoke users. Do not paste passwords into evidence. Do not make live provider-side changes, create charges, or send live email.

## Before Testing

- Retrieve credentials from Secret Manager only:

```bash
gcloud secrets versions access latest --secret=jewelhire-smoke-test-credentials --project=jewelhire-prod-20260626
```

- Use Chrome, Safari, or Edge in a fresh profile or private window.
- Record browser name, viewport, tester, start time, and app revision.
- Keep Postmark and Stripe actions read-only unless separately approved.

## Login Smoke

For each role:

- Open `/login`.
- Confirm email/password fields are visible.
- Confirm Google/Firebase fallback remains visible.
- Sign in with the smoke credential.
- Confirm expected landing page loads.
- Sign out and confirm `/login` is shown again.
- Try one invalid password and confirm the URL remains on `app.jewelhire.com`.

## Role Routes

### JewelHire Admin

- `/admin`
- `/admin/companies`
- `/admin/companies/co-sissys`
- `/admin/billing`
- `/admin/assessments`
- `/admin/support`
- `/admin/analytics`

### Store Owner

- `/`
- `/pipeline`
- `/applicants`
- `/jobs`
- `/interviews`
- `/send-jewelcert`
- `/cert-invitations`
- `/gemmatch`
- `/team`
- `/roster`
- `/public-page`
- `/settings`

### Applicant

- `/portal`
- `/portal/applications`
- `/portal/invites`
- `/portal/interviews`
- `/portal/profile`
- `/portal/resume`
- `/portal/training`

## Privacy Checks

- Sissy's store owner should see Sissy's data.
- Harbor store owner should see Harbor data.
- Store owners should not see another store's private applicants.
- Applicant portal should not show internal store ratings, reviews, or private notes.

## Evidence Template

Copy this block into the QA ticket or release checklist:

```text
Build/revision:
Tester:
Browser:
Viewport:
Start time:
End time:

Admin login/routes: PASS/FAIL
Store owner login/routes: PASS/FAIL
Applicant login/routes: PASS/FAIL
Invalid password behavior: PASS/FAIL
Store privacy: PASS/FAIL
Provider dashboards read-only: PASS/FAIL

Issues found:
Screenshots/videos:
Retest result:
```

## Stop Conditions

- Any role cannot sign in with email/password.
- Private store data leaks across stores.
- Applicant sees internal store-only notes or rating language.
- A page renders blank, returns a server error, or traps navigation.
- A tester is prompted to trigger live email sends or live payments unexpectedly.
