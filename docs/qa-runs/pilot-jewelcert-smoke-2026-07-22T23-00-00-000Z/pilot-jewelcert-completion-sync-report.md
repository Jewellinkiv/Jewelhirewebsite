# Production Pilot JewelCert Completion and Sync Evidence

Created: 2026-07-22T22:35:41.300Z
Result: PASS
Values printed: false
Mode: live

This component artifact proves only the controlled JewelCert completion and successful scoped JewelLink result sync. It intentionally does not mark the invite endpoint HTTP response or simulated retry path complete.

## Scope

- Pilot company: comp_1
- Pilot location: loc_1
- Recipient user ID: cmqekv8h700017ey8jwsme7kg
- Idempotency key: jewelhire-pilot-jewelcert-2026-07-22-v1

## Completion and Sync

- JewelCert invite ID: jewelcert-jl-2e4db0677c5033704f1b1786
- Application ID: application-jl-61691dc4a592cf2f24d51d84
- GemMatch invite ID: gemmatch-1d5c91e6-93d2-4b34-9de0-3e2fd53a681c
- Completion status: completed
- Result primary profile: F
- Fit rating: Strong fit
- JewelHire sync status: synced
- JewelLink result stored: yes

## Checks

- PASS JewelHire invite row is scoped to the pilot company/location/user
- PASS JewelLink employee application remains in hired stage
- PASS JewelCert response completed with persisted GemMatch result
- PASS JewelCert completion preserves JewelLink employee hired semantics
- PASS JewelHire marked the JewelCert result sync as synced
- PASS JewelLink stored the scoped aggregated JewelCert result

## Not Covered

- JewelHire invite endpoint HTTP success is not covered by this component artifact.
- JewelCert simulated failure→retry is not covered by this component artifact.

No full email addresses, names, passwords, database URLs, bearer tokens, cookies, resume contents, or secret values are written to this report.
