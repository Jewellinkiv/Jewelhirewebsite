# Production Pilot Live Readiness Audit

This audit is the final non-secret evidence gate for the controlled
JewelHire/JewelLink pilot. It validates a manifest of concrete PASS artifacts,
approval references, and the final go/no-go decision. It is read-only: it does
not authenticate, send email, create users, create applications, hire anyone,
write to JewelLink, deploy, move traffic, or write to either production
database.

## Command

Run from the JewelHire repository:

```bash
npm run qa:pilot-live-readiness -- \
  --readiness-file=.qa_tmp/production-pilot-live-readiness.json
```

Copy `docs/production-pilot-live-readiness.template.json` to an ignored local
path and fill it only after every prerequisite gate has a concrete PASS artifact
and the go/no-go dossier has been moved to GO.

Approval references must be concrete non-placeholder values. Values such as
`TBD`, `pending`, `approved`, `N/A`, `not run`, or `candidate selected` do not
count as final live-readiness approval evidence.

## What It Proves

- The go/no-go dossier exists, has the expected GO decision, and no unresolved
  GO placeholders.
- Production pilot readiness, integration smoke preflight, operations
  readiness, pilot roster, smoke targets, controlled application submission,
  smoke plan, smoke evidence, JewelLink no-push validation, and JewelLink
  approval packet each link to an existing PASS artifact under `docs/qa-runs/`.
- JewelLink repo movement, rollback window, controlled application submission,
  and mutating smoke approvals are recorded as concrete non-secret references.
- The manifest contains no full emails, passwords, database URLs, bearer tokens,
  cookies, tokens, secret values, or customer data.

## Current State

This audit is expected to fail while the pilot remains NO-GO. Use the generated
`pilot-live-readiness-request.md` packet as the final checklist after the
individual operations, roster, controlled application, smoke-plan, SSO, hire,
JewelCert, and fail-closed evidence packets pass.

## Local Verification

Fixture coverage runs without production access:

```bash
node --test scripts/production-pilot-live-readiness-audit.test.mjs
```
