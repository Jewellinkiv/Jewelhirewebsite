# Production Pilot Smoke Evidence Request

Created: 2026-07-22T22:36:43.149Z
Values printed: false

This packet is an approval and evidence aid only. It does not authenticate, send email, create users, hire anyone, write to JewelLink, or write to the JewelHire production database.

Status: needed

## Missing Evidence

| Field | Evidence needed |
| --- | --- |
| `authenticatedSso.manager` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `authenticatedSso.student` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `authenticatedSso.platformAdmin` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `hireHandoff.repeatConfirm` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `hireHandoff.revokedCancelledAccess` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `jewelCert.inviteFromJewelLink` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `jewelCert.retryPath` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `publicFailClosed.teamInvites` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `publicFailClosed.resumePrivacy` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |

## Smoke Matrix

| Field | Smoke | Expected result |
| --- | --- | --- |
| `authenticatedSso.manager` | Manager SSO | JewelLink Manager lands as JewelHire manager and cannot access billing, ownership, integrations, or user admin. |
| `authenticatedSso.student` | Student SSO | JewelLink Student lands in applicant portal and cannot access store or admin routes. |
| `authenticatedSso.platformAdmin` | Platform-admin SSO | Allowlisted JewelLink admin lands as JewelHire platform admin only after MFA-backed SSO. |
| `hireHandoff.repeatConfirm` | Repeat confirm | Repeating hire confirmation is idempotent and does not create a duplicate JewelLink user. |
| `hireHandoff.revokedCancelledAccess` | Revoked or cancelled access | Cancelled access does not leave a billable or active JewelLink entitlement. |
| `jewelCert.inviteFromJewelLink` | JewelCert invite from JewelLink | JewelHire accepts the bearer-authenticated invite and requires JewelLink SSO before claim. |
| `jewelCert.retryPath` | JewelCert retry path | A simulated delivery failure remains retryable and scoped to the correct store. |
| `publicFailClosed.teamInvites` | Team invite fail-closed | Diamond Exchange invite, resend, role, status, and ownership-transfer attempts return team_invites_disabled without mutation. |
| `publicFailClosed.resumePrivacy` | Resume privacy | Resume asset returns 401 publicly and downloads only for authorized same-store/location user. |

## Verification

Run `npm run qa:pilot-smoke-evidence -- --smoke-evidence-file=<path>` and require the pilot-smoke evidence report to pass before treating authenticated SSO, hire, JewelCert, team-invite, and resume privacy smokes as GO-ready.

Do not place full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, or full production data extracts in the evidence file.
