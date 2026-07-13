# JewelHire/JewelLink pre-merge phased plan

Updated: 2026-07-13

## Objective

Use the wait for the large JewelLink iOS/production merge to make the
JewelHire release reproducible, reviewable, and ready to re-integrate without
merging or deploying the current JewelLink work prematurely.

## Operating rules until the JewelLink merge lands

- Do not merge the current JewelLink integration work into `main`.
- Do not deploy either product to production from a dirty worktree.
- Do not create production secrets, run production migrations, move Cloud Run
  traffic, or send live QA email without a separate approval.
- Do not resolve JewelLink dependency findings against the current lockfile;
  the incoming merge may replace the relevant dependency tree.
- Keep the JewelHire/JewelLink API contract and migration names stable unless a
  blocking defect requires a change.
- Use synthetic data and the isolated `jewelhire_sso_qa` database for QA.

## Current scope boundary

Baseline recorded on 2026-07-12:

| Repository | Local HEAD | Fetched `origin/main` | Changed paths |
| --- | --- | --- | --- |
| JewelHire | `ec37568b7261` | `ec37568b7261` | 147 |
| JewelLink | `fbff744d6820` | `9a163831113e` | 17 |

These SHAs are preservation references, not deployment approvals. Re-record
them immediately before creating the holding branches because `origin/main`
may advance while the external merge is in progress.

### JewelHire release set

The JewelHire worktree contains the release candidate across SSO and role
policy, cancellation recovery, public careers/applications, private résumés,
analytics, legal consent, access controls, deployment guards, and QA scripts.
Migrations `0012` through `0018` are part of this release.

### JewelLink integration set

High-conflict files:

- `src/components/layout/header.tsx`
- `src/components/layout/sidebar.tsx`
- `src/app/(dashboard)/settings/users/page.tsx`
- `package.json`
- `Dockerfile`
- `deploy.sh`
- `.env.example`

Lower-conflict additive files:

- `src/app/api/integrations/jewelhire/**`
- `src/app/integrations/jewelhire/page.tsx`
- `public/jewelhire-icon.svg`
- `scripts/audit-jewelhire-sso.mjs`
- migrations `20260712043000`, `20260712052000`, and `20260712053000`

The local copies of migrations `20260710120000` and `20260710133000` match
the already-fetched remote versions and are not JewelHire integration work.
`tsconfig.tsbuildinfo` is generated build output and must not be treated as an
intentional integration change.

## Phase 0 — Preserve and lock the work

Status: completed locally on 2026-07-12.

Evidence:

- JewelHire holding branch: `codex/jewelhire-launch`
- JewelHire preservation commit: `900b38ac0ee0`
- JewelLink holding branch: `codex/jewellink-integration-hold`
- JewelLink preservation commit: `cbf4ce224e2b`
- Both worktrees were clean after preservation.
- Neither holding branch existed on its GitHub remote after preservation.
- Verified complete-history bundles were written under
  `/Users/williamjonesiv/Desktop/jewelhire-premerge-backups/2026-07-12/`.

Actions:

1. Record the current local and `origin/main` SHAs for both repositories.
2. Create dedicated holding branches:
   - `codex/jewelhire-launch`
   - `codex/jewellink-integration-hold`
3. Review untracked/generated files before staging; exclude secrets, local QA
   artifacts, `.env*`, build caches, and `tsconfig.tsbuildinfo`.
4. Capture a named patch bundle in a secure local handoff directory as a second
   recovery path.
5. Verify both holding branches can be checked out and rebuilt without relying
   on unstaged files.

Gate:

- Every intentional change exists in a local commit or recovery patch.
- No credential or generated build artifact is included.
- Nothing has been pushed, merged, or deployed unless separately approved.

## Phase 1 — Curate the JewelHire release candidate

Status: completed locally on 2026-07-12.

Evidence:

