# JewelHire integration safe-promotion plan

Updated: 2026-07-13

## Objective

Land the JewelHire integration without exposing current JewelLink users or
production traffic to an unvalidated change. Risk cannot be made literally
zero, so the release must be dark, reversible, observable, and stopped at every
gate unless the evidence is green.

Nothing in this plan authorizes a push, PR merge, production configuration
change, migration, email, or deployment.

## Current verified state

- JewelLink `main`: `83de30f51276f5c0c8abfa61d7157d1fe0e847bf`
- JewelLink `SmokeMain`: `f9ff3b98ca5154d5530e741ce1d0f4c26a3b18c7`
- The `main` and `SmokeMain` Git trees are currently identical.
- Validated local integration: `5577fe110ab0404e6c5c6a833bedfa6de8215905`
- Integration divergence: four commits ahead of `main`, zero behind
- Content diff: 18 paths, 923 additions, 19 deletions
- Production traffic observed at planning time: 100% on
  `jewellink-dev-01058-noh` (`auth-enrollment-pilot` tag)

The integration diff contains:

- three additive, non-destructive tables;
- five authenticated/server-secret integration endpoints;
- the branded integration status page and new-tab launchers;
- JewelCert controls in User Management;
- a Prisma-enabled runtime image and guarded migration/deployment workflow;
- environment documentation, icon, and source audit.

Local validation already passes 307 web tests, five isolated PostgreSQL
transaction tests, TypeScript, scoped lint with zero errors, the production
build, Expo 18/18, Docker runtime inspection, `/login`, and the complete
JewelHire/JewelLink cross-product suite.

## Risks that must be closed before publishing

| Risk | Current state | Required control |
| --- | --- | --- |
| Unreviewed/direct merge | This private repository cannot currently expose GitHub branch-protection/ruleset controls on its plan | Prefer upgrading GitHub to enable required CI and two approvals; otherwise use a documented release freeze, two named reviewers, and one named merge operator with no direct pushes |
| Automatic production deployment | Regional Cloud Build trigger `7759551b-7d80-4cb3-8f1c-1e4f3701d1fd` deploys every accepted `main` build directly to the Cloud Run service and bypasses `deploy.sh` | Disable it for the release freeze and replace it with build-only automation plus an explicit manual no-traffic deployment |
| No emergency feature kill switch | No JewelHire enable/rollout flag exists | Add a fail-closed global flag and company pilot allowlist before any UI or integration route can activate |
| Candidate auto-promotes after one smoke | Current guarded script moves all traffic immediately after `/login` succeeds | Split candidate creation/migration/smoke from the later, separately approved promote command |
| Database change | Three new tables are applied to the production database | Test exact migrations on a recent clone, confirm backup, record timing/locks, and keep rollback forward-only; old code must ignore the additive tables |
| Existing user surfaces change | Header and User Management change for existing users | Hide all JewelHire UI while rollout is off; enable only for an internal pilot company after the dark deployment is stable |

## Stage 0 — Release freeze and recovery baseline

1. Name the release owner, database owner, reviewer 1, reviewer 2, and rollback
   operator.
2. Announce a merge freeze for JewelLink `main` and `SmokeMain` during the final
   validation and promotion window.
3. Fetch both branches and record their exact SHAs and Git trees.
4. Record the live Cloud Run revision, image digest, traffic allocation, and
   tagged revisions.
5. Create and verify current JewelLink and JewelHire Git bundles.
6. Confirm fresh logical backups for both product databases and a restore test
   or recent restore evidence.

Gate: branches are stable, all owners are named, recovery artifacts verify, and
the previous production revision is recorded.

## Stage 1 — Remove uncontrolled deployment paths

1. Temporarily disable the existing Cloud Build auto-deploy trigger before any
   integration branch is pushed. A previous non-`main` branch build used this
   trigger, so its branch filter is not sufficient release protection.
2. Replace it with one of these approved patterns:
   - build and test only on PR/branch events, with no `gcloud run services
     update`; or
   - build an immutable image on `main`, but require a separate manual approval
     to deploy it with no traffic.
3. Change `deploy.sh` into explicit operations:
   - `candidate`: build/deploy no traffic, resolve immutable digest, migrate,
     and smoke without changing traffic;
   - `promote`: move traffic only to a previously validated revision;
   - `rollback`: restore the recorded revision without rebuilding.
4. Add a test that fails if any automated PR or `main` path can move production
   traffic directly.

Gate: pushing a branch and merging code cannot change Cloud Run traffic.

## Stage 2 — Add dark-launch controls

Add a server-side rollout policy with these states:

- `off` — default; integration routes fail closed, JewelHire launchers and
  JewelCert controls are hidden, and existing JewelLink behavior is unchanged;
- `pilot` — only explicitly allowlisted company IDs can see/use the integration;
- `all` — available to all eligible JewelLink companies after pilot approval.

The same centralized policy must protect:

- SSO start and exchange;
- hire provisioning;
- JewelCert invitation and result routes;
- top-bar/profile launchers;
- User Management JewelCert actions and summary.

Server secrets remain mandatory and timing-safe checks remain in place. A
missing or malformed rollout configuration must resolve to `off`. Add tests for
off, allowlisted pilot, non-allowlisted pilot, all, missing secrets, and the
existing Director/Manager/Student role map.

Gate: the complete integration can be deployed with zero visible or writable
behavior until explicitly enabled.

## Stage 3 — Repackage the current diff into focused PRs

Keep `5577fe11` and its verified bundle as the recovery/reference branch. Create
fresh release branches from the exact current `SmokeMain` rather than rewriting
the validated branch.

Recommended PR sequence into `SmokeMain`:

