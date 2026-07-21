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
before filling the smoke plan. The latest passing production run
`docs/qa-runs/pilot-smoke-targets-2026-07-21T15-52-45-780Z/` selects controlled
application `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` for both hire handoff and
resume privacy after the approved application setup in
`docs/qa-runs/pilot-application-submission-2026-07-21T15-52-39-694Z/`.

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

For the current pilot scope, `scopeDecisions.consultantDenial` may satisfy the
Consultant row with accepted source-policy evidence, and
`scopeDecisions.pausedCompanyDenial` may record the paused-company deferral.
Both still require concrete non-secret acceptance or deferral metadata.

The report is written under `docs/qa-runs/pilot-smoke-evidence-*` unless
`--artifacts=<dir>` is supplied. When evidence is missing or invalid, the audit
also writes `pilot-smoke-evidence-request.md` and
`pilot-smoke-evidence-request.json` in the same artifact directory.

## What It Proves

- Authenticated SSO evidence exists for Director, Manager, Student,
  platform-admin, and allowlisted non-admin denial.
- Consultant denial is proven by either a live controlled denial artifact or
  accepted source-policy evidence.
- Paused-company denial is proven by either a live controlled denial artifact
  or an explicit pilot-scope deferral with follow-up metadata.
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

`docs/qa-runs/pilot-smoke-plan-2026-07-21T15-53-48-588Z/` passes the preflight
plan, and `docs/qa-runs/public-fail-closed-smoke-2026-07-21T15-54-36-822Z/`
records the latest public/fail-closed attempt. That attempt proves the
controlled resume rejects public access with `401`, but it fails the Diamond
Exchange same-store checks because the available native smoke cookie is scoped
to the dedicated smoke store, not `store-jl-58deb73ef9454405c4fe`.

The gate remains a live-pilot NO-GO item until all 17 rows pass with concrete
artifacts. The next required input is a real authenticated Diamond Exchange
pilot session, preferably from the JewelLink SSO Director or Manager path, so
the public/fail-closed runner and the authenticated SSO/hire/JewelCert evidence
can be captured without widening a native smoke account into the pilot store.

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
