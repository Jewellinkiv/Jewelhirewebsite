# JewelLink No-Push Change List — 2026-07-20

User instruction: inspect and prepare JewelLink work, but do not push anything
to `Jewellinkiv/jewellink-app` without explicit approval.

## Current JewelLink baseline

- Current `main`: `bd1f344699e97ed968a6c272277dffeaf0975479`
- Prepared local no-push patch:
  `da53e2ab7eac45c93285c91492903aeb7c1ed52d` on branch
  `codex/jewellink-cloudbuild-candidate-gate-20260720`
- Latest check: `cloudrun-jewellink-dev-main-safe` completed successfully on
  2026-07-20.
- Latest `ed225ce6..bd1f3446` delta touched only UP System files and did not
  touch JewelHire integration, auth, deployment, package, Docker, or Prisma
  migration paths.
- Current JewelHire integration source audit passes against this head.
- Local patch verification: `node --test tests/deploy-release-safety.test.ts`
  passed 8/8, `scripts/check-committed-secrets.mjs` passed 2,505 files, and
  embedded Cloud Build bash blocks passed syntax checks after simulated
  substitutions.

## Recommended JewelLink actions before pilot

| Item | Recommendation | Reason |
| --- | --- | --- |
| Cloud Build release path | Review the prepared local patch and push/open a PR only after explicit approval | The runbook says Cloud Build should not move production traffic, and current JewelLink `main` still runs `gcloud run services update` |
| Open PR `#182` | Do not merge as-is; close as superseded or rebase into a fresh reviewed PR only if its remaining changes are still needed | It targets another integration branch, has no checks, and includes a workflow-deletion commit |
| Integration rollout env | Verify without printing values: `JEWELHIRE_URL`, `JEWELHIRE_SSO_SHARED_SECRET`, `JEWELHIRE_INTEGRATION_SHARED_SECRET`, `JEWELHIRE_INTEGRATION_ENABLED`, `JEWELHIRE_ROLLOUT_MODE`, `JEWELHIRE_PILOT_COMPANY_IDS`, and `JEWELHIRE_HIRE_EMAIL_MODE` | Source is green, but live pilot depends on production configuration |
| Migration operator path | Verify the dedicated migration identity and `MIGRATION_DATABASE_URL` before any production migration run | The normal web runtime must not receive privileged migration credentials |
| Authenticated smoke hooks | Preserve or add operator-visible evidence for Director, Manager, Student, Consultant denial, admin allowlist, hire provisioning, JewelCert result sync, and health/retry checks | The current safe probes prove fail-closed unauthenticated behavior, not end-to-end business flow |

## Prepared local patch

The local JewelLink patch changes `cloudbuild.jewellink.yaml` only.

- Adds source validation before image build: deterministic install, Prisma
  client generation, committed-secret scan, JewelHire integration lint,
  JewelHire SSO audit, repo tests, and type-check.
- Replaces direct `gcloud run services update` with `gcloud run deploy`
  using `--no-traffic` and a `candidate-<12-character-sha>` tag.
- Adds a candidate `/login` smoke check by reading the tagged Cloud Run URL
  from service status.
- Keeps migration execution and traffic promotion outside Cloud Build, matching
  `docs/JEWELHIRE_INTEGRATION_OPERATIONS_RUNBOOK.md`.

This patch is intentionally local-only until explicit JewelLink approval is
given.

## PR `#182` notes

PR: `https://github.com/Jewellinkiv/jewellink-app/pull/182`

- Base: `codex/jewellink-sso-canonical-redirect-hotfix-20260714`
- Head: `codex/jewellink-sso-only-production-20260715`
- State: open, clean against its non-main base, no reported checks
- Commits:
  - `639ec357` — `Harden JewelHire pilot access and branding`
  - `2824b5b7` — `Delete .github/workflows directory`
- Both commits are not ancestors of current `origin/main`.

Treat this PR as stale release-train debris unless a human explicitly asks to
rebase its surviving changes onto current `main`.