1. **Deployment safety and rollout controls**
   - build-only automation/manual deployment separation;
   - candidate/promote/rollback commands;
   - global off/pilot/all policy and tests;
   - no visible JewelHire UI.
2. **Dark backend foundation**
   - three additive migrations;
   - SSO, hire, and JewelCert routes behind the off-by-default policy;
   - runtime Prisma tooling, environment contract, and integration audit;
   - no visible JewelHire UI.
3. **Pilot-gated user experience**
   - branded integration page;
   - header/profile new-tab launchers;
   - User Management JewelCert controls and summary;
   - all surfaces hidden outside the pilot policy.

Each PR remains draft until its own diff is small, reviewed, and green. Use
squash merges into `SmokeMain` so the eventual promotion diff contains three
auditable commits without historical merge noise.

Required checks on every PR:

- committed-secret scan and high-severity dependency gates;
- Prisma generation and migration validation;
- TypeScript and scoped lint with zero errors;
- 307+ web tests and the PostgreSQL lifecycle integration suite;
- Expo dependency alignment, mobile TypeScript, and Expo Doctor;
- Next.js production build;
- JewelHire integration audit and cross-product source contracts.

Gate: all three PRs are merged only into `SmokeMain`; `main` and production are
unchanged.

## Stage 4 — Stateful staging acceptance

1. Build one immutable image from the exact final `SmokeMain` SHA.
2. Apply the seven reviewed integration/auth migrations to an isolated database
   restored from a recent production-shaped backup.
   `20260714110000_deactivate_email_integrations_on_company_change` must prove
   that moving a user to another tenant forces every old-company mailbox
   integration into a fail-closed, inactive state until it is reconnected
   inside the current company.
3. Run both products with matched synthetic secrets and rollout mode `pilot`.
4. Execute the complete stateful role matrix:
   - Director becomes JewelHire store owner;
   - Manager becomes location-scoped manager with no billing/settings/admin;
   - Student and Consultant become applicants;
   - no JewelLink role becomes JewelHire platform admin.
5. Prove one-time SSO expiry/replay rejection, idempotent provisioning, hire
   retry, JewelCert invite/result retry, cancellation retention/claim recovery,
   tenant isolation, public application, résumé privacy, analytics, and no
   unintended email.
6. Run regression smokes for JewelLink login/2FA, Expo authentication, CRM
   inbox, UP System, POS read-only flows, User Management, and public forms.

Gate: machine-readable stateful evidence is green and no existing JewelLink
workflow regresses.

## Stage 5 — Code-only promotion to `main`

1. End the merge freeze only long enough to synchronize `SmokeMain` with any
   approved `main` movement, then rerun the complete checks.
2. Open one `SmokeMain` to `main` promotion PR showing only the reviewed final
   integration and authentication commits.
3. Require two named approvals and green CI on the exact promotion SHA. The
   author does not perform the final merge.
4. Keep the automatic deployment trigger disabled.
5. Merge the code and verify GitHub CI on the resulting `main` commit.

Gate: code is on `main`, production still serves the recorded prior revision,
and rollout mode remains off.

## Stage 6 — Dark production candidate

1. Reconfirm both database backups and the previous Cloud Run revision.
2. Confirm the two JewelHire shared secrets, Twilio Verify/two-factor secrets,
   and dedicated migration identity without exposing values.
3. Build the exact `main` SHA and deploy it as a tagged no-traffic candidate.
4. Resolve and record its immutable image digest.
5. Run the migration job from that candidate image. Do not down-migrate on
   rollback; the added tables remain safely unused by the previous revision.
6. Smoke the candidate tag with rollout mode off:
   - `/login` and authentication;
   - health/readiness;
   - existing CRM, UP, POS, settings, and public-form paths;
   - integration endpoints reject/disable without writing data.
7. Hold the candidate for explicit reviewer approval. Do not promote
   automatically.

Gate: candidate and migrations are healthy, existing production traffic is
unchanged, and rollback remains one command.

## Stage 7 — Promote dark, then pilot

1. Promote the validated candidate while the JewelHire rollout remains off.
2. Run the existing-product smoke suite immediately and observe error rate,
   latency, authentication failures, and logs for at least 30 minutes.
3. If stable, enable `pilot` for one internal company only.
4. Test Director, Manager, Student, hire, JewelCert, and cancellation recovery
   through real browser sessions without sending uncontrolled email.
5. Observe the pilot for at least one business day before adding companies.
6. Expand the allowlist in small groups. Move to `all` only after an explicit
   product and operations approval.

Gate: every expansion has a named approver, timestamp, evidence, and immediate
kill-switch/rollback path.

## Stop and rollback conditions

Immediately set rollout mode to `off` and restore the previous Cloud Run
revision for any of these:

- login, 2FA, mobile authentication, CRM, UP, POS, or public forms regress;
- a user receives the wrong JewelHire role or location scope;
- cross-company data is visible;
- SSO codes can be replayed or used after expiry;
- duplicate users, hires, invitations, or results are created;
- unexpected email/SMS is sent;
- migration errors, elevated 5xx rate, latency regression, or candidate health
  failure occurs.

If an authorization or secret boundary is implicated, disable the feature,
roll back traffic, and rotate the affected integration secret. Preserve the
additive tables and evidence for diagnosis rather than attempting a destructive
database rollback.

## First implementation tranche

Before opening any integration PR:

1. Disable or replace the uncontrolled Cloud Build deploy trigger.
2. Implement and test the off/pilot/all rollout policy.
3. Split candidate creation from traffic promotion and rollback.
4. Create the three clean `SmokeMain` PR branches from current refs.

Only after these four items are complete should the current integration code be
published for review.
