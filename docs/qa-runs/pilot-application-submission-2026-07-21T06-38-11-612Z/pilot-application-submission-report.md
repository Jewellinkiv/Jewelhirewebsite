# Production Pilot Controlled Application Submission

Created: 2026-07-21T06:38:11.613Z
Result: FAIL
Execution requested: no
Production write performed: no
Live email side effect possible: no
Approval checks deferred: yes
Values printed: false

This report does not write full emails, applicant names beyond the controlled QA label, resume content, database URLs, bearer tokens, passwords, cookies, or secret values.

## Target

| Field | Value |
| --- | --- |
| Endpoint path | `/api/public/stores/diamond-exchange-58deb73e/applications` |
| Job ID | `job-d389b48d-3bd4-463f-9151-4ff7ed947e8f` |
| Store ID | `store-jl-58deb73ef9454405c4fe` |
| Controlled applicant alias | `m***@email.com` |
| Submission ID recorded | no |

## Result

| Field | Value |
| --- | --- |
| HTTP status | `not-run` |
| Application ID | `TBD` |
| Duplicate replay | no |

## Checks

- PASS target report is provided
- PASS public application submission target is available
- PASS public page is published and job is open
- PASS controlled application is still missing before submission
- PASS controlled applicant credential is available
- FAIL execution mode is explicitly requested
- PASS approval file is provided for execution or deferred in dry-run
- PASS named approver is recorded for execution or deferred in dry-run
- PASS approval channel is recorded for execution or deferred in dry-run
- PASS approval timestamp is ISO-like for execution or deferred in dry-run
- PASS controlled public application submission approval is recorded for execution or deferred in dry-run
- PASS live application notification email acknowledgement is recorded for execution or deferred in dry-run
- PASS controlled applicant mailbox approval is recorded for execution or deferred in dry-run
- PASS stable idempotency submission ID is recorded for execution or deferred in dry-run
- PASS current legal consent policy version is available
- PASS raw controlled applicant email is available only after approval gates pass
