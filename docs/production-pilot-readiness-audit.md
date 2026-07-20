# Production Pilot Readiness Audit

This audit is the single operator-facing check for the remaining JewelHire and
JewelLink production pilot configuration gates. It is read-only. It does not
deploy, migrate, move traffic, create users, or print secret values.

## Command

Run from the JewelHire repository on a machine with authenticated `gcloud`
access to both production projects:

```bash
npm run qa:pilot-readiness -- \
  --jewelhire-project=jewelhire-prod-20260626 \
  --jewelhire-region=us-central1 \
  --jewelhire-service=jewelhire \
  --jewellink-project=academy-460316 \
  --jewellink-region=us-central1 \
  --jewellink-service=jewellink-dev \
  --expected-jewellink-rollout=pilot
```

The report is written under `docs/qa-runs/production-pilot-readiness-*` unless
`--artifacts=<dir>` is supplied.

## What it proves

- Both Cloud Run service configs are readable.
- Required JewelHire and JewelLink integration environment names are mounted.
- Private env vars used for the integration are backed by Secret Manager.
- JewelHire points to `https://ai.jewellink.com`.
- JewelLink points to `https://app.jewelhire.com`.
- JewelHire production auth, Postgres storage, disabled session override, and
  disabled team invites are explicit.
- JewelLink integration is enabled in the expected rollout mode.
- JewelLink pilot company IDs are configured when rollout mode is `pilot`.
- JewelLink hire email mode is explicit and guarded.
- The SSO shared secret values match across both services.
- The integration handoff secret values match across both services.
- Both shared secret pairs are high entropy.
- Each Cloud Run service reports a ready revision and explicit traffic target.

## Secret handling

When real `gcloud` is used, the audit reads the latest mounted Secret Manager
versions only to compare them in memory. It writes no secret values, secret
hashes, API keys, tokens, database URLs, or passwords to the terminal or report.
The JSON report includes `valuesPrinted: false`.

## Local verification

The audit has fixture coverage that runs without `gcloud`:

```bash
npm run test:production-pilot-readiness
```

The fixture test proves the happy path and verifies that a mismatched shared
secret fails the audit without leaking the fake secret value into either report.

## Still manual

This audit does not replace the authenticated pilot smoke matrix. After it
passes, the live pilot still needs the selected Diamond Exchange company and
location IDs, role aliases, SSO smoke, hire provisioning smoke, JewelCert result
smoke, migration ledger evidence, and rollback owner recorded in the live
readiness dossier.
