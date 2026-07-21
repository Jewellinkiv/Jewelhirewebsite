# Production Pilot Smoke Targets Audit

Created: 2026-07-21T04:23:08.739Z
Result: FAIL
Values printed: false

This report records non-secret IDs and metadata only. It does not write full emails, applicant names, resume content, database URLs, bearer tokens, passwords, cookies, or secret values.

## Selected Targets

| Target | Application ID | Store ID | Stage | Has resume | Existing hire sync |
| --- | --- | --- | --- | --- | --- |
| Hire handoff | Missing |  |  |  |  |
| Resume privacy | Missing |  |  |  |  |

## Smoke Plan Updates

| Field | Value |
| --- | --- |
| `scopes.hireHandoff.applicationAlias` | `TBD` |
| `scopes.publicFailClosed.storeId` | `TBD` |
| `scopes.publicFailClosed.expectedStoreId` | `TBD` |
| `scopes.publicFailClosed.resumeApplicationId` | `TBD` |

## Checks

- PASS JewelHire database credential is mounted or supplied
- PASS controlled smoke credential is present
- PASS controlled smoke credential has a password for native applicant flows
- PASS pilot company has at least one JewelHire store
- FAIL controlled applicant has a pilot application
- FAIL controlled hire application target is available
- FAIL controlled resume privacy application target is available
