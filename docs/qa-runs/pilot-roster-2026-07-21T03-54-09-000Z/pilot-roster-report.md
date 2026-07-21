# Production Pilot Roster Audit

Created: 2026-07-21T03:54:15.576Z
Result: FAIL
Values printed: false

This report records masked email aliases only. It does not write database URLs, bearer tokens, passwords, cookies, secret values, or full user email addresses.

## Pilot Company

- Company ID: comp_1
- Company name: Diamond Exchange
- Active: yes
- Paused: no

## Locations

- loc_1: Downtown Flagship
- loc_2: Conway
- loc_3: Fort Smith
- loc_4: Jonesboro
- loc_5: West Little Rock
- loc_6: Memphis
- Missing expected IDs: none
- Unexpected IDs: none

## Role Counts

- DIRECTOR: 3
- MANAGER: 7
- STUDENT: 22

## Selected Masked Candidates

| Persona | User ID | Role | Masked alias | Primary location | Accessible location count |
| --- | --- | --- | --- | --- | --- |
| Director | cmnjh2zrj0000p6y8axdo1608 | DIRECTOR | a***@jewellink.com | loc_1 | 1 |
| Manager | cmnjh2zw40002p6y81ytmlxqb | MANAGER | m***@jewellink.com | loc_1 | 1 |
| Student | cmqekv8h700017ey8jwsme7kg | STUDENT | n***@jewellink.com | loc_1 | 1 |
| Consultant denial | Missing |  |  |  |  |
| Platform admin | cmp7ggpps000201s6kd8zn4no | SUPER_ADMIN | c***@jewelrysalesacademy.com |  | 0 |
| Paused company denial | Missing |  |  |  |  |

## JewelHire Smoke Credential Aliases

| Alias | Role | Masked alias | Password present | Auth path |
| --- | --- | --- | --- | --- |
| jewelHireAdmin | admin | not recorded | no | jewellink_sso |
| controlledApplicantSignup | applicant | m***@email.com | yes | native |
| controlledHireJewelCertMailbox | applicant | m***@email.com | yes | native |
| storeOwner | store_owner | j***@email.com | yes | native |

## Checks

- PASS pilot JewelLink company exists
- PASS pilot JewelLink company is active and not paused
- PASS pilot location IDs match expected roster
- PASS Director SSO candidate exists
- PASS Manager SSO candidate exists
- PASS Student SSO candidate exists
- FAIL Consultant denial candidate exists
- PASS allowlisted JewelLink platform-admin candidate exists
- PASS JewelHire admin allowlist contains no active JewelLink non-admin candidates
- FAIL paused-company denial candidate exists
- PASS JewelHire smoke credential auth prerequisites are present

## Remaining Roster Gaps

- Create or approve a controlled JewelLink CONSULTANT test account for denial smoke.
- Create or approve a controlled active user in a paused JewelLink company for stale-access denial smoke.
- Live allowlisted-non-admin elevation denial still needs a controlled temporary config window, or explicit acceptance of source-test plus clean-allowlist evidence.

## Provisioning Packet

- Actions required: 2
- Artifact: pilot-roster-provisioning-packet.md
