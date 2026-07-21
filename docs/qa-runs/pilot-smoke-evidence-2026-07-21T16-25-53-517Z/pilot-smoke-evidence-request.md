# Production Pilot Smoke Evidence Request

Created: 2026-07-21T16:25:53.518Z
Values printed: false

This packet is an approval and evidence aid only. It does not authenticate, send email, create users, hire anyone, write to JewelLink, or write to the JewelHire production database.

Status: needed

## Missing Evidence

| Field | Evidence needed |
| --- | --- |
| `authenticatedSso.director` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `authenticatedSso.manager` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `authenticatedSso.student` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `authenticatedSso.platformAdmin` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `hireHandoff.previewHire` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `hireHandoff.confirmHire` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `hireHandoff.repeatConfirm` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `hireHandoff.revokedCancelledAccess` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `jewelCert.inviteFromJewelLink` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `jewelCert.completeResult` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `jewelCert.syncToJewelLink` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `jewelCert.retryPath` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `publicFailClosed.teamInvites` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |
| `publicFailClosed.resumePrivacy` | result pass, ISO-like observedAt, and an existing docs/qa-runs artifact path |

## Smoke Matrix

| Field | Smoke | Expected result |
| --- | --- | --- |
| `authenticatedSso.director` | Director SSO | JewelLink Director opens JewelHire and lands as JewelHire store_owner for approved pilot locations. |
| `authenticatedSso.manager` | Manager SSO | JewelLink Manager lands as JewelHire manager and cannot access billing, ownership, integrations, or user admin. |
| `authenticatedSso.student` | Student SSO | JewelLink Student lands in applicant portal and cannot access store or admin routes. |
| `authenticatedSso.platformAdmin` | Platform-admin SSO | Allowlisted JewelLink admin lands as JewelHire platform admin only after MFA-backed SSO. |
| `hireHandoff.previewHire` | Preview hire | JewelHire preview shows the expected JewelLink target without unexpected production mutation. |
| `hireHandoff.confirmHire` | Confirm hire | JewelHire creates or reactivates the correct JewelLink user and records the external ID. |
| `hireHandoff.repeatConfirm` | Repeat confirm | Repeating hire confirmation is idempotent and does not create a duplicate JewelLink user. |
| `hireHandoff.revokedCancelledAccess` | Revoked or cancelled access | Cancelled access does not leave a billable or active JewelLink entitlement. |
| `jewelCert.inviteFromJewelLink` | JewelCert invite from JewelLink | JewelHire accepts the bearer-authenticated invite and requires JewelLink SSO before claim. |
| `jewelCert.completeResult` | JewelCert complete result | JewelHire records completion and preserves hired-stage semantics. |
| `jewelCert.syncToJewelLink` | JewelCert sync to JewelLink | JewelLink receives the scoped aggregated result through the bearer-authenticated endpoint. |
| `jewelCert.retryPath` | JewelCert retry path | A simulated delivery failure remains retryable and scoped to the correct store. |
| `publicFailClosed.teamInvites` | Team invite fail-closed | Diamond Exchange invite, resend, role, status, and ownership-transfer attempts return team_invites_disabled without mutation. |
| `publicFailClosed.resumePrivacy` | Resume privacy | Resume asset returns 401 publicly and downloads only for authorized same-store/location user. |

## Verification

Run `npm run qa:pilot-smoke-evidence -- --smoke-evidence-file=<path>` and require the pilot-smoke evidence report to pass before treating authenticated SSO, hire, JewelCert, team-invite, and resume privacy smokes as GO-ready.

Do not place full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, or full production data extracts in the evidence file.