- Curated branch: `codex/jewelhire-release-curated`
- Foundation commit: `a216431`
- Role/public-experience commit: `7aa4803`
- QA automation commit: `0a73aee`
- Rollout/runbook commit: `988a8e3`
- The curated branch and preservation branch resolved to the identical Git tree
  `8b04aee26bea6e47631348ec8dab669eac046bb7` before this evidence update.
- The release set contains 149 changed paths relative to `origin/main`; generated
  `.next-*` output is ignored and not committed.

Organize the JewelHire release into reviewable commits:

1. Database migrations and persistence.
2. Authentication, SSO, role/location access, and cancellation recovery.
3. JewelLink hire/JewelCert integration contracts.
4. Public careers builder, mobile applications, résumé privacy, and analytics.
5. Dashboard/applicant UX fixes found during load QA.
6. Deployment workflow, runbooks, and QA automation.

Validation:

- `npm run lint`
- `npm run build`
- `npm audit --audit-level=moderate`
- role, auth, access-control, legal, notification, billing, public-careers, SSO,
  hire, and JewelCert audits
- `git diff --check`

Validation result:

- Production build and TypeScript checks passed.
- ESLint passed with 0 errors and 46 warnings.
- `npm audit --audit-level=moderate` reported 0 vulnerabilities.
- Access-control, authentication, invalid-input, legal, role-model,
  signup-policy (against the local candidate), notification, billing,
  public-careers, SSO, hire, and JewelCert audits passed.
- The read-only production checks recorded two cutover prerequisites rather
  than changing production: the current live revision does not yet expose
  `/privacy` and `/terms`, and live email is enabled without the audit's
  explicit `ALLOW_LIVE_EMAIL_SENDS=1` acknowledgement.
- No branch was pushed, merged, or deployed and no production setting changed.

Gate:

- JewelHire build and release audits pass from committed files.
- Migration order `0012`–`0018` is fixed and documented.
- The release branch has no unrelated or generated changes.

## Phase 2 — Make the cross-product contract reproducible

Status: runner implemented and source/safe-endpoint baseline passed locally on
2026-07-12. An authenticated stateful replay remains required against an
isolated, fully migrated two-service database after the incoming JewelLink
merge is fixed to a commit.

Evidence:

- One command: `npm run qa:cross-product`
- Runner: `scripts/cross-product-acceptance.mjs`
- Operator guide: `docs/cross-product-acceptance.md`
- Source run passed 8 product suites and 11 shared-contract checks against
  JewelHire `ae50c9dbb107` and JewelLink `cbf4ce224e2b`.
- A local JewelLink process was started with `.env.local` names blanked,
  synthetic secrets, and an unreachable placeholder database. The SSO
  exchange, hire, and JewelCert result endpoints each rejected an unauthenticated
  request with HTTP 401 before database access.
- The runner emits machine-readable reports, a synthetic fixture inventory,
  and a placeholder-only environment contract beneath ignored `docs/qa-runs/`.
- No production mutation, database write, shared secret, or live email was used.

Build one local acceptance runner that starts or targets both local services
and proves:

- JewelLink Director → JewelHire store owner.
- JewelLink Manager → location-scoped JewelHire manager.
- JewelLink Student/Consultant → applicant portal.
- No JewelLink role automatically grants JewelHire platform admin.
- SSO code expiry, single use, replay rejection, and wrong-secret rejection.
- Company/location/user provisioning is idempotent.
- Hire handoff creates or reactivates the correct JewelLink user once.
- JewelCert invite and result handoffs are idempotent and retryable.
- Cancellation revokes included access while preserving data and permitting a
  later claim link.
- Public application, legal consent, résumé privacy, analytics, and throttling
  continue to pass with the integration enabled.

Artifacts:

- Machine-readable pass/fail report.
- Synthetic role/tenant fixture inventory.
- Expected environment-variable contract with placeholders only.
- No live email or production mutation in the runner.

Gate:

- A single documented command reproduces the cross-product result.
- Failures identify the product, endpoint, role, and expected/actual status.

## Phase 3 — Prepare the merge dossier

Status: completed locally on 2026-07-12.

Evidence:

