# Production Pilot Smoke Evidence Audit

This audit validates the non-secret evidence rows for the controlled
JewelHire/JewelLink pilot smoke matrix. It is an evidence gate only: it does not
authenticate, send email, create users, hire anyone, write to JewelLink, or
write to the JewelHire production database.

## Command

Run from the JewelHire repository:

```bash
npm run qa:pilot-smoke-plan -- \
  --smoke-plan-file=.qa_tmp/production-pilot-smoke-plan.json

npm run qa:pilot-smoke-evidence -- \
  --smoke-evidence-file=.qa_tmp/production-pilot-smoke-evidence.json
```

For the live smoke preflight, copy
`docs/production-pilot-smoke-plan.template.json` to an ignored local path and
fill it only after approvals, roster, rollback, and prerequisite PASS artifacts
exist. Require `qa:pilot-smoke-plan` to pass before any authenticated SSO, hire,
JewelCert, team-invite, or resume privacy smoke runs in production.

For the hire and resume privacy target IDs, run `npm run qa:pilot-smoke-targets`
before filling the smoke plan. The latest production run
`docs/qa-runs/pilot-smoke-targets-2026-07-21T04-36-00-000Z/` confirms the
controlled applicant credential, pilot store, published public store page, and
open public job, but it still needs a controlled pilot application with a
private resume attachment before those smoke rows can proceed.
Use `npm run qa:pilot-application-submission` in dry-run mode to generate the
setup request, and execute it only after the local ignored approval file records
the controlled public application write, controlled mailbox use, live email
acknowledgement, and stable idempotency submission ID.

For the current pilot evidence matrix, copy
`docs/production-pilot-smoke-evidence.template.json` to an ignored local path
and fill each row only after the corresponding authenticated smoke has a
non-secret `docs/qa-runs` artifact.

The dedicated public/fail-closed producer for `publicFailClosed.teamInvites` and
`publicFailClosed.resumePrivacy` is:

```bash
npm run qa:public-fail-closed-smoke -- \
  --cookie-file=<local-cookie-file> \
  --store-id=<pilot-store-id> \
  --expected-store-id=<pilot-store-id> \
  --resume-application-id=<application-id>
```

It requires an authenticated pilot session cookie from a local ignored file,
refuses invite/ownership-transfer probes unless `/api/stores/<storeId>/users`
confirms `teamInvitesEnabled: false`, and never stores cookies, full email
addresses, bearer tokens, passwords, database URLs, resume content, or customer
data in its reports.

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
- The live smoke plan preflight has a separate auditable gate in
  `docs/production-pilot-smoke-plan-audit.md`.

## Latest Production Result

`docs/qa-runs/pilot-smoke-evidence-2026-07-21T01-16-46-543Z/` generated the
first request packet for this gate. It records 17 required smoke evidence rows,
0 passing rows, and writes
`docs/qa-runs/pilot-smoke-evidence-2026-07-21T01-16-46-543Z/pilot-smoke-evidence-request.md`.

The gate remains a live-pilot NO-GO item until all 17 rows pass with concrete
artifacts.

After this evidence audit passes and the go/no-go dossier is moved to GO, run
`qa:pilot-live-readiness` with an ignored manifest copied from
`docs/production-pilot-live-readiness.template.json`. That final audit collects
the concrete PASS artifacts and approval references in one place before the
pilot is treated as GO-ready. The current final request packet is
`docs/qa-runs/pilot-live-readiness-2026-07-21T05-05-00-000Z/pilot-live-readiness-request.md`.

## Secret Handling

Do not put full email addresses, passwords, database URLs, bearer tokens,
cookies, customer data, secret values, or full production data extracts in the
evidence file or artifacts. The audit reports artifact paths and booleans only;
it does not print raw operator notes.

## Local Verification

Fixture coverage runs without production access:

```bash
node --test scripts/production-pilot-controlled-application-submission.test.mjs
node --test scripts/production-pilot-smoke-plan-audit.test.mjs
node --test scripts/production-public-fail-closed-smoke.test.mjs
node --test scripts/production-pilot-smoke-evidence-audit.test.mjs
```
