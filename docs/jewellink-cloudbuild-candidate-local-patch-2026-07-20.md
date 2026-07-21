# JewelLink Cloud Build Candidate Patch - 2026-07-20

Status: superseded by live PR `#247`.

The historical local patch was rebuilt on current JewelLink main, updated to
the current release-safety test contract, and opened for Jackson as
`https://github.com/Jewellinkiv/jewellink-app/pull/247`.

User boundary: PR `#247` is approved for JewelLink repo movement. Do not merge,
deploy, migrate, promote traffic, or open additional JewelLink PRs without
explicit approval.

## Patch location

- Repository checkout:
  `/Users/sterling/.codex/tmp/jewellink-app-research-20260720`
- Branch: `codex/jewellink-cloudbuild-candidate-gate-refresh-20260721`
- Commit: `bb3e8585a5bd2312cfada77639e849e997d89ecc`
- File changed: `cloudbuild.jewellink.yaml`
- Durable patch artifact:
  `docs/jewellink-cloudbuild-candidate-no-push-2026-07-20.patch`
- Approval packet:
  `docs/jewellink-cloudbuild-candidate-approval-packet-2026-07-20.md`

## What it changes

The patch updates the JewelLink Cloud Build path so the main trigger can only
create a validated, no-traffic candidate revision.

- Runs source validation before building the image:
  - `npm ci --ignore-scripts`
  - `npx prisma generate`
  - `npm run security:secrets`
  - `npm run lint:jewelhire-integration`
  - `npm run audit:jewelhire-sso`
  - `npm test`
  - `npm run type-check`
- Builds and pushes the commit image.
- Deploys the image with `gcloud run deploy`, `--no-traffic`, and a
  `candidate-<12-character-sha>` tag.
- Reads the tagged candidate URL from Cloud Run service status.
- Smokes `candidate-url/login`.
- Leaves migrations and traffic promotion to the explicit runbook/deploy script
  path.

## Verification run locally

- `node --test tests/deploy-release-safety.test.ts` passed 8/8.
- `node scripts/check-committed-secrets.mjs` passed 2,505 repository files.
- Cloud Build embedded bash blocks passed syntax checks after simulated
  substitutions.
- `git diff --check` passed.
- The durable patch artifact passed `git apply --check` against JewelLink base
  `bd1f344699e97ed968a6c272277dffeaf0975479`.
- The same patch artifact passed `git apply --check` against refreshed
  JewelLink `origin/main` `55032dbbebc519d1718aa14871da2048f60d9487`.

## Approval gate

This historical patch should not be turned into a JewelLink PR. Use the
combined local patch in
`docs/jewellink-combined-pilot-readiness-approval-packet-2026-07-20.md`
instead after explicit JewelLink repository approval. Current JewelLink `main`
is `55032dbbebc519d1718aa14871da2048f60d9487`, and production currently serves
revision `jewellink-dev-01154-xpx` from that commit.
