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

External JewelLink employee invites remain SSO-only. The invite email carries
a recipient-bound claim bearer in the URL fragment, but that bearer never
creates a native password identity when the invite has a JewelLink external
user or a trusted `jewellink_employee` application origin. A first-time Student
or Consultant is sent through JewelLink MFA, provisioned as an applicant, and
returned to the exact `/bundle/<inviteId>` path. Recipient reassignment takes a
shared invite-scoped transaction lock and invalidates the old recipient's HMAC.
The native-claim path uses that same invite lock before its email and row locks,
so an idempotent resend cannot deadlock against profile adoption.

JewelHire store-owner Settings includes a JewelLink integration health panel.
It reports missing URL/secret configuration and lists pending or failed hire
and JewelCert result handoffs. Each retry is verified against the active store
before the idempotent server-to-server operation is attempted again. Managers
cannot access this owner-only operations surface.

### Pilot team-onboarding boundary

Secure, tokenized acceptance for store/company team invitations is deferred to
a post-pilot invitation-system slice. The existing placeholder invitation
records and login-only email do not prove recipient ownership and must not be
used for production onboarding.

For the Diamond Exchange pilot, set the server-only
`JEWELHIRE_TEAM_INVITES_ENABLED=0`. With that control disabled, JewelHire keeps
existing-user read/list/remove and retained-owner secure access-link workflows
available, but fails closed before creating a company or team invite, resending
an invite, activating or re-roling an invited user, demoting an owner, or
transferring store ownership. Production defaults this policy to disabled when
the variable is absent; the deploy workflow additionally requires the explicit
value `0` so an accidental service setting cannot enable the unfinished flow.

## Role policy

| JewelLink role | JewelHire access | Location policy | Billing/settings |
| --- | --- | --- | --- |
| STUDENT, CONSULTANT | Applicant/associate portal | Self only | None |
| MANAGER | Manager | Primary + `UserLocationAccess` grants | No owner billing/settings |
| DIRECTOR | Store owner by default; configurable to manager | All company locations | Owner only when mapped to owner |
| ADMIN | Store owner | All company locations | Owner access |
| SUPER_ADMIN | No automatic platform-admin grant | JewelHire allowlist only | JewelHire allowlist only |

Every other role value, including legacy `TEACHER` and differently-cased or
whitespace-padded variants, is rejected before JewelHire provisioning begins.
`SUPER_ADMIN` is accepted only when the normalized email is independently
present in JewelHire's platform-admin allowlist.

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

### Retained-account and native-auth migration policy

Migration `0019_jewellink_native_auth_policy.sql` fails closed by setting
`native_auth_enabled=false` for every identity already linked to JewelLink.
Do not infer a historical account-claim conversion from action-token
`used_at` values or password timestamps: token invalidation writes the same
`used_at` field, so those timestamps are not proof that a user redeemed a
retained-account claim.

Production has not yet applied the JewelLink SSO migration tranche, so the
expected linked-identity count is zero. Apply the tranche to a no-traffic
candidate, then run this query before permitting any SSO traffic (the
`jewellink_user_id` and `native_auth_enabled` columns are introduced by `0014`
and `0019` respectively):

```sql
select count(*) as linked_users,
       count(*) filter (where native_auth_enabled) as linked_native_users
from users
where jewellink_user_id is not null;
```

Both counts must be zero. Any linked row is a stop condition because the
candidate has accepted no SSO traffic. If `0014` is unexpectedly already
present before the tranche runs, record the linked-user count before applying
`0019` as well.

An exception may only be restored after an identity-by-identity review
confirms the current standalone company entitlement and a previously completed
conversion. Record
the user, company, entitlement evidence, approving operator, reviewer, change
ticket, and timestamp in the release evidence, and write a matching immutable
audit entry. Never run a bulk or timestamp-derived override. New conversions
must use the super-admin claim-link workflow; issuance and successful
redemption are both audited. Each token durably records the exact authorizing
company, and redemption rechecks that company's current standalone entitlement
and the user's active owner membership even when `users.company_id` points
somewhere else. Only that company's active JewelLink memberships and location
scopes become manual. Issuance holds a per-user database lock through delivery;
a failed replacement rolls back without invalidating a prior valid link, while
the partial unique index permits only one outstanding account-claim token per
user.
Password creation, scoped membership ownership, account-claim consumption,
password-reset invalidation, native-session epoch advance, and the redemption
audit entry commit atomically. Advancing the epoch is required because the
claim replaces a native credential. The epoch itself is ignored by JewelLink
SSO sessions, which remain governed by the existing auth-source exclusivity
policy and upstream MFA assurance.
New claims use a versioned `ac2_` bearer carried only in the URL fragment;
pre-cutover query-string claim links are rejected and must be invalidated and
reissued during the production cutover.

## Required deployment order

1. Back up both production databases.
2. Provision the two shared-secret pairs and the dedicated JewelLink migration
   service account using `production-integration-provisioning.md`.
3. Deploy JewelLink through its guarded `deploy.sh`. It applies
   `20260712043000_add_jewelhire_sso_codes`,
   `20260712052000_add_jewelhire_hire_provisioning`,
   `20260712053000_add_jewelhire_jewelcert_results`,
   `20260713120000_add_email_verification`,
   `20260713130000_add_auth_session_policy`,
   `20260714100000_invalidate_company_auth_sessions`, and
   `20260714110000_deactivate_email_integrations_on_company_change` from the
   immutable no-traffic candidate image before traffic moves. The final
   migration forces old-company mailbox integrations into a fail-closed,
   inactive state when a user is reassigned to another tenant; the user must
   reconnect the mailbox inside the current company before it can be used
   again.
4. Deploy JewelHire through its manual production workflow. It applies the
   rollback-compatible migrations `0012` through `0023` from the immutable
   no-traffic candidate image before traffic moves. After the hardened revision
   owns traffic and its public production smoke passes, the workflow applies
   the `0024` JewelCert v2 contract fence and runs full readiness. Readiness
   must verify the native-session epoch, password-reset delivery-state, and v2
   claim-token invariants. After `0024` commits, only a v2-writing revision is a
   valid rollback target. Independently, a rollback target after durable epoch
   revocation has been exercised must be epoch-aware; pre-0021 code is unsafe.
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
- `JEWELHIRE_TEAM_INVITES_ENABLED=0` (required for the Diamond Exchange pilot)

## Next integration slices

1. Build secure, expiring, single-use, recipient-bound team invitation
   acceptance before enabling `JEWELHIRE_TEAM_INVITES_ENABLED` in production.
2. Add per-user JewelCert result history and resend controls in JewelLink.
3. Add alerting when a failed handoff remains unresolved beyond an agreed SLA.
4. Decide whether future paid JewelLink tiers include a monthly assessment
   allowance or continue with unlimited employee assessments.
