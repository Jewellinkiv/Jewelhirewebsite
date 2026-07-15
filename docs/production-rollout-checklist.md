# JewelHire production rollout checklist

Updated: 2026-07-15

## Current release-candidate status

- [x] JewelHire release-control hardening is merged on
  `main@4ec2c4796406630b002a602df145491c55e6a20e`; its exact-head push
  validation passed and the production deploy job stayed skipped.
- [x] JewelLink integration CI hardening and the hire-email delivery guard are
  merged on `SmokeMain@c4320a00982d1caa681859b53ec5823321434123`; the guard's
  exact-head CI, the branch push, refreshed promotion PR, and main-source gate
  all passed.
- [x] Production build compiles and TypeScript passes.
- [x] Store owner, manager, location-scoped manager, applicant, and platform-admin role policy audits pass.
- [x] Cross-store application and JewelLink integration isolation checks pass.
- [x] JewelLink SSO, hire handoff, and JewelCert handoff source audits pass.
- [x] Chrome QA confirms the local JewelLink button and profile-menu entry open JewelHire in a new tab.
- [x] Live-like local database QA confirms a JewelLink Director is provisioned as
  `store_owner`, a Manager as location-scoped `manager`, and a Student as an
  applicant with no store membership.
- [x] The one-time SSO exchange completed through both running products, left no
  outstanding authorization code, and rendered the provisioned organization,
  location, and user identity rather than demo branding.
- [x] Pausing the local JewelLink company removes both launchers and direct SSO
  fails closed on a branded retained-data recovery screen.
- [x] Public careers, application, résumé, preview-token, SEO, consent, and aggregate-analytics audits pass.
- [x] Billing, notification wiring, Firebase, legal-source, and invalid-input audits pass. The config-exposure audit passes secret/public-data checks and intentionally holds on explicit live-email acknowledgement.
- [ ] Fresh disposable migration-validation databases have migrations `0012`
  through `0025` applied.
- [x] Production role-readiness audit confirms active users, manager mappings,
  applicants, and at least one active store owner per active store are valid.
- [x] Temporary applications, résumé files, and synthetic analytics used during QA were removed.

## Blocking gates before traffic is moved

Read-only baseline: `premerge-production-baseline.md`. Backup and rollback
evidence template: `production-backup-and-rollback.md`.
The dated owner, window, pilot, email, and observation decisions are recorded
in `production-launch-control-2026-07-13.md`.

- [ ] Replace every `UNASSIGNED` or `UNSELECTED` blocker in the dated launch
  control record, obtain both independent reviews, and explicitly approve the
  maintenance window before merging the final JewelLink promotion PR.

- [ ] Apply the twelve rollback-compatible JewelHire migrations, `0012`
  through `0023_jewelcert_claim_token_version.sql`, with the guarded
  candidate-image job. Apply the thirteenth migration,
  `0024_jewelcert_claim_token_version_fence.sql`, only after the hardened
  revision owns traffic and its public production smoke passes.
  Migrations `0017` and `0018` must exist before the new application-detail and
  analytics queries run. Migration `0019` must fail every preexisting
  JewelLink-linked identity closed to native authentication, expire legacy
  company-unbound account claims, and repair historical outstanding-token
  races. Migration `0022` narrows the final unique outstanding-token rule to
  account claims so password-reset deliveries can settle independently.
  Record the schema state before apply, then record both
  linked-user counts after the no-traffic migration and before SSO is enabled;
  any unexpected linked identity is a stop condition and must follow the
  reviewed, identity-specific exception process in `jewellink-integration.md`.
  Migration `0020` adds only the pending, hashed email-verification state used
  before applicant identity creation. Resends are independent rows so a
  timeout cannot invalidate a link that may already have been delivered; one
  completed identity consumes every outstanding row for that email. The new
  application code must not receive traffic until both the table and the
  `0020_verified_applicant_signups` migration-ledger row are present. Migration
  `0021` adds the durable native-session epoch. Hardened code must not receive
  traffic until its exact ledger row is present; every credential replacement
  advances it atomically, invalidating pre-replacement native cookies without
  changing JewelLink SSO sessions. Native cookies minted by the pre-0021 code
  contain no epoch and will require one fresh sign-in after cutover; brief
  support for that intentional session reset.
  Migration `0022` adds the two-phase password-reset delivery state. Hardened
  code must not receive traffic until readiness verifies its exact ledger row,
  non-null defaulted state/check constraint, account-claim-only unique index,
  and pending-reset index. Provider I/O runs after the neutral response without
  a database connection; accepted/ambiguous delivery makes the newest issued
  link authoritative, definite rejection preserves the prior active link, and
  a later successful request supersedes every older pending or active bearer.
  Migration `0023` is the additive expand phase: it adds the defaulted
  claim-token-version column while remaining compatible with the prior
  revision, so a failed candidate smoke can still restore traffic safely.
  After the hardened revision owns traffic and its public smoke passes,
  migration `0024` is the contract phase: it refuses to apply while any
  version-1 JewelCert invite is still `sent` or `started`, then installs a
  validated constraint requiring claim-token version 2 for every active
  invite. Once `0024` commits, do not restore a pre-v2 application revision.
  Migration `0025` is the additive retained-company billing bridge. The new
  revision fails its checkout/signup surfaces closed with branded `503`
  responses until this migration exists; other system surfaces remain usable.
  Apply it in the same post-promotion migration job immediately after `0024`,
  before enabling or sending any monthly/annual checkout. It adds the opaque
  Checkout Session correlation table and pending-signup billing columns; it
  does not delete or rewrite tenant data.
  Use `npm run db:migrate:verify` before apply; the guarded apply command then
  performs its own pre-apply verification and a
  checksum-aware, zero-pending post-apply verification. The production job sets
  `REQUIRE_EXISTING_MIGRATION_LEDGER=1` and must stop if the ledger is absent.
  Each migration also has a transaction-local 5-second lock timeout and
  2-minute statement timeout. Either timeout is a release stop, never a reason
  to bypass the guard.
