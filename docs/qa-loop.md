# JewelHire QA Loop

The live-readiness automation should run from the Desktop source of truth:

```bash
cd /Users/williamiv/Desktop/Jewelhire
QA_LOOP_TIER=hosted npm run qa:loop
```

The runner fails immediately if it is started from any other folder, so `/Users/williamiv/Documents/Jewelhire` cannot accidentally become the deployment or QA source again.

## Tiers

- `preflight`: production build, dependency audit, notification inventory, secret-pattern scan.
- `local`: preflight-style checks plus local API and browser role smoke.
- `hosted`: live app smoke, live security, environment/config exposure, invalid-input and abuse probes, Firebase/Google auth setup, Stripe billing readiness, Postmark/email notification readiness, Postmark live-send safety, secret-pattern scan, and Cloud Run revision check.
- `standard`: production build and dependency audit plus the hosted tier.
- `release`: standard tier plus database migration status, database readiness, and real-user role/session readiness.

## Live Safety

The loop does not submit valid applications, enable email sends, create checkout sessions, trigger charges, mutate Stripe discounts, or print secret values. The invalid-input audit only sends malformed or unauthenticated requests. The secret-pattern scan only reports whether matches exist.

Firebase/Google auth setup is part of `hosted`, `standard`, and `release` through:

```bash
npm run qa:auth -- --expect-firebase
```

That check verifies the Firebase project setup, Google provider, authorized app domain, Cloud Run Firebase env mounts, live login UI, and invalid-token rejection without writing config values or tokens to artifacts.

## Negative Security Probes

```bash
npm run qa:invalid-input
```

This audit verifies malformed public application requests, unknown public store/job submissions, Firebase session failures, Stripe webhook method/signature failures, and protected billing mutations without a session. Bad input should return controlled `4xx` responses with structured errors, not `5xx` exceptions or side-effect markers.

## Config Exposure

```bash
npm run qa:config
```

This audit verifies `.env` ignore rules, Cloud Run mounted env names, required Firebase/auth/database/webhook config presence, private runtime variables being secret-backed when mounted, live email send gating, and public HTML not exposing private env names. It writes env names and mount types only; it never writes values.

## Postmark Safety

```bash
npm run qa:postmark
```

This audit verifies the notification adapter's disabled and dry-run gates, central Postmark send helper, token/stream metadata handling, Cloud Run token secret mount, sender/stream config presence, and that live email sends are not active during the default QA loop. It does not call Postmark or print token, sender, stream, or recipient values.

## Role And Session Readiness

```bash
npm run qa:roles
```

This audit verifies live auth is required, Cloud Run is using Postgres storage, staging session overrides are disabled, staging override headers are ignored by live APIs, admin allowlist config is secret-backed, and the production database has active users plus store manager login mappings. It reports counts and store ids only; it never writes emails or secrets.
