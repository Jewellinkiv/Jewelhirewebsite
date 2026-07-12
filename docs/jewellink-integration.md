# JewelLink Integration

## Implemented foundation

JewelLink launches a 60-second, single-use authorization code. The raw code is
sent through the browser to JewelHire, while JewelLink stores only its SHA-256
digest. JewelHire exchanges the code server-to-server with a shared secret,
provisions the linked organization/user/location records, and creates its own
signed session cookie.

JewelHire and JewelLink do not share cookies, database credentials, or session
signing keys.

Confirmed hires now use an idempotent server-to-server provisioning endpoint.
JewelHire records the hire and a pending synchronization first; JewelLink then
creates or reactivates the user in the linked company/location and sends its
standard 72-hour password-setup email when the account needs one. Failed
provisioning does not undo the hire and can be retried through the hire-sync API.

JewelLink managers, directors, and administrators can send JewelCert 4 Types
from User Management. JewelHire creates a secure, idempotent employee assessment
invite and emails it through the existing JewelCert delivery flow. Completed
type, V/C/F/D mix, fit score, rating, and completion time are returned to
JewelLink. The User Management screen shows the location-scoped aggregate
salesfloor profile. Employee assessments remain separate from JewelHire's
recruiting pipeline and do not change the employee's hired state.

JewelHire store-owner Settings includes a JewelLink integration health panel.
It reports missing URL/secret configuration and lists pending or failed hire
and JewelCert result handoffs. Each retry is verified against the active store
before the idempotent server-to-server operation is attempted again. Managers
cannot access this owner-only operations surface.

## Role policy

| JewelLink role | JewelHire access | Location policy | Billing/settings |
| --- | --- | --- | --- |
| STUDENT, CONSULTANT, TEACHER | Applicant/associate portal | Self only | None |
| MANAGER | Manager | Primary + `UserLocationAccess` grants | No owner billing/settings |
| DIRECTOR | Store owner by default; configurable to manager | All company locations | Owner only when mapped to owner |
| ADMIN | Store owner | All company locations | Owner access |
| SUPER_ADMIN | No automatic platform-admin grant | JewelHire allowlist only | JewelHire allowlist only |

Set `JEWELHIRE_JEWELLINK_DIRECTOR_ROLE=manager` when Directors should not have
owner/billing access. Managers remain selected-location scoped unless
`JEWELHIRE_JEWELLINK_MANAGER_ALL_LOCATIONS=1` is explicitly configured.

## Entitlement policy

The organization receives one `jewellink_included` entitlement with plan code
`jewellink_free` and amount `0`. This is organization-level, not per-user.
Stripe remains the entitlement source for organizations without JewelLink:

- $149 monthly
- $1,299 yearly
- one subscription per organization

Future special JewelLink pricing should update the organization entitlement;
it should not change authentication or individual user roles.

## Required deployment order

1. Back up both production databases.
2. Provision the two shared-secret pairs and the dedicated JewelLink migration
   service account using `production-integration-provisioning.md`.
3. Deploy JewelLink through its guarded `deploy.sh`. It applies
   `20260712043000_add_jewelhire_sso_codes`,
   `20260712052000_add_jewelhire_hire_provisioning`, and
   `20260712053000_add_jewelhire_jewelcert_results` from the immutable
   no-traffic candidate image before traffic moves.
4. Deploy JewelHire through its manual production workflow. It applies
   migrations `0012` through `0018` from the immutable no-traffic candidate
   image before traffic moves.
5. Test one user for each role and verify replaying an exchanged code fails.
6. Verify a Manager cannot read another location or access billing/settings.
7. Send one employee JewelCert per role scope, complete it, and verify the
    location-scoped result and salesfloor profile in JewelLink.

## Environment

JewelLink:

- `JEWELHIRE_URL=https://app.jewelhire.com`
- `JEWELHIRE_SSO_SHARED_SECRET=...`
- `JEWELHIRE_INTEGRATION_SHARED_SECRET=...`

JewelHire:

- `JEWELLINK_URL=https://ai.jewellink.com`
- `JEWELLINK_SSO_SHARED_SECRET=...`
- `JEWELLINK_INTEGRATION_SHARED_SECRET=...`
- `JEWELHIRE_JEWELLINK_DIRECTOR_ROLE=store_owner`
- `JEWELHIRE_JEWELLINK_MANAGER_ALL_LOCATIONS=0`

## Next integration slices

1. Add per-user JewelCert result history and resend controls in JewelLink.
2. Add alerting when a failed handoff remains unresolved beyond an agreed SLA.
3. Decide whether future paid JewelLink tiers include a monthly assessment
   allowance or continue with unlimited employee assessments.