- [ ] Apply the seven pending JewelLink integration/auth migrations in order:
  `20260712043000_add_jewelhire_sso_codes`,
  `20260712052000_add_jewelhire_hire_provisioning`,
  `20260712053000_add_jewelhire_jewelcert_results`,
  `20260713120000_add_email_verification`,
  `20260713130000_add_auth_session_policy`,
  `20260714100000_invalidate_company_auth_sessions`, and
  `20260714110000_deactivate_email_integrations_on_company_change`. The last
  migration forces old-company mailbox integrations into a fail-closed,
  inactive state on user tenant reassignment; reconnect the mailbox only in
  the user's current company.
- [ ] Remove the JewelLink web runtime's project-wide Secret Manager accessor
  before creating `MIGRATION_DATABASE_URL`: inventory every current secret
  consumer, grant per-secret access to the existing mounted references plus the
  two runtime integration secrets, validate the proposed policy with a canary
  identity or Policy Simulator, record the exact IAM rollback, remove the
  project binding, immediately validate the current and no-traffic revisions,
  and prove the web runtime cannot read a migration-only test secret. Traffic
  rollback does not undo IAM. Follow the ordered procedure in
  `production-integration-provisioning.md`.
- [ ] Obtain and store a privileged JewelLink `MIGRATION_DATABASE_URL` only
  after the narrow runtime policy passes. The current runtime database user
  cannot create schema objects. A 2026-07-13 read-only ledger comparison found
  109 applied repository migrations, zero failed rows, no applied-but-missing
  drift. The final candidate must show only the seven reviewed JewelLink
  integration/auth migrations above as pending.
  Re-run and record that comparison against the exact no-traffic candidate
  before executing the migration job.
- [ ] Record the JewelLink production dependency audit disposition. On
  2026-07-13, `npm audit --omit=dev --audit-level=high` passes with zero high or
  critical findings and reports three moderate advisories in Prisma tooling.
  Keep the report with the release evidence and do not broaden the dependency
  upgrade inside this cutover.
- [ ] Configure `JEWELLINK_URL=https://ai.jewellink.com`, `JEWELLINK_SSO_SHARED_SECRET`, and `JEWELLINK_INTEGRATION_SHARED_SECRET` on the JewelHire Cloud Run service. They are absent from the current production revision and no matching Secret Manager entries exist yet.
- [ ] Configure the server-only `JEWELHIRE_TEAM_INVITES_ENABLED=0` on JewelHire
  for the Diamond Exchange pilot. Secure tokenized team-invitation acceptance
  is deferred; the current placeholder user/company invite, resend, role
  activation/change, owner demotion, and ownership-transfer controls must stay
  disabled. Existing-user list/read/remove and the separately hardened
  retained-owner access-link workflow remain available. The production default
  is off, and the deploy prerequisite requires an explicit `0` before it will
  create a candidate revision.
- [ ] Configure `JEWELHIRE_TRUSTED_PROXY_HOPS` on JewelHire after observing the
  no-traffic candidate's actual Google proxy chain. Google appends its trusted
  addresses to the right side of `X-Forwarded-For`; the application selects the
  client from that right edge and deliberately ignores caller-supplied values
  on the left. Prove two requests with different spoofed leftmost values but the
  same real client land in one limiter bucket, while two real canary clients do
  not. Production uses the shared `unknown` bucket until this value is explicit.
