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

Text fields must be concrete non-placeholder values. Values such as `TBD`,
`pending`, `approved`, `N/A`, `not run`, or `candidate selected` do not count as
approval references, persona aliases, application IDs, or scope evidence.

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
- Director, Manager, Student, and platform-admin personas are selected by
  alias.
- Consultant denial is either selected by a controlled production persona alias
  or accepted through source-policy evidence that Consultants cannot access
  JewelHire.
- Paused-company denial is either selected by a controlled production persona
  alias or explicitly deferred for the current pilot with follow-up metadata.
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

`docs/qa-runs/pilot-smoke-plan-2026-07-21T15-53-48-588Z/` passes. It records
the approved live-email acknowledgement, JewelLink pilot rollout-flag movement,
controlled production smoke scope, rollback approval, Director/Manager/Student
and platform-admin aliases, Consultant source-policy acceptance, paused-company
pilot deferral, allowlisted non-admin source-test plus clean-allowlist
acceptance, controlled hire/JewelCert/public-fail-closed smoke scope, stop
conditions, and prerequisite PASS artifacts.

The plan uses controlled application
`app-32dbfd01-3092-4190-9c15-cf43aa72ff46` for both hire handoff and resume
privacy. The audit is a preflight approval gate only; it does not prove the
authenticated SSO, hire, JewelCert, team-invite, or resume privacy evidence
rows have passed.

## Secret Handling

Do not put full email addresses, passwords, database URLs, bearer tokens,
cookies, customer data, secret values, full production data extracts, or raw
resume content in the smoke plan. Store authenticated cookies in a local ignored
file only, and record only aliases, artifact paths, non-secret IDs, and
approval references.

For `personas.allowlistedNonAdminDenialEvidence.strategy =
"source-test-plus-clean-allowlist"`, record only safe artifact paths and
non-secret acceptance metadata. The audit rejects full emails, tokens, cookies,
passwords, database URLs, secret values, unsafe artifact paths, and placeholder
acceptance values.

## Local Verification

Fixture coverage runs without production access and includes the
source-policy/deferred denial path:

```bash
node --test scripts/production-pilot-controlled-application-submission.test.mjs
node --test scripts/production-allowlisted-nonadmin-denial-source-audit.test.mjs
node --test scripts/production-pilot-smoke-plan-audit.test.mjs
```
