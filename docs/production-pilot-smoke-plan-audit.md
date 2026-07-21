# Production Pilot Smoke Plan Audit

This audit validates the non-secret preflight plan for the controlled
JewelHire/JewelLink pilot smoke window. It is an approval gate only: it does not
authenticate, send email, create users, hire anyone, write to JewelLink, or
write to the JewelHire production database.

## Command

Run from the JewelHire repository:

```bash
npm run qa:pilot-smoke-plan -- \
  --smoke-plan-file=.qa_tmp/production-pilot-smoke-plan.json
```

Copy `docs/production-pilot-smoke-plan.template.json` to an ignored local path
and fill it only after the operator has the final non-secret approval scope and
the prerequisite PASS artifacts.

Run `npm run qa:pilot-smoke-targets` before filling the hire and resume smoke
target fields. That read-only helper finds the controlled application IDs or
writes an evidence request when the controlled pilot application is not ready.
If the target report has a public submission target but no controlled
application yet, use `npm run qa:pilot-application-submission` in dry-run mode
to generate the setup request, then execute it only with the local ignored
approval file described in
`docs/production-pilot-controlled-application-submission.md`.

## What It Proves

- Live email sends, JewelLink pilot flag movement, controlled production persona
  creation, hire confirmation, JewelCert production mutation, public/fail-closed
  probing, and rollback window approval are explicitly recorded.
- Operations readiness, pilot roster, integration smoke preflight, and smoke
  credential auth each link to an existing PASS artifact under `docs/qa-runs/`.
- Director, Manager, Student, Consultant-denial, platform-admin, allowlisted
  non-admin denial, and paused-company denial personas are selected by alias.
- The allowlisted non-admin denial row either uses a controlled production
  denial persona or records an explicit source-test plus clean-allowlist
  acceptance strategy with concrete PASS artifacts and acceptance metadata.
- Hire, JewelCert, and public/fail-closed scopes include the controlled
  application, mailbox alias, target company/store, retry, repeat-confirm,
  revoke/cancel, resume, and local-cookie handling boundaries.
- Stop conditions include tenant data exposure, role elevation, hire
  duplication/wrong user, JewelCert wrong target, email/provider misdelivery,
  and secret-bearing evidence.

## Latest Production Result

`docs/qa-runs/pilot-smoke-plan-2026-07-21T06-02-30-000Z/` records the
operator-approved live-email and JewelLink pilot-flag movement scope in an
ignored local smoke plan while leaving unapproved production mutations closed.
It records 59 checks, 44 passing checks, 15 missing or invalid checks, and
writes
`docs/qa-runs/pilot-smoke-plan-2026-07-21T06-02-30-000Z/pilot-smoke-plan-request.md`.

The current source-test artifact
`docs/qa-runs/allowlisted-nonadmin-denial-source-2026-07-21T06-02-00-000Z/allowlisted-nonadmin-denial-source-report.md`
passes, and the clean allowlist artifact
`docs/qa-runs/admin-allowlist-2026-07-21T05-44-30-000Z/admin-allowlist-report.md`
passes. The smoke plan still requires an explicit acceptance record before the
source-test plus clean-allowlist strategy can count as GO evidence.

The gate remains a live-pilot NO-GO item until this audit passes, then the
resulting report can be referenced by the pilot smoke evidence packet.

The latest target-finder run
`docs/qa-runs/pilot-smoke-targets-2026-07-21T05-51-00-000Z/` confirms the
controlled applicant credential, pilot store, published public store page, and
open public job are available, but no controlled pilot application exists yet.
Create or approve that controlled application with a private resume attachment
before copying hire/resume IDs into the smoke plan.

The approved setup path is `qa:pilot-application-submission`; execute mode can
send live application notification emails and must retain the same idempotency
submission ID on retry.

## Secret Handling

Do not put full email addresses, passwords, database URLs, bearer tokens,
cookies, customer data, secret values, full production data extracts, or raw
resume content in the smoke plan. Store authenticated cookies in a local ignored
file only, and record only aliases, artifact paths, non-secret IDs, and
approval references.

For `personas.allowlistedNonAdminDenialEvidence.strategy =
"source-test-plus-clean-allowlist"`, record only safe artifact paths and
non-secret acceptance metadata. The audit rejects full emails, tokens, cookies,
passwords, database URLs, secret values, and unsafe artifact paths.

## Local Verification

Fixture coverage runs without production access:

```bash
node --test scripts/production-pilot-controlled-application-submission.test.mjs
node --test scripts/production-allowlisted-nonadmin-denial-source-audit.test.mjs
node --test scripts/production-pilot-smoke-plan-audit.test.mjs
```