- [ ] Configure the matching high-entropy SSO and integration secrets on the production JewelLink service and verify its JewelHire callback/base URL points to `https://app.jewelhire.com`.
- [x] JewelLink PR `#168` landed and validated the hire-email guard on the final
  promotion head: disabled by default, allowlist-only for controlled
  no-traffic testing, live mode only by explicit configuration,
  `invitationSent=true` only after confirmed provider success, and durable
  claim fencing that prevents a replay from sending twice.
- [ ] Deploy the current release candidate. The currently deployed revision redirects `/privacy` and `/terms` to login; the local release candidate returns `200` for both.
- [ ] Use `POSTMARK_DRY_RUN=true` only on an isolated no-traffic candidate. In
  that posture applicant signup intentionally returns a branded unavailable
  response because a dry run cannot deliver the secret verification token.
  Before production traffic moves, set JewelHire
  `EMAIL_NOTIFICATIONS_ENABLED=true`, `POSTMARK_DRY_RUN=false`, keep the
  Postmark token secret-backed, verify the sender/stream, and explicitly
  acknowledge live email in the guarded workflow. Keep JewelLink hire email
  disabled until its separate allowlisted send gate is approved.
- [ ] Create the production GitHub environment secret
  `JEWELHIRE_RELEASE_PROBE_EMAIL` for a controlled mailbox. The deploy workflow
  submits exactly one applicant-signup request to the tagged no-traffic
  candidate after migration and page smoke checks. Only a provider-accepted
  `202` may advance; invalid Postmark credentials, sender, stream, timeout, or
  synchronous rejection must stop before traffic movement. Do not use a real
  applicant address, and allow for the route's three-requests-per-hour mailbox
  limit when retrying a release.
- [ ] Approve the password-reset transport cutover. New links are versioned
  `pr2_` bearers delivered only after `#token=`. Every link issued by the old
  query-string revision is deliberately rejected after traffic moves, even if
  its 60-minute database expiry has not elapsed; the branded invalid-link state
  directs the user to request a fresh link. Brief support for this expected
  cutover behavior and do not add legacy query-token compatibility.
  Verify a known and an unknown mailbox return the neutral response before any
  provider task completes, and verify reversed concurrent provider outcomes
  still leave only the newest successfully delivered request usable.
- [ ] Approve the retained-account claim transport cutover. New owner-access
  links are versioned `ac2_` bearers delivered only after `#token=` and previewed
  through a no-store POST body. Every old `/claim-account?token=...` link is
  deliberately rejected because it may already exist in HTTP logs or browser
  history. Export all outstanding `account_claim` rows before deployment, mark
  them used, and resend fresh links from the exact no-traffic candidate or the
  hardened production revision. Confirm each new message contains
  `/claim-account#token=ac2_...` and brief support on the expected invalid-link
  screen for any pre-cutover email.
- [ ] Invalidate and resend every outstanding JewelCert invite whose status is
  `sent` or `started` before traffic moves. The hardened bearer is a v2 HMAC
  over both invite ID and normalized recipient; the previous inviteId-only
  bearer is deliberately rejected. Safe compatibility is impossible because
  the database does not retain recipient history, so accepting an old bearer
  after reassignment could authorize the wrong email. Export the affected
  invite IDs/recipients for reconciliation, mark the old rows cancelled, then
  set the workflow's `legacy_jewelcert_invites_cleared` confirmation, and let
  migration `0024` independently fail if even one active legacy row remains.
  Once the hardened revision owns traffic, create replacement invites through
  the store workflow or have JewelLink retry with a new idempotency key. Confirm
  every replacement email uses `/jewelcert/claim/<id>#t=...`, and prove each old
  `?t=` link fails before enabling traffic. Do not bulk-reactivate the old rows
  or translate the inviteId-only HMAC.
- [ ] Exercise one controlled dry-run application confirmation and one manager
  notification and verify the `dry_run`/non-delivery result. Verify provider
  metadata scrubbing with static/mock payload-capture evidence. Any later
  live-provider smoke is an explicit controlled-mailbox approval gate.
  Applicant signup verification is covered by the mock-delivery PostgreSQL
  suite, and the required no-traffic workflow probe supplies the controlled
  real provider acceptance check before public use.
- [ ] Exercise one Stripe test-mode checkout and signed webhook reconciliation against the release candidate. The code/readiness audit is green, but no checkout mutation was performed in this QA pass.
- [ ] Create exact recurring USD Stripe Prices for `$149/month` and
  `$1,299/year`, configure their ids as
  `STRIPE_STORE_OWNER_MONTHLY_PRICE_ID` and
  `STRIPE_STORE_OWNER_ANNUAL_PRICE_ID`, and retain `STRIPE_SECRET_KEY` plus
  `STRIPE_WEBHOOK_SECRET` as secret-backed settings. Production currently has
  only the legacy `STRIPE_STORE_OWNER_PAYMENT_LINK`, which the hardened flow
  deliberately does not use.
