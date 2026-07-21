# Allowlisted Non-Admin Denial Source Audit

Created: 2026-07-21T05:59:27.591Z
Result: PASS
Values printed: false
Mode: source-only

This audit proves the source-level role contract for the smoke-plan allowlisted non-admin denial row. It does not call production services, authenticate, send email, create users, write data, or move traffic.

## Source Files

- lib/server/jewellink-sso.ts
- lib/server/jewellink-sso-contract.ts

## Role Decision Cases

| Case | Role | Allowlisted | Company present | Platform-admin role | Derived platform admin | Contract allows | Allowlist guard blocks | Final allowed | Expected allowed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| allowlisted-director-denied | DIRECTOR | yes | yes | no | no | yes | yes | no | no |
| allowlisted-manager-denied | MANAGER | yes | yes | no | no | yes | yes | no | no |
| allowlisted-student-denied | STUDENT | yes | yes | no | no | yes | yes | no | no |
| allowlisted-consultant-denied | CONSULTANT | yes | yes | no | no | no | yes | no | no |
| allowlisted-admin-allowed | ADMIN | yes | yes | yes | yes | yes | no | yes | yes |
| allowlisted-super-admin-allowed | SUPER_ADMIN | yes | yes | yes | yes | yes | no | yes | yes |
| nonallowlisted-admin-denied | ADMIN | no | yes | yes | no | no | no | no | no |

## Checks

- PASS Platform-admin status is derived from both upstream admin role and JewelHire allowlist
- PASS Allowlisted non-admin identities are blocked before provisioning
- PASS Platform admins are provisioned without projecting an upstream company as tenant membership
- PASS Only exact ADMIN and SUPER_ADMIN upstream roles are platform-admin roles
- PASS Consultant and unknown role variants are denied by the exact role contract
- PASS Allowlisted DIRECTOR remains a company role and cannot become platform admin
- PASS Allowlisted MANAGER remains a company role and cannot become platform admin
- PASS Allowlisted STUDENT remains an applicant role and cannot become platform admin
- PASS Allowlisted CONSULTANT is denied entirely
- PASS Allowlisted ADMIN can become platform admin after MFA-backed JewelLink SSO
- PASS Allowlisted SUPER_ADMIN can become platform admin after MFA-backed JewelLink SSO
- PASS Non-allowlisted ADMIN cannot become platform admin

No full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, or secret values are written to this report.