- `docs/jewellink-post-merge-dossier.md` records the preserved commit, exact
  API/secret contracts, role/location behavior, file-by-file treatment, UI
  placement, migration order, verification steps, and stop conditions.
- The review identified two non-integration migrations in the preservation
  commit as byte-identical to fetched `origin/main`; they are explicitly marked
  “omit” so they cannot be replayed during reintegration.
- The unrelated sidebar class-name refactor is also marked “omit”; the desired
  result is validated behavior (no JewelHire left-nav item), not that diff.

Create a file-by-file dossier for the post-merge integrator:

- Purpose of each JewelLink change.
- API request/response and secret used.
- Required database migration.
- Expected role/location behavior.
- UI placement and screenshots for header/profile-menu entry points.
- Whether the file should be cherry-picked, manually reapplied, or reviewed
  from scratch after the incoming merge.

Recommended treatment:

| Surface | Post-merge treatment |
| --- | --- |
| Integration API routes and integration page | Reapply/cherry-pick, then contract-test |
| Three JewelHire integration migrations | Preserve names/order; compare schema before applying |
| Header, sidebar, user management | Manually reapply to the new UI |
| `package.json` | Reconcile against the new dependency tree |
| Dockerfile and `deploy.sh` | Re-review from scratch against the new production pipeline |
| `.env.example` | Reapply only the integration variables |

Gate:

- Another developer can reapply the integration without relying on this task's
  conversation history.

## Phase 4 — Production preparation without production mutation

Status: non-mutating preparation completed locally on 2026-07-12; provisioning,
backup creation, controlled external sends, dependency disposition, and all
production mutations remain approval-gated.

Evidence:

- `docs/premerge-production-baseline.md` records current revisions, traffic,
  public routes, presence-only secret/IAM checks, dependency findings, and
  outstanding decision owners without exposing values.
- `docs/production-backup-and-rollback.md` provides a two-database evidence
  template, secure logical-backup fallback, additive-migration policy, exact
  Cloud Run traffic rollback commands, and restore-to-new procedure.
- The current JewelHire workflow YAML parses and the preserved JewelLink deploy
  script passes `bash -n`; both must be revalidated after the incoming merge.
- Missing integration secrets, migration identity/credential, legal-route
  deployment, email posture approval, Stripe smoke, final dependency
  disposition, named operator, and maintenance window are explicit blockers.

Actions:

1. Finalize the two-database backup checklist and rollback commands.
2. Finalize Secret Manager names and least-privilege IAM bindings.
3. Obtain the process/owner for the privileged JewelLink
   `MIGRATION_DATABASE_URL`; do not store the credential yet without approval.
4. Record current production revisions and public-route baselines read-only.
5. Decide the launch Postmark posture: explicit dry-run or approved live send.
6. Prepare the controlled internal email and Stripe test-mode smoke cases.
7. Confirm the no-traffic candidate/migration/traffic/rollback workflows remain
   syntactically valid.

Gate:

- The production checklist has an owner and evidence field for every item.
- Missing credentials/approvals are explicit rather than inferred.
- No production state has changed.

## Phase 5 — Hold point while the large JewelLink merge completes

Status: release-on-`main` and CI exit criteria met; production-baseline
confirmation remains outstanding.

While waiting:

- Continue JewelHire-only defect fixes and repeatable QA.
- Accept only contract-preserving changes in the JewelLink holding branch.
- Do not rebase the holding branch repeatedly onto moving JewelLink branches.
- Use `npm run qa:jewellink-merge-delta -- --target=<candidate-ref>` for
  read-only conflict forecasting; rerun it against the exact final merge SHA.
- Track the final merge PR/commit, dependency changes, schema migrations,
  deployment changes, and its production verification result.

The release train reached `main` at
`83de30f51276f5c0c8abfa61d7157d1fe0e847bf` through PR #152. GitHub Actions CI
completed successfully for that exact commit. The prior PR #133 dependency
findings are superseded by the current lockfiles: the local high-severity gates
now pass with three moderate root findings and 19 moderate mobile findings.

