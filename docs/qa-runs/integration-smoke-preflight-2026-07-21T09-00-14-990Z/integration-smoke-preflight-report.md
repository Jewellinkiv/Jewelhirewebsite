# Production Integration Smoke Preflight Audit

Created: 2026-07-21T09:00:18.001Z
Result: PASS
Values printed: false

This read-only audit does not call bearer-authenticated mutation endpoints, create users, send email, run SSO, hire anyone, or write to either database.

## Pilot Linkage

- Pilot company ID: comp_1
- JewelHire company: company-jl-58deb73ef9454405c4fe (active)
- JewelHire store: store-jl-58deb73ef9454405c4fe (active)
- loc_1: Downtown Flagship
- loc_2: Conway
- loc_3: Fort Smith
- loc_4: Jonesboro
- loc_5: West Little Rock
- loc_6: Memphis
- Missing expected location IDs: none
- Unexpected linked location IDs: none

## Residue

- JewelHire hire sync status counts: {"synced":1}
- JewelHire unresolved hire syncs: 0
- JewelHire unresolved JewelCert result syncs: 0
- JewelHire external JewelCert invite status counts: {}
- JewelLink hire ledger status counts: {"succeeded":1}
- JewelLink failed/stale hire ledger rows: 0

## Fail-Closed Endpoint Probes

- JewelHire unauthenticated JewelCert invite status: 401
- JewelLink unauthenticated hire status: 401
- JewelLink unauthenticated JewelCert result status: 401

## Checks

- PASS JewelHire runtime uses Postgres storage
- PASS JewelHire database secret is mounted
- PASS JewelHire points at JewelLink
- PASS JewelHire integration secret is secret-backed
- PASS JewelLink points at JewelHire
- PASS JewelLink integration secret is secret-backed
- PASS JewelLink hire email mode is explicit
- PASS JewelLink allowlist email mode has an allowlist
- PASS JewelHire pilot company link exists
- PASS JewelHire pilot company is active
- PASS JewelHire pilot store is active
- PASS JewelHire linked location IDs match the pilot roster
- PASS JewelHire has no unresolved outbound hire syncs for pilot
- PASS JewelHire has no unresolved JewelCert result syncs for pilot
- PASS JewelLink has no failed or stale hire provisioning rows for pilot
- PASS JewelHire JewelCert invite endpoint rejects unauthenticated requests
- PASS JewelLink hire endpoint rejects unauthenticated requests
- PASS JewelLink JewelCert result endpoint rejects unauthenticated requests
