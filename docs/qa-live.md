# Live Browser QA Automation - `scripts/qa-live.mjs`

Playwright-driven QA against the deployed Desktop JewelHire Next app at `https://app.jewelhire.com`.

## Source Of Truth

The live app must be deployed from `/Users/williamiv/Desktop/Jewelhire`.

Do not use `/Users/williamiv/Documents/Jewelhire` for JewelHire source work unless explicitly redirected. Do not use Linkd or Linkd V2 Google Cloud projects for JewelHire. The production Cloud Run project is `jewelhire-prod-20260626`.

## Live Safety

This harness is intentionally non-destructive:

- Verifies public pages and auth boundaries.
- Starts, but does not complete, Google OAuth.
- Does not submit applications, send email, create checkout sessions, or click live provider actions.
- Uses Playwright WebKit by default as the closest automation target to Safari.

## Run

```bash
npm run qa:live
npm run qa:live:headed
node scripts/qa-live.mjs --base=https://app.jewelhire.com
```

## What It Checks

1. Root redirects to `/login`.
2. `/login` is public and renders the JewelHire sign-in experience.
   - Must include standard email/password login.
   - Google/Firebase remain fallback sign-in methods.
3. Invalid email/password attempts reject safely and stay on `app.jewelhire.com`.
4. Public careers and application pages load at `/careers/:storeSlug` and `/careers/:storeSlug/apply/:jobId`.
5. Privacy and Terms pages are public.
6. `/api/me` and private store APIs reject unauthenticated requests.
7. Google OAuth start redirects to Google.
8. Firebase session endpoint rejects invalid tokens in the security audit.
9. Desktop and mobile screenshots render without console errors.

Current production state as of 2026-07-01:

- Cloud Run revision `jewelhire-00042-gsz` is live at 100% traffic after admin login routing fix.
- `npm run qa:live` passes against `https://app.jewelhire.com` with 15 checks, 0 failures, and 0 warnings. Latest artifact: `docs/qa-runs/live-2026-07-01T12-17-26-249Z/`.
- `npm run qa:security:live` passes against `https://app.jewelhire.com`. Latest artifact: `docs/qa-runs/security-release-2026-07-01T12-19-58-907Z/`.
- `npm run qa:invalid-input` passes against `https://app.jewelhire.com`. Latest artifact: `docs/qa-runs/invalid-input-2026-07-01T08-59-12-641Z/`.
- `npm run qa:auth -- --skip-cloud-setup` passes against `https://app.jewelhire.com`.
- `npm run qa:browser` passes locally with route, role, workflow API, and privacy checks. Latest artifact: `docs/qa-runs/2026-07-01T07-47-03-711Z/`.
- Smoke credentials for admin, store owner, manager, and applicant are in Secret Manager secret `jewelhire-smoke-test-credentials`.
- Cloud Run CLI revision re-check currently requires local `gcloud auth login`; use live QA plus provider dashboards until CLI auth is refreshed.

## Related Release Checks

```bash
npm run qa:security:live
npm run qa:auth -- --expect-firebase
npm run qa:billing
npm run qa:notifications
npm run build
npm audit --audit-level=moderate
```

`npm run qa:auth -- --expect-firebase` verifies standard email/password login markup, the JewelHire Firebase login code path, and the Firebase/GCP setup behind it without printing config values.
`npm run qa:notifications` is static and safe. It inventories notification promises, expected email trigger points, and whether a real send adapter exists. It does not send email.
`npm run qa:billing` is also safe. It checks billing auth boundaries and Stripe readiness without creating checkout sessions, charges, discounts, or webhooks.

## Output

`docs/qa-runs/live-<timestamp>/` contains `report.md`, `report.json`, and screenshots. The command exits non-zero on hard failures.
