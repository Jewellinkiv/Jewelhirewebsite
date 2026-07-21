# Production Pilot Smoke Targets Audit

Created: 2026-07-21T16:24:56.688Z
Result: PASS
Values printed: false

This report records non-secret IDs and metadata only. It does not write full emails, applicant names, resume content, database URLs, bearer tokens, passwords, cookies, or secret values.

## Selected Targets

| Target | Application ID | Store ID | Stage | Has resume | Existing hire sync |
| --- | --- | --- | --- | --- | --- |
| Hire handoff | app-32dbfd01-3092-4190-9c15-cf43aa72ff46 | store-jl-58deb73ef9454405c4fe | applied | yes | no |
| Resume privacy | app-32dbfd01-3092-4190-9c15-cf43aa72ff46 | store-jl-58deb73ef9454405c4fe | applied | yes | no |

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
| `scopes.hireHandoff.applicationAlias` | `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` |
| `scopes.publicFailClosed.storeId` | `store-jl-58deb73ef9454405c4fe` |
| `scopes.publicFailClosed.expectedStoreId` | `store-jl-58deb73ef9454405c4fe` |
| `scopes.publicFailClosed.resumeApplicationId` | `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` |
| setup public application endpoint path | `/api/public/stores/diamond-exchange-58deb73e/applications` |
| setup public application job ID | `job-d389b48d-3bd4-463f-9151-4ff7ed947e8f` |

## Checks

- PASS JewelHire database credential is mounted or supplied
- PASS controlled smoke credential is present
- PASS controlled smoke credential has a password for native applicant flows
- PASS pilot company has at least one JewelHire store
- PASS requested pilot store is linked to the pilot company
- PASS controlled applicant has a pilot application
- PASS public application submission target is available
- PASS controlled hire application target is available
- PASS controlled resume privacy application target is available