The exact rebaseline and validation evidence is recorded in
`docs/jewellink-main-rebaseline-2026-07-13.md`. Production revision/baseline
confirmation remains a separate read-only gate before cutover.

The staged publication, dark-launch, pilot, and rollback sequence is recorded
in `docs/jewelhire-integration-safe-promotion-plan.md`.

Exit criteria:

- The large JewelLink merge is on `main`.
- Its exact commit SHA is known.
- Its CI is green.
- If it is deployed before the integration, its production baseline is stable.

## Phase 6 — Post-merge discovery and reintegration

Status: local discovery, merge, and validation completed on 2026-07-13;
publication, review, authenticated stateful replay, and production changes
remain gated.

1. Fetch the new JewelLink `main` and create a fresh integration branch from
   that exact SHA.
2. Compare incoming migrations, Prisma schema, authentication, navigation,
   user management, Dockerfile, deployment scripts, and dependency files.
3. Reapply additive integration routes/migrations first.
4. Manually reapply header/sidebar/user-management UI against the new design.
5. Reconcile deployment hardening and the migration-job image contract.
6. Run `npm ci`, build/type checks, dependency audit, Prisma validation, local
   Docker build, container `/login` smoke, and the cross-product runner.
7. Open a focused integration PR with the merge dossier and QA evidence.

Local result:

- Current `main` was merged into
  `codex/jewellink-integration-preview-next15` at `5577fe110ab0`.
- The two manual conflicts preserved guarded deployment and both products'
  current test contracts.
- TypeScript, 307 web tests, five PostgreSQL lifecycle integration tests,
  scoped lint, mobile iOS validation, production build, Docker build/runtime,
  and the full cross-product suite pass.
- The branch is clean, four commits ahead of `origin/main`, zero behind, and
  preserved in a verified complete-history bundle.
- Nothing was pushed or deployed.

Gate:

- No unresolved migration drift or merge markers.
- The new JewelLink dependency audit is resolved or explicitly risk-accepted.
- The full local cross-product suite is green.
- The PR is reviewed before production changes.

## Phase 7 — Controlled production cutover

Status: deferred and approval-gated.

1. Confirm current backups and record both live revisions.
2. Provision matching shared secrets and the dedicated migration identity.
3. Deploy JewelLink as a no-traffic candidate, run its migrations from the
   immutable candidate artifact, smoke it, and move traffic only on success.
4. Run a JewelLink production baseline smoke.
5. Deploy JewelHire through its guarded manual workflow and apply migrations
   `0012`–`0018` from the candidate image.
6. Run Director, Manager, Student, admin-isolation, hire, JewelCert, public
   application, résumé, analytics, email, and cancellation-recovery smokes.
7. Roll back traffic immediately on authorization, isolation, migration,
   résumé privacy, duplicate-application, or unintended-email failures.

## Immediate work queue

After the JewelLink `main` rebaseline, continue in this order:

1. Phase 0: preserve both worktrees safely. **Complete.**
2. Phase 1: curate and validate the JewelHire release branch. **Complete.**
3. Phase 2: create the one-command cross-product acceptance runner. **Runner
   complete; authenticated stateful replay remains a post-merge gate.**
4. Phase 3: finish the JewelLink merge dossier. **Complete.**
5. Phase 4: close every non-mutating production-readiness item. **Complete;
   external approvals and production mutations remain gated.**
6. Phase 5: record the exact final JewelLink `main` and green CI. **Complete;
   production baseline confirmation remains.**
7. Phase 6: merge and validate the integration locally. **Complete through
   local QA at `5577fe110ab0`; PR publication and review remain gated.**

## Responsibility split

| Owner | Responsibilities before merge |
| --- | --- |
| JewelHire implementation | Branch/commit curation, builds, audits, contract runner, runbooks |
| JewelLink merge team | Complete and validate the large iOS/production merge; publish final SHA |
| Production/database owner | Backup confirmation process and privileged migration credential |
| Product owner | Postmark posture, dependency-risk decisions, and production cutover approval |
