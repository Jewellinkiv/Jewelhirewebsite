# JewelLink main rebaseline — 2026-07-13

Observed: 2026-07-13T11:24:40Z

This records the local-only merge of the preserved JewelHire integration into
the current JewelLink `main`. It is QA evidence, not approval to push, open a
PR, migrate production, or deploy either product.

## Current release baseline

- `origin/main`: `83de30f51276f5c0c8abfa61d7157d1fe0e847bf`
- Release PR: `https://github.com/Jewellinkiv/jewellink-app/pull/152`
- PR #152 merged `SmokeMain` into `main` at 2026-07-13T02:28:56Z.
- GitHub Actions CI run `29219603853` completed successfully for the exact
  `main` commit.
- The prior integration preview was 47 commits behind `main` and contained
  three local-only commits.
- The incoming `main` release changed 190 paths from the integration merge
  base and added eight Prisma migrations.

## Local merge

- Branch: `codex/jewellink-integration-preview-next15`
- Previous preview: `b6a748b8cdd7fb3abefe24487035e3a744b0f4a9`
- Merge base: `a5e3285ecd40143f616c0e9e9284a27b22c0040b`
- Merged `main`: `83de30f51276f5c0c8abfa61d7157d1fe0e847bf`
- Merge commit: `5577fe110ab0404e6c5c6a833bedfa6de8215905`
- Final divergence: four local commits ahead of `origin/main`, zero behind
- Status: clean, not pushed, and not deployed

The non-mutating merge forecast found only three overlapping paths:
`deploy.sh`, `package.json`, and `src/components/layout/header.tsx`. The header
merged automatically and retained both new-tab JewelHire launchers. Only
`deploy.sh` and `package.json` required manual conflict resolution.

Resolution decisions:

- Preserve the mandatory no-traffic candidate, dedicated migration job,
  candidate smoke, explicit traffic cutover, and previous-revision rollback.
- Preserve current `main` requirements for Twilio Verify,
  `TWO_FACTOR_SIGNING_KEY`, and the explicit UP lifecycle scheduler.
- Retain both `test:up-integration` and `audit:jewelhire-sso` package scripts.
- Update the integration audit from retired Redis/SMS OTP secret names to the
  current Twilio Verify two-factor contract.
- Update the upstream deployment assertion to require unconditional
  `--no-traffic` instead of the removed optional traffic switch.

## Validation

| Check | Result |
| --- | --- |
| Root clean install | Pass; 720 packages audited |
| Committed-secret scan | Pass; 2,329 repository files |
| Root runtime dependency gate | Pass; 3 moderate, 0 high/critical |
| Prisma generation | Pass; Prisma 7.8.0 |
| TypeScript | Pass |
| Scoped CI lint | Pass; 0 errors, 82 warnings |
| Web tests | Pass; 307/307 |
| UP lifecycle transaction integration | Pass; 5/5 against isolated PostgreSQL 16 |
| Mobile clean install and TypeScript | Pass |
| Expo dependency alignment | Pass |
| Expo Doctor | Pass; 18/18 checks |
| Mobile runtime dependency gate | Pass at high threshold; 19 moderate, 0 high/critical |
| Next.js production build | Pass; 183 static pages generated |
| JewelHire/JewelLink integration audit | Pass; 34/34 |
| Cross-product acceptance | Pass with local JewelHire server; 0 access-control issues |
| Docker production image | Pass; Node 22/Next.js 15, 323,030,649 bytes |
| Runtime migration/Prisma inspection | Pass; JewelHire and Twilio Verify migrations present |
| Runtime `/login` smoke | Pass; HTTP 200, 18,163-byte page |

The first cross-product attempt returned HTTP status `0` for all JewelHire
access-control probes because no local JewelHire server was running. The same
runner passed completely after starting the curated JewelHire build on port
3004 with local-only synthetic session overrides. This was an environment
failure, not an authorization regression.

## Recovery evidence

- Pre-merge bundle: `jewellink-preview-before-main-83de30f5.bundle`
  - SHA-256: `471d3bf7a12254eec5bbe784c2118dbac3f8284d7b864bdccb303d0f67c6c5e6`
- Validated merged bundle: `jewellink-integration-main-83de-5577fe11.bundle`
  - SHA-256: `1c3c388dc74504c63a776d12cc527ce70a42038521470ac3472c3b380fc9973b`

Both bundles record complete Git history under
`/Users/williamjonesiv/Desktop/jewelhire-premerge-backups/2026-07-13/`.
The temporary Docker image and test containers were deleted after validation.

## Remaining gates

1. Review the four-commit integration diff against current `main`.
2. Push the integration branch and open a focused PR only with explicit
   publishing approval.
3. Confirm the current JewelLink production revision/baseline separately;
   local validation and green GitHub CI do not prove production state.
4. Provision or confirm shared integration secrets, the dedicated migration
   identity, and current two-database backups before any cutover.
5. Run the authenticated, stateful two-service replay before production.
