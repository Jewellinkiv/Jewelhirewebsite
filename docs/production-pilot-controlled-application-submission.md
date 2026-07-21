# Production Pilot Controlled Application Submission

This helper is the guarded JewelHire-side path for creating the one controlled
pilot application needed by the hire handoff and resume privacy smoke targets.
It defaults to dry-run and does not write to production unless `--execute` and
a local ignored approval file are both supplied.

The execute path posts through the normal public application endpoint with a
small synthetic PDF resume. That production route can send live application
notification emails, so execution is a mutating smoke setup step and remains
approval-gated.

## Command

Dry-run or request packet:

```bash
npm run qa:pilot-application-submission -- \
  --target-report=<pilot-smoke-targets-report.json>
```

Approved execution:

```bash
npm run qa:pilot-application-submission -- \
  --execute \
  --target-report=<pilot-smoke-targets-report.json> \
  --approval-file=<local-ignored-approval.json>
```

The report is written under
`docs/qa-runs/pilot-application-submission-*` unless `--artifacts=<dir>` is
supplied.

The latest approved execution packet is
`docs/qa-runs/pilot-application-submission-2026-07-21T15-52-39-694Z/pilot-application-submission-report.md`.
It created controlled application
`app-32dbfd01-3092-4190-9c15-cf43aa72ff46` for store
`store-jl-58deb73ef9454405c4fe` through the normal public application endpoint.
The local operator used the Cloud Run service URL because the workstation's
custom-domain request to `app.jewelhire.com` was intercepted by local DNS
filtering; the production route and service revision were unchanged.

## Approval File

The approval file must stay local and ignored. It records approval facts only;
do not put full email addresses, passwords, cookies, bearer tokens, database
URLs, resume content, customer data, or secret values in it.

```json
{
  "approvals": {
    "approver": "Name or approval channel owner",
    "approvalChannel": "Where the approval was given",
    "approvedAt": "2026-07-21T00:00:00Z",
    "controlledPublicApplicationSubmissionApproved": true,
    "liveEmailSendsAcknowledged": true,
    "controlledApplicantMailboxApproved": true,
    "submissionId": "stable_idempotency_key_20260721"
  }
}
```

`submissionId` is the idempotency key for the public application request. Keep
it stable across retries so an interrupted run cannot create a second controlled
application.

## What It Proves

- The latest smoke-target report found a published public page and open pilot
  job for the controlled setup application.
- The operator explicitly approved this single controlled public application
  write and the live email side effect.
- The controlled applicant credential is read only after the approval gates
  pass.
- The public application endpoint accepts the controlled profile and private
  resume through the same route used by real applicants.
- A successful response records the non-secret application ID that can unlock
  `qa:pilot-smoke-targets` on the next read-only run.

## Local Verification

Fixture coverage runs without production access:

```bash
node --test scripts/production-pilot-controlled-application-submission.test.mjs
```
