# Production Pilot Controlled Application Submission Request

Created: 2026-07-21T08:11:57.778Z
Values printed: false

This packet is an execution gate. The helper defaults to dry-run and must not submit the controlled public application until the missing items below are closed in a local ignored approval file.

Status: needed

## Missing Evidence

| Check | Evidence needed |
| --- | --- |
| execution mode is explicitly requested | --execute for production write; dry-run is safe by default |
| local ignored execution approval file | Before rerunning with --execute, record approver, approval channel, approvedAt, controlledPublicApplicationSubmissionApproved, liveEmailSendsAcknowledged, controlledApplicantMailboxApproved, and a stable submissionId. |

## Verification

Run `npm run qa:pilot-application-submission -- --execute --target-report=<pilot-smoke-targets-report.json> --approval-file=<local-ignored-approval.json>` only after the approval file explicitly authorizes the controlled public application write and live application notification emails.

Do not place full emails, applicant names, passwords, database URLs, bearer tokens, cookies, resume content, customer data, or secret values in committed evidence.
