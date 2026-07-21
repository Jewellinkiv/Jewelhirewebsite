# Production Pilot Smoke Targets Audit

This audit finds the non-secret JewelHire application IDs needed by the
controlled pilot hire handoff and resume privacy smokes. It is read-only: it
does not authenticate, send email, create applications, hire anyone, download
resumes, write to JewelLink, or write to the JewelHire production database.

## Command

Run from the JewelHire repository:

```bash
npm run qa:pilot-smoke-targets
```

Use `--pilot-store-id=<store-id>` when the pilot smoke must be tied to a
specific JewelHire store. The report is written under
`docs/qa-runs/pilot-smoke-targets-*` unless `--artifacts=<dir>` is supplied.

## What It Proves

- The JewelHire production database credential is available through Cloud Run,
  the fallback JewelHire database secret, or local ignored environment.
- The controlled applicant smoke credential exists and has a native password.
- The pilot JewelLink company has at least one linked JewelHire store.
- The controlled applicant has an existing pilot application.
- A non-terminal application without an existing JewelLink hire sync is
  available for the hire handoff smoke.
- A controlled application with a private resume attachment is available for the
  resume privacy smoke.

## Latest Production Result

`docs/qa-runs/pilot-smoke-targets-2026-07-21T04-23-06-388Z/` confirms the
database credential, controlled applicant smoke credential, and linked pilot
store are ready. It fails because the controlled applicant does not yet have a
pilot application, so no hire handoff target or resume privacy target can be
copied into the smoke plan.

The gate remains a live-pilot NO-GO item until a controlled applicant submits or
has approved a pilot-store application with a private resume attachment, then
`qa:pilot-smoke-targets` passes and the resulting non-secret application IDs are
copied into the ignored pilot smoke plan.

## Secret Handling

Do not commit full email addresses, applicant names, passwords, database URLs,
bearer tokens, cookies, resume content, customer data, secret values, or full
production extracts. The report writes only masked aliases, non-secret IDs,
counts, stages, and safe metadata.

## Local Verification

Fixture coverage runs without production access:

```bash
node --test scripts/production-pilot-smoke-targets-audit.test.mjs
```
