# Production Integration Smoke Preflight Audit

This audit checks whether production is clean and linked before running the
mutating authenticated SSO, hire, and JewelCert pilot smokes.

It is read-only. It does not call bearer-authenticated mutation endpoints,
create users, send email, run SSO, hire anyone, update roles, or write to either
production database.

## Command

Run from the JewelHire repository on a machine with authenticated `gcloud`
access to both production projects:

```bash
npm run qa:integration-smoke-preflight -- \
  --jewelhire-project=jewelhire-prod-20260626 \
  --jewelhire-region=us-central1 \
  --jewelhire-service=jewelhire \
  --jewellink-project=academy-460316 \
  --jewellink-region=us-central1 \
  --jewellink-service=jewellink-dev \
  --jewellink-db-secret=DATABASE_URL \
  --pilot-company-id=comp_1 \
  --pilot-location-ids=loc_1,loc_2,loc_3,loc_4,loc_5,loc_6
```

The report is written under `docs/qa-runs/integration-smoke-preflight-*` unless
`--artifacts=<dir>` is supplied.

## What It Proves

- JewelHire and JewelLink integration URLs and shared-secret env vars are
  present and secret-backed where expected.
- JewelLink hire email mode is explicit, and allowlist mode has an allowlist.
- JewelHire has an active linked pilot company/store for JewelLink `comp_1`.
- JewelHire linked location IDs exactly match the pilot roster.
- JewelHire has no unresolved outbound hire sync rows for the pilot.
- JewelHire has no unresolved outbound JewelCert result sync rows for the
  pilot.
- JewelLink has no failed or stale inbound hire provisioning rows for the
  pilot.
- Unauthenticated production mutation endpoints reject with `401`.

## Current Evidence

The 2026-07-20 production run passed at
`docs/qa-runs/integration-smoke-preflight-2026-07-20T23-29-09-249Z/`.

## Secret Handling

The audit reads database URL and integration secret metadata only long enough to
connect or confirm secret-backed config. It writes no database URLs, bearer
tokens, cookies, passwords, secret values, or full email addresses. The JSON
report includes `valuesPrinted: false`.

## Local Verification

Fixture coverage runs without `gcloud`:

```bash
node --test scripts/production-integration-smoke-preflight-audit.test.mjs
```

The fixture tests prove both the passing preflight and the failing path for
stale residue or broken location linkage.
