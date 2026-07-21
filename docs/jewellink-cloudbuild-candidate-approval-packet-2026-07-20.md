# JewelLink Cloud Build Candidate Approval Packet - 2026-07-20

Status: superseded by live PR `#247`.

The historical Cloud-Build-only patch was rebuilt on current JewelLink main,
updated to the current release-safety test contract, and opened for Jackson as
`https://github.com/Jewellinkiv/jewellink-app/pull/247`.

User boundary: PR `#247` is approved for JewelLink repo movement. Do not merge,
deploy, migrate, promote traffic, or open additional JewelLink PRs without
explicit approval.

## Patch

- Patch file:
  `docs/jewellink-cloudbuild-candidate-no-push-2026-07-20.patch`
- Current JewelLink PR:
  `#247`
- Current PR branch:
  `codex/jewellink-cloudbuild-candidate-gate-refresh-20260721`
- Current PR head:
  `bb3e8585a5bd2312cfada77639e849e997d89ecc`
- Current JewelLink base:
  `550e5dcf6e537926424e9234412d32b8a9ef0a0a`
- File changed:
  `cloudbuild.jewellink.yaml`

## Purpose

Current JewelLink `main` still uses Cloud Build to update the Cloud Run service
image directly. The JewelLink runbook and release-safety test expect the main
trigger to validate source, build an immutable image, deploy a tagged
no-traffic candidate, and smoke `/login` without running migrations or moving
production traffic.

PR `#247` makes `cloudbuild.jewellink.yaml` match that candidate-release
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
