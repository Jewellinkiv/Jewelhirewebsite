# Production Pilot Smoke Targets Audit

Created: 2026-07-21T08:30:59.584Z
Result: FAIL
Values printed: false

This report records non-secret IDs and metadata only. It does not write full emails, applicant names, resume content, database URLs, bearer tokens, passwords, cookies, or secret values.

## Selected Targets

| Target | Application ID | Store ID | Stage | Has resume | Existing hire sync |
| --- | --- | --- | --- | --- | --- |
| Hire handoff | Missing |  |  |  |  |
| Resume privacy | Missing |  |  |  |  |

## Public Application Setup Target

| Field | Value |
| --- | --- |
| Store ID | `store-jl-58deb73ef9454405c4fe` |
| Public store slug | `diamond-exchange-58deb73e` |
| Endpoint path | `/api/public/stores/diamond-exchange-58deb73e/applications` |
| Job ID | `job-d389b48d-3bd4-463f-9151-4ff7ed947e8f` |
| Job status | `open` |

## Smoke Plan Updates

| Field | Value |
| --- | --- |
| `scopes.hireHandoff.applicationAlias` | `TBD` |
| `scopes.publicFailClosed.storeId` | `TBD` |
| `scopes.publicFailClosed.expectedStoreId` | `TBD` |
| `scopes.publicFailClosed.resumeApplicationId` | `TBD` |
| setup public application endpoint path | `/api/public/stores/diamond-exchange-58deb73e/applications` |
| setup public application job ID | `job-d389b48d-3bd4-463f-9151-4ff7ed947e8f` |

## Checks

- PASS JewelHire database credential is mounted or supplied
- PASS controlled smoke credential is present
- PASS controlled smoke credential has a password for native applicant flows
- PASS pilot company has at least one JewelHire store
- FAIL controlled applicant has a pilot application
- PASS public application submission target is available
- FAIL controlled hire application target is available
- FAIL controlled resume privacy application target is available
