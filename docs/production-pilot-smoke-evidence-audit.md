# Production Pilot Smoke Evidence Audit

This audit validates the non-secret evidence rows for the controlled
JewelHire/JewelLink pilot smoke matrix. It is an evidence gate only: it does not
authenticate, send email, create users, hire anyone, write to JewelLink, or
write to the JewelHire production database.

## Command

Run from the JewelHire repository:

```bash
npm run qa:pilot-smoke-evidence -- \
  --smoke-evidence-file=.qa_tmp/production-pilot-smoke-evidence.json
```

The evidence file must contain one object per required smoke row. Every row must
record:

- `result: "pass"`
- an ISO-like UTC `observedAt` timestamp
- an existing non-secret artifact path under `docs/qa-runs/`

The report is written under `docs/qa-runs/pilot-smoke-evidence-*` unless
`--artifacts=<dir>` is supplied. When evidence is missing or invalid, the audit
also writes `pilot-smoke-evidence-request.md` and
`pilot-smoke-evidence-request.json` in the same artifact directory.

## What It Proves

- Authenticated SSO evidence exists for Director, Manager, Student, Consultant
  denial, platform-admin, allowlisted non-admin denial, and paused-company
  denial.
- Hire handoff evidence exists for preview, confirm, repeat confirm, and
  revoked/cancelled access behavior.
- JewelCert evidence exists for invite, completion, scoped JewelLink sync, and
  retry behavior.
- Team-invite fail-closed and resume privacy evidence exists.
- Smoke evidence is concrete and local to `docs/qa-runs/`, not a loose note like
  "done", "approved", or "not run".

## Latest Production Result

`docs/qa-runs/pilot-smoke-evidence-2026-07-21T01-16-46-543Z/` generated the
first request packet for this gate. It records 17 required smoke evidence rows,
0 passing rows, and writes
`docs/qa-runs/pilot-smoke-evidence-2026-07-21T01-16-46-543Z/pilot-smoke-evidence-request.md`.

The gate remains a live-pilot NO-GO item until all 17 rows pass with concrete
artifacts.

## Secret Handling

Do not put full email addresses, passwords, database URLs, bearer tokens,
cookies, customer data, secret values, or full production data extracts in the
evidence file or artifacts. The audit reports artifact paths and booleans only;
it does not print raw operator notes.

## Local Verification

Fixture coverage runs without production access:

```bash
node --test scripts/production-pilot-smoke-evidence-audit.test.mjs
```
