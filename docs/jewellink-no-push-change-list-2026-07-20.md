# JewelLink No-Push Change List — 2026-07-20

Status: superseded by JewelLink PR `#246`.

User instruction at the time of this record: inspect and prepare JewelLink
work, but do not push anything to `Jewellinkiv/jewellink-app` without explicit
approval. The user later approved JewelLink repo movement for this pilot patch,
and PR `#246` is now open for Jackson to review and merge:
`https://github.com/Jewellinkiv/jewellink-app/pull/246`. Production deployment,
migration execution, traffic promotion, and live rollout remain separate
release-controlled actions.

## Current JewelLink baseline

- Current `main`: `55032dbbebc519d1718aa14871da2048f60d9487`
- Prepared local no-push patch:
  `f12e67d7202a6a567007605f7164d141638b5dbc` on branch
  `codex/jewellink-profile-mfa-audit-refresh-20260720`
- Durable review artifact:
  `docs/jewellink-combined-pilot-readiness-approval-packet-2026-07-20.md`
- Latest no-push validation:
  `docs/qa-runs/jewellink-no-push-validation-2026-07-21T05-21-10-000Z/jewellink-no-push-validation-report.md`
- Latest Cloud Build: regional build `ae63d668-2ad0-435d-805f-0290460ebdb6`
  completed successfully on 2026-07-20 for branch `main`, commit
  `55032dbbebc519d1718aa14871da2048f60d9487`, and produced live revision
  `jewellink-dev-01154-xpx`.
- The `bd1f3446..55032dbb` delta includes auth, layout, i18n, UP System, and
  translation-related paths; it does not change Prisma migrations, Docker,
  package manifests, or the JewelHire integration API route paths.
- Current JewelHire integration source audit against this head is partial:
  `scripts/audit-jewelhire-sso.mjs` has one failing control for the translated
  profile 2FA-phone label/read-only guard, and
  `tests/profile-mfa-factor-protection.test.ts` fails the same literal-label
  check. The page and route still show a read-only phone input and omit phone
  from the self-profile save payload, so this needs JewelLink review rather
  than being treated as closed. The local no-push patch refreshes this guard
  and makes both checks pass.
- Approved config-only production update: Cloud Run service `jewellink-dev`
  served `jewellink-dev-01153-dqz` at 100% traffic, using the existing image
  `1c313cc00fd172ffa4a9903578afacf66dcfc67f`, with
  `JEWELHIRE_INTEGRATION_ENABLED=true`, `JEWELHIRE_ROLLOUT_MODE=pilot`, and
  `JEWELHIRE_PILOT_COMPANY_IDS=comp_1`. Current production traffic later moved
  to `jewellink-dev-01154-xpx` from commit `55032dbb`.
- Local patch verification refreshed on 2026-07-21: release/profile tests pass
  11/11, committed-secret scan passes 2,515 files, JewelHire SSO source audit
  passes 90/90 controls, saved patch artifact applies cleanly to a temporary clean worktree at
  `origin/main`, and `git diff --check` passes. Against current unpatched
  `origin/main`, `tests/deploy-release-safety.test.ts` still fails 1/8 because
  `cloudbuild.jewellink.yaml` updates the live service directly.

## Recommended JewelLink actions before pilot

| Item | Recommendation | Reason |
| --- | --- | --- |
| Cloud Build release path and profile MFA audit | Review the prepared combined local patch and push/open a PR only after explicit approval | The runbook says Cloud Build should not move production traffic, current JewelLink `main` still runs `gcloud run services update`, and the profile MFA audit needs to understand translation-backed labels |
| Open PR `#182` | Do not merge as-is; close as superseded or rebase into a fresh reviewed PR only if its remaining changes are still needed | It targets another integration branch, has no checks, and includes a workflow-deletion commit |
| Integration rollout env | Done for the approved pilot flag set; keep verifying without printing values before GO | `qa:pilot-readiness` passes after setting the pilot rollout to Diamond Exchange `comp_1` |
| Migration operator path | Verify the dedicated migration identity and `MIGRATION_DATABASE_URL` before any production migration run | The normal web runtime must not receive privileged migration credentials |
| Authenticated smoke hooks | Preserve or add operator-visible evidence for Director, Manager, Student, Consultant denial, admin allowlist, hire provisioning, JewelCert result sync, and health/retry checks | The current safe probes prove fail-closed unauthenticated behavior, not end-to-end business flow |

## Prepared local patch

The local JewelLink patch changes three files:
`cloudbuild.jewellink.yaml`, `scripts/audit-jewelhire-sso.mjs`, and
`tests/profile-mfa-factor-protection.test.ts`.

- Adds source validation before image build: deterministic install, Prisma
  client generation, committed-secret scan, JewelHire integration lint,
  JewelHire SSO audit, repo tests, and type-check.
- Replaces direct `gcloud run services update` with `gcloud run deploy`
  using `--no-traffic` and a `candidate-<12-character-sha>` tag.
- Adds a candidate `/login` smoke check by reading the tagged Cloud Run URL
  from service status.
- Keeps migration execution and traffic promotion outside Cloud Build, matching
  `docs/JEWELHIRE_INTEGRATION_OPERATIONS_RUNBOOK.md`.

This patch is intentionally local-only until explicit JewelLink repository
approval is given.

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
