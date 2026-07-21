# Production Pilot Controlled Application Submission

Created: 2026-07-21T15:52:41.222Z
Result: PASS
Execution requested: yes
Production write performed: yes
Live email side effect possible: yes
Approval checks deferred: no
Values printed: false

This report does not write full emails, applicant names beyond the controlled QA label, resume content, database URLs, bearer tokens, passwords, cookies, or secret values.

## Target

| Field | Value |
| --- | --- |
| Endpoint path | `/api/public/stores/diamond-exchange-58deb73e/applications` |
| Job ID | `job-d389b48d-3bd4-463f-9151-4ff7ed947e8f` |
| Store ID | `store-jl-58deb73ef9454405c4fe` |
| Controlled applicant alias | `m***@email.com` |
| Submission ID recorded | yes |

## Result

| Field | Value |
| --- | --- |
| HTTP status | `201` |
| Application ID | `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` |
| Duplicate replay | no |

## Checks

- PASS target report is provided
- PASS public application submission target is available
- PASS public page is published and job is open
- PASS controlled application is still missing before submission
- PASS controlled applicant credential is available
- PASS execution mode is explicitly requested
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
- PASS controlled public application submission succeeded
- PASS submission response matches target store
- PASS submission response matches target job
