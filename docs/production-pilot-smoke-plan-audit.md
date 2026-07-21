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

## What It Proves

- Live email sends, JewelLink pilot flag movement, controlled production persona
  creation, hire confirmation, JewelCert production mutation, public/fail-closed
  probing, and rollback window approval are explicitly recorded.
- Operations readiness, pilot roster, integration smoke preflight, and smoke
  credential auth each link to an existing PASS artifact under `docs/qa-runs/`.
- Director, Manager, Student, Consultant-denial, platform-admin, allowlisted
  non-admin denial, and paused-company denial personas are selected by alias.
- Hire, JewelCert, and public/fail-closed scopes include the controlled
  application, mailbox alias, target company/store, retry, repeat-confirm,
  revoke/cancel, resume, and local-cookie handling boundaries.
- Stop conditions include tenant data exposure, role elevation, hire
  duplication/wrong user, JewelCert wrong target, email/provider misdelivery,
  and secret-bearing evidence.

## Latest Production Result

`docs/qa-runs/pilot-smoke-plan-2026-07-21T04-11-01-000Z/` records the
operator-approved live-email and JewelLink pilot-flag movement scope in an
ignored local smoke plan while leaving unapproved production mutations closed.
It records 53 checks, 40 passing checks, 13 missing or invalid checks, and
writes
`docs/qa-runs/pilot-smoke-plan-2026-07-21T04-11-01-000Z/pilot-smoke-plan-request.md`.

The gate remains a live-pilot NO-GO item until this audit passes, then the
resulting report can be referenced by the pilot smoke evidence packet.

## Secret Handling

Do not put full email addresses, passwords, database URLs, bearer tokens,
cookies, customer data, secret values, full production data extracts, or raw
resume content in the smoke plan. Store authenticated cookies in a local ignored
file only, and record only aliases, artifact paths, non-secret IDs, and
approval references.

## Local Verification

Fixture coverage runs without production access:

```bash
node --test scripts/production-pilot-smoke-plan-audit.test.mjs
```
