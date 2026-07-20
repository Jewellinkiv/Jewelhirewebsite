# JewelHire QA Tester Handoff

Production app: `https://app.jewelhire.com`
Source repo: `/Users/sterling/Desktop/jewelhire`
Cloud Run project: `jewelhire-prod-20260626`
Current production revision: `jewelhire-00111-dup`
Updated: 2026-07-20

## Build Under Test

- Hosted app: `https://app.jewelhire.com`
- Login path: `https://app.jewelhire.com/login`
- Source commit: `0662dfc Update brace expansion audit dependency`
- Database: PlanetScale Postgres via Secret Manager secret `jewelhire-database-url`

Do not test from `/Users/williamiv/Documents/Jewelhire`; that repo was removed and is not the launch source of truth.

## Credentials

Smoke credentials are stored in Google Secret Manager. Do not paste passwords into tickets, docs, Slack, screenshots, or test evidence.

Public self-serve signup is not enabled for the production pilot.

```bash
gcloud secrets versions access latest --secret=jewelhire-smoke-test-credentials --project=jewelhire-prod-20260626
```

Accounts to smoke:

| Role | Email | Expected Access |
| --- | --- | --- |
| JewelHire admin | `william@jewellink.com` | Admin overview, companies, billing, assessments, support, analytics |
| Store owner | `jordan@email.com` | Sissy's store dashboard, pipeline, jobs, interviews, team, settings, public page |
| Applicant | `maya.chen@email.com` | Applicant portal profile, resume, applications, interviews, invites, training |

## Smoke Scope

Detailed manual checklist: `docs/manual-browser-smoke-handoff.md`

### Login

- Visit `/login`.
- Confirm email/password fields are visible before Google/Firebase fallback.
- Sign in with each smoke user.
- Confirm invalid password rejects and remains on `app.jewelhire.com`.
- Confirm logout returns to `/login`.

### Admin

- Open `/admin`.
- Open companies list and Sissy's company detail.
- Confirm billing, assessments, support, and analytics pages load.
- Do not create live billing sessions or provider-side changes.

### Store Owner

- Open dashboard, pipeline, applicants, jobs, interviews, JewelCert, GemMatch, team, roster, public page, and settings.
- Create only clearly marked QA records if mutation testing is required.
- Verify Sissy's user cannot see Harbor-only data unless using the admin account.

### Applicant

- Open portal home, applications, invites, interviews, profile, resume, and training.
- Confirm applicant pages do not expose internal store rating/review language.
- Avoid changing real candidate contact details unless the record is a designated QA profile.

### Provider Readiness

- Detailed checklist: `docs/provider-readiness-handoff.md`
- Postmark: confirm sender/domain status, templates, recent event logs, and suppressions in the dashboard.
- Stripe: confirm product/price/webhook readiness in dashboard without making live charges.
- Live sends and live charges require explicit product-owner approval.

## Automation Evidence

Latest checks with passing evidence and no current `gcloud` dependency:

```bash
npm run build
npm audit --audit-level=moderate
npm run qa:auth -- --skip-cloud-setup
npm run qa:live
npm run qa:security:live
npm run qa:invalid-input
npm run qa:browser
npm run qa:notifications
npm run qa:billing
npm run qa:signup-policy
npm run qa:provider-handoff
npm run qa:manual-smoke-handoff
```

Latest local build rerun passed on 2026-07-01 with TypeScript compilation.

Cloud-backed checks rerun with active local `gcloud` access:

```bash
npm run qa:config
npm run qa:postmark
npm run qa:auth -- --expect-firebase
npm run qa:handoff
npm run qa:roles
npm run qa:pilot-readiness
```

2026-07-20 result summary:

- `qa:auth -- --expect-firebase`, `qa:handoff`, and `qa:roles` passed.
- `qa:config` and `qa:postmark` verified the live configuration, but remain
  held until live email sends are explicitly acknowledged for the pilot.
- `qa:pilot-readiness` verified the shared JewelHire/JewelLink secrets without
  printing values, but remains held because JewelLink pilot rollout flags are
  not enabled/configured yet.

Relevant artifacts:

- Live browser QA: `docs/qa-runs/live-2026-07-01T12-17-26-249Z/`
- Live security release audit: `docs/qa-runs/security-release-2026-07-01T12-19-58-907Z/`
- Invalid-input and abuse audit: `docs/qa-runs/invalid-input-2026-07-01T08-59-12-641Z/`
- Browser smoke: `docs/qa-runs/2026-07-01T07-47-03-711Z/`
- Auth readiness: `docs/qa-runs/auth-readiness-2026-07-01T12-17-25-995Z/`
- Config exposure: `docs/qa-runs/config-exposure-2026-07-01T11-42-53-276Z/`
- Postmark safety: `docs/qa-runs/postmark-safety-2026-07-01T11-42-53-275Z/`
- Production pilot readiness: `docs/qa-runs/production-pilot-readiness-2026-07-20T21-41-15-779Z/`
- Auth readiness rerun: `docs/qa-runs/auth-readiness-2026-07-20T21-41-42-178Z/`
- Config exposure rerun: `docs/qa-runs/config-exposure-2026-07-20T21-41-24-877Z/`
- Role readiness rerun: `docs/qa-runs/role-readiness-2026-07-20T21-42-09-766Z/`
- Tester handoff rerun: `docs/qa-runs/tester-handoff-2026-07-20T21-44-00-052Z/`
- Notification readiness: `docs/qa-runs/notification-readiness-2026-07-01T11-05-56-878Z/`
- Billing readiness: `docs/qa-runs/billing-readiness-2026-07-01T11-23-13-218Z/`
- Tester handoff audit: `docs/qa-runs/tester-handoff-2026-07-01T12-18-09-993Z/`
- Signup policy audit: `docs/qa-runs/signup-policy-2026-07-01T07-11-01-215Z/`
- Provider handoff audit: `docs/qa-runs/provider-handoff-2026-07-01T11-44-43-768Z/`
- Manual smoke handoff audit: `docs/qa-runs/manual-smoke-handoff-2026-07-01T11-23-44-371Z/`

Local `gcloud` access was refreshed on 2026-07-20, and Secret Manager-backed audits, Cloud Run revision checks, Cloud Run config exposure audits, and Cloud Run Postmark env-gate checks can now be rerun. If access expires again, use `docs/cloud-reauth-runbook.md`.

Cloud reauth steps and post-reauth verification commands are documented in `docs/cloud-reauth-runbook.md`.

## Pass Criteria

- Every role can sign in with email/password.
- Admin, store, and applicant home routes load without blank screens or server errors.
- Private APIs reject unauthenticated access.
- Store data remains scoped to the correct store.
- Postmark and Stripe dashboards are ready for launch, with no unintended sends or charges.

## Known Decisions

- Applicant self-service signup and payment-gated store signup are enabled; do not complete a live store payment during routine QA.
- Launch account creation is admin/invite-created plus password credentials.
- Broader external tester distribution should use rotated smoke passwords.