- [ ] Deactivate the legacy shared Payment Link only after confirming it has no
  open or unsettled sessions. Let any outstanding session expire or handle it
  under an explicitly reviewed cutover; do not accept its unbound direct
  company/store references in the hardened webhook.

## Deployment order

1. Back up both production databases and record both current Cloud Run revisions.
2. Provision the integration secrets and dedicated JewelLink migration identity
   using `production-integration-provisioning.md`.
3. Deploy JewelLink from the reviewed `origin/main` with the JewelHire rollout
   master switch disabled. Its script creates a no-traffic candidate, applies
   migrations from that candidate's immutable image, smokes `/login`, and only
   then moves traffic.
4. Mount the JewelLink URL and both shared secrets on JewelHire with no traffic,
   and explicitly set `JEWELHIRE_TEAM_INVITES_ENABLED=0` for the Diamond
   Exchange pilot.
5. Configure the JewelHire production revision with live Postmark delivery,
   the secret-backed server token, reviewed sender/stream, and the controlled
   `JEWELHIRE_RELEASE_PROBE_EMAIL` GitHub environment secret. Explicitly approve
   the live-email workflow input; a dry-run revision cannot pass verified
   applicant signup.
6. Run the manual JewelHire production workflow. It creates a no-traffic
   candidate, applies the rollback-compatible migrations through `0023` from
   the exact candidate image, smokes public routes, sends the single controlled
   signup-provider probe, and only then moves traffic. The workflow verifies
   public production routes while rollback to the recorded pre-v2 revision is
   still safe; after that succeeds it applies the `0024` contract fence and
   applies additive `0025`, and runs the full no-write database-readiness check.
   Once `0024` commits, only a
   v2-writing revision is a valid rollback target.
7. Create a second JewelLink no-traffic candidate with `pilot` mode and one
   approved company ID. Run the full SSO and role smoke against its tagged URL
   before explicitly promoting it.
8. Run the post-deploy checks below. Roll traffic back to the recorded revision
   if any blocking check fails. The rollback revision must already enforce
   `native_auth_epoch`; never restore traffic to pre-0021 application code after
   epoch-aware traffic has begun.

## Required post-deploy smoke

- [ ] `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, `/signup`,
  `/verify-email`, and `/signup/store` return `200` without a session.
- [ ] The no-traffic signup probe returned `202`, the controlled mailbox
  received the neutral/setup message, and no recipient or token appeared in
  workflow or Cloud Run request logs.
- [ ] A controlled standalone applicant receives a password-reset URL with the
  bearer only after `#token=`, the browser immediately scrubs it, one reset
  succeeds, replay fails, every native cookie minted before the reset is denied,
  and neither token appears in HTTP or Cloud Run logs.
- [ ] Unauthenticated private APIs return `401`; a store owner cannot access platform-admin APIs.
- [ ] JewelLink Director opens JewelHire in a new tab and lands as store owner.
- [ ] JewelLink Manager lands as manager, can access scoped hiring pages, and cannot access billing, ownership, integrations, or user administration.
- [ ] JewelLink Student lands in the applicant portal and cannot access store or admin routes.
- [ ] Diamond Exchange store and platform-admin user lists remain readable,
  non-owner users remain removable, and every team invite/resend, company
  creation, invited-user role/status update, and ownership-transfer attempt
  returns branded `team_invites_disabled` without a database mutation.
- [ ] A published careers page loads on mobile with no horizontal overflow and its open job can reach step 2 of the application flow.
- [ ] A private draft preview is `noindex`, cannot submit, and a modified preview token returns `404`.
- [ ] One controlled application with a small PDF résumé creates exactly one application; retrying the same idempotency key creates no duplicate.
- [ ] The résumé returns `401` publicly and downloads only for an authorized user in the same store/location scope.
- [ ] The careers dashboard shows real page views, apply starts, submissions, locations, and activity with no demo counts.
- [ ] A JewelHire hire sync creates or links the expected JewelLink user and records the external ID.
- [ ] A JewelCert invitation and completed result reach JewelLink and remain retryable on a simulated delivery failure.

## Rollback conditions

Roll back traffic immediately for cross-store data exposure, role escalation, invalid SSO role mapping, repeated application creation, public résumé access, migration errors, sustained 5xx responses, or notification delivery to unintended recipients.
