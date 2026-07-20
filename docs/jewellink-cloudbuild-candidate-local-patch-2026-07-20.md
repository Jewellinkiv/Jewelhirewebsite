# JewelLink Cloud Build Candidate Patch - 2026-07-20

Status: prepared locally, not pushed.

User boundary: do not push or open a JewelLink PR without explicit approval.

## Patch location

- Repository checkout:
  `/Users/sterling/.codex/tmp/jewellink-app-research-20260720`
- Branch: `codex/jewellink-cloudbuild-candidate-gate-20260720`
- Commit: `da53e2ab7eac45c93285c91492903aeb7c1ed52d`
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

## Approval gate

This is ready to turn into a JewelLink PR after approval. Until then, JewelLink
production remains unchanged and current `main` remains
`bd1f344699e97ed968a6c272277dffeaf0975479`.
