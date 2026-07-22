# Production Pilot JewelCert Smoke
Created: 2026-07-22T22:35:41.300Z
Result: FAIL
Values printed: false
Mode: live
This report intentionally omits full email addresses, names, passwords, database URLs, bearer tokens, cookies, resume contents, and secret values.
## Scope
- Pilot company: comp_1
- Pilot location: loc_1
- Recipient user ID: cmqekv8h700017ey8jwsme7kg
- Requested-by user ID: cmnjh2zrj0000p6y8axdo1608
- Idempotency key: jewelhire-pilot-jewelcert-2026-07-22-v1
## Controlled Recipient
- Role: STUDENT
- Masked alias: n***@jewellink.com
- Email domain: jewellink.com
- Location access: yes
- Pilot location exists under company: yes
- Full name present: yes
## JewelCert Handoff
- JewelHire invite status code: 500
- JewelCert invite ID: jewelcert-jl-2e4db0677c5033704f1b1786
- Application ID: application-jl-61691dc4a592cf2f24d51d84
- Invite status: completed
- Committed despite HTTP failure: yes
- Notification result recorded by endpoint: no
## Completion and Sync
- GemMatch invite ID: gemmatch-1d5c91e6-93d2-4b34-9de0-3e2fd53a681c
- Completion status: completed
- Result primary profile: F
- Fit rating: Strong fit
- Picked adjective count: 10
- Was already completed before this run: yes
- JewelHire sync status: synced
- JewelLink result stored: yes
## Source Guardrails
- Claim fence present: yes
- PostgreSQL behavior coverage present: yes
- Source files: lib/server/invite-claim.ts, scripts/jewelcert-claim-postgres.test.mjs
## Checks
- PASS JewelHire/JewelLink production configuration is available
- PASS Controlled JewelLink recipient is an active pilot Student
- PASS JewelLink pilot location exists under the recipient company
- PASS JewelCert claim fence is source-tested for JewelLink-managed identities
- FAIL JewelHire accepted the bearer-authenticated JewelCert invite
- PASS JewelHire invite row is scoped to the pilot company/location/user
- PASS JewelLink employee application remains in hired stage
- PASS JewelCert response completed with persisted GemMatch result
- PASS JewelCert completion preserves JewelLink employee hired semantics
- PASS JewelHire marked the JewelCert result sync as synced
- PASS JewelLink stored the scoped aggregated JewelCert result
## Not Covered By This Artifact
- JewelCert simulated failure→retry is intentionally not marked complete by this smoke. This artifact proves invite, completion, and successful scoped sync only.
