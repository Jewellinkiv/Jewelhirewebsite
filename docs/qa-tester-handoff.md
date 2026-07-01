# JewelHire QA Tester Handoff

Production app: `https://app.jewelhire.com`
Source repo: `/Users/williamiv/Desktop/Jewelhire`
Cloud Run project: `jewelhire-prod-20260626`
Current production revision: `jewelhire-00040-x7v`
Updated: 2026-07-01

## Build Under Test

- Hosted app: `https://app.jewelhire.com`
- Login path: `https://app.jewelhire.com/login`
- Code baseline validated: `a2a91cd Add manual smoke handoff`
- Database: PlanetScale Postgres via Secret Manager secret `jewelhire-database-url`

Do not test from `/Users/williamiv/Documents/Jewelhire`; that repo was removed and is not the launch source of truth.

## Credentials

Smoke credentials are stored in Google Secret Manager. Do not paste passwords into tickets, docs, Slack, screenshots, or test evidence.

```bash
gcloud secrets versions access latest --secret=jewelhire-smoke-test-credentials --project=jewelhire-prod-20260626
```

Accounts to smoke:

| Role | Email | Expected Access |
| --- | --- | --- |
| JewelHire admin | `william@jewelrysalesacademy.com` | Admin overview, companies, billing, assessments, support, analytics |
| Store owner | `jordan@email.com` | Sissy's store dashboard, pipeline, jobs, interviews, team, settings, public page |
| Store owner | `leo@harborgold.com` | Harbor store scope only |
| Manager | `maria@email.com` | Store-side access for Sissy's |
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

Latest local and production checks passed:

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
npm run qa:config
npm run qa:handoff
npm run qa:signup-policy
npm run qa:provider-handoff
npm run qa:manual-smoke-handoff
npm run db:readiness
```

Relevant artifacts:

- Live browser QA: `docs/qa-runs/live-2026-07-01T05-06-15-175Z/`
- Live security release audit: `docs/qa-runs/security-release-2026-07-01T05-23-00-528Z/`
- Invalid-input and abuse audit: `docs/qa-runs/invalid-input-2026-07-01T05-46-04-892Z/`
- Browser smoke: `docs/qa-runs/2026-07-01T03-28-48-061Z/`
- Auth readiness: `docs/qa-runs/auth-readiness-2026-07-01T07-29-00-620Z/`
- Config exposure: `docs/qa-runs/config-exposure-2026-07-01T03-33-35-385Z/`
- Notification readiness: `docs/qa-runs/notification-readiness-2026-07-01T06-17-36-290Z/`
- Billing readiness: `docs/qa-runs/billing-readiness-2026-07-01T06-35-08-144Z/`
- Tester handoff audit: `docs/qa-runs/tester-handoff-2026-07-01T03-54-42-388Z/`
- Signup policy audit: `docs/qa-runs/signup-policy-2026-07-01T07-11-01-215Z/`
- Provider handoff audit: `docs/qa-runs/provider-handoff-2026-07-01T06-53-32-362Z/`
- Manual smoke handoff audit: `docs/qa-runs/manual-smoke-handoff-2026-07-01T04-48-06-889Z/`

Current local `gcloud` credentials need interactive reauthentication before Secret Manager-backed audits can be rerun. The live browser smoke and non-secret manual smoke handoff audit passed on 2026-07-01 without provider side effects.

## Pass Criteria

- Every role can sign in with email/password.
- Admin, store, and applicant home routes load without blank screens or server errors.
- Private APIs reject unauthenticated access.
- Store data remains scoped to the correct store.
- Postmark and Stripe dashboards are ready for launch, with no unintended sends or charges.

## Known Decisions

- Public self-serve signup is not enabled for this build.
- Launch account creation is admin/invite-created plus password credentials.
- Broader external tester distribution should use rotated smoke passwords.
