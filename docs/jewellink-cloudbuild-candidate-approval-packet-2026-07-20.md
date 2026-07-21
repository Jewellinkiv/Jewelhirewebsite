# JewelLink Cloud Build Candidate Approval Packet - 2026-07-20

Status: superseded by the combined local patch
`docs/jewellink-combined-pilot-readiness-approval-packet-2026-07-20.md`.
This historical Cloud-Build-only approval packet remains unpushed and should
not be used as the current JewelLink PR plan.

User boundary: do not push, open a PR, merge, deploy, or promote JewelLink
without explicit approval.

## Patch

- Patch file:
  `docs/jewellink-cloudbuild-candidate-no-push-2026-07-20.patch`
- Local JewelLink branch:
  `codex/jewellink-cloudbuild-candidate-gate-20260720`
- Local JewelLink commit:
  `da53e2ab7eac45c93285c91492903aeb7c1ed52d`
- JewelLink base:
  `bd1f344699e97ed968a6c272277dffeaf0975479`
- Latest JewelLink main compatibility check:
  `55032dbbebc519d1718aa14871da2048f60d9487`; patch artifact still passes
  `git apply --check`
- File changed:
  `cloudbuild.jewellink.yaml`

## Purpose

Current JewelLink `main` still uses Cloud Build to update the Cloud Run service
image directly. The JewelLink runbook and release-safety test expect the main
trigger to validate source, build an immutable image, deploy a tagged
no-traffic candidate, and smoke `/login` without running migrations or moving
production traffic.

This patch makes `cloudbuild.jewellink.yaml` match that candidate-release
contract.

## PR title

Gate Cloud Build behind candidate release

## PR body

```markdown
## Summary

- add source validation to the JewelLink Cloud Build path before image build
- deploy the built image as a tagged Cloud Run candidate with `--no-traffic`
- smoke the candidate `/login` route after deploy
- keep migrations and traffic promotion outside Cloud Build

## Why

The operations runbook and release-safety tests require the main trigger to
create a validated no-traffic candidate only. Current `main` still updates the
Cloud Run service image directly, which is not the desired pilot release path.

## Validation

- `node --test tests/deploy-release-safety.test.ts`
- `node scripts/check-committed-secrets.mjs`
- `git diff --check`
- `git apply --check` against JewelLink base
  `bd1f344699e97ed968a6c272277dffeaf0975479`
- `git apply --check` against refreshed JewelLink `origin/main`
  `55032dbbebc519d1718aa14871da2048f60d9487`
- Cloud Build embedded bash blocks syntax-checked after simulated substitutions

## Approval

This PR should not be merged or deployed until the JewelHire/JewelLink pilot
approval record explicitly authorizes the JewelLink release-path change.
```

## Apply after approval

From a clean JewelLink checkout at current `origin/main`
`55032dbbebc519d1718aa14871da2048f60d9487`:

```bash
git switch -c codex/jewellink-cloudbuild-candidate-gate-20260720
git apply /Users/sterling/Desktop/jewelhire/docs/jewellink-cloudbuild-candidate-no-push-2026-07-20.patch
node --test tests/deploy-release-safety.test.ts
node scripts/check-committed-secrets.mjs
git diff --check
```

Do not use this historical packet to commit, push, or open a JewelLink PR. Use
the combined local patch packet instead after explicit JewelLink repository
approval.

## Expected controls

- Source validation includes secret scan, JewelHire integration lint, JewelHire
  SSO audit, tests, and type-check.
- Cloud Build deploys with `--no-traffic` and `candidate-<12-character-sha>`.
- Candidate `/login` smoke runs before the build is considered successful.
- Cloud Build does not run migrations.
- Cloud Build does not move production traffic.
- Traffic promotion remains a separate explicit action.
