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
- A published public store page and open public job exist for submitting the
  controlled pilot application through the normal public application flow.
- The controlled applicant has an existing pilot application.
- A non-terminal application without an existing JewelLink hire sync is
  available for the hire handoff smoke.
- A controlled application with a private resume attachment is available for the
  resume privacy smoke.

## Latest Production Result

`docs/qa-runs/pilot-smoke-targets-2026-07-21T15-52-45-780Z/` passes after the
approved controlled application setup. It confirms the database credential,
controlled applicant smoke credential, linked pilot store, published public
store page, open public job, and a controlled pilot application with a private
resume attachment.

The selected hire handoff and resume privacy target is
`app-32dbfd01-3092-4190-9c15-cf43aa72ff46` in store
`store-jl-58deb73ef9454405c4fe`. The application is still in `applied` stage,
has no existing JewelLink hire sync, and is safe to copy into the ignored pilot
smoke plan as the controlled application alias.

The guarded JewelHire-side setup helper is documented in
`docs/production-pilot-controlled-application-submission.md` and exposed as
`npm run qa:pilot-application-submission`. It defaults to a dry-run/request
packet. Execute mode requires a local ignored approval file, a stable
idempotency submission ID, explicit controlled-mailbox approval, and explicit
acknowledgement that the normal production route can send live application
notification emails.

## Secret Handling

Do not commit full email addresses, applicant names, passwords, database URLs,
bearer tokens, cookies, resume content, customer data, secret values, or full
production extracts. The report writes only masked aliases, non-secret IDs,
counts, stages, and safe metadata.

## Local Verification

Fixture coverage runs without production access:

```bash
node --test scripts/production-pilot-smoke-targets-audit.test.mjs
node --test scripts/production-pilot-controlled-application-submission.test.mjs
```
