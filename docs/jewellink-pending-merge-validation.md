# JewelLink pending-merge validation

Observed: 2026-07-12T17:10:20Z

This is read-only evidence for the moving JewelLink release train. It is not an
approval to merge either PR or deploy either product.

## PR #132 — sync production main into SmokeMain

- PR: `https://github.com/Jewellinkiv/jewellink-app/pull/132`
- Head: `codex/sync-smokemain-2026-07-12` at
  `9a163831113e88b24d22c8bdeecbf4c68412f138`
- Base observed before merge: `SmokeMain` at
  `b39c56335435eca05aaafc08b37eb5c781115510`
- State: open, mergeable/clean.
- External Cloud Build `a0483c30-a31d-4479-92f5-8c8f8b13c139` completed
  successfully at 2026-07-12T17:05:23Z.
- The build trigger created JewelLink revision `jewellink-dev-01039-8nh` and
  moved 100% production traffic to it even though the PR remained open. The
  build substitution identified source revision `9a163831`; `/login` returned
  200 after the traffic change.
- This task did not trigger the build, create the revision, merge the PR, or
  move traffic.

PR #132 only synchronizes current `main` into `SmokeMain`; it is not the final
`SmokeMain` to `main` release merge required for Phase 6.

## PR #133 — Next.js 15 and Node 22 release candidate

- PR: `https://github.com/Jewellinkiv/jewellink-app/pull/133`
- Commit: `1b3b4a976ad8122ed5a2dcd89c3170c971e30e7b`
- Base: `SmokeMain`
- State: open and mergeable/clean with no reported checks at observation time.
- Runtime changes include Node 22, Next.js 15.5.20, NextAuth 4.24.14, Prisma
  7.8.0, an updated lockfile, runtime dependency audit, committed-secret scan,
  web tests, and Expo iOS validation.

An isolated detached worktree at the exact commit produced:

| Check | Result |
| --- | --- |
| Root `npm ci --include=dev` | Pass |
| Committed-secret scan | Pass; 2,242 files checked |
| Runtime `npm audit --omit=dev --audit-level=high` | Pass; 3 moderate, 0 high/critical |
| Prisma client generation | Pass; Prisma 7.8.0 |
| TypeScript | Pass after the required Prisma generation |
| Web tests | Pass; 199/199 |
| Next.js production build | Pass; 182 static pages generated |
| Mobile TypeScript | Pass |
| Expo dependency alignment | Pass |
| Expo Doctor | Pass; 18/18 checks |
| Scoped web lint | Fail; 4 errors and 70 warnings |
| Mobile runtime dependency audit | Fail; 1 critical, 3 high, 20 moderate, 1 low |

The four lint errors are three unescaped apostrophes in the UP System page and
one `prefer-const` violation in the queue engine. The PR defines the scoped lint
command but its workflow does not invoke lint, so these errors currently escape
the proposed CI gate.

The mobile high/critical findings include direct `axios` advisories and
transitive `form-data`, `shell-quote`, and `ws` advisories. Fixes are reported
as available by npm, but dependency changes must be handled on PR #133 by the
JewelLink merge team rather than patched into the preserved JewelHire branch.

## JewelHire integration conflict forecast

Against PR #133's exact commit:

- 11 clean additions
- 2 clean modifications
- 2 already-present upstream migrations
- 5 overlapping changes
- 0 add collisions
- 0 delete overlaps

Overlaps are `Dockerfile`, `deploy.sh`, `package.json`, User Management, and the
sidebar. The first four require deliberate post-merge reconciliation. The
sidebar preservation diff remains intentionally omitted; only the requirement
that JewelHire not appear in the primary left navigation is carried forward.

## Local Next.js 15 integration preview

A local-only integration branch was created from PR #133's exact commit to
prove the dossier can be reapplied cleanly before the final release reaches
`main`:

- Branch: `codex/jewellink-integration-preview-next15`
- Base: `1b3b4a976ad8122ed5a2dcd89c3170c971e30e7b`
- Integration commits: `90023a1a6d50` and `c98458e23a4d`
- Status: clean, not pushed, not deployed, and not a substitute for Phase 6

The preview restores the additive JewelHire API routes, integration page,
three migrations, icon, environment contract, and audit script. The header and
profile-menu links open JewelHire in a new tab, the left navigation remains
clear of JewelHire, and the incoming User Management password/contact controls
were preserved while adding JewelCert actions. `Dockerfile`, `deploy.sh`, and
`package.json` were manually reconciled with the Node 22, Next.js 15, and
Prisma 7.8 release candidate.

| Preview check | Result |
| --- | --- |
| JewelHire/JewelLink source contract runner | Pass |
| Integration/deployment audit | Pass; 34/34 checks |
| `deploy.sh` syntax | Pass |
| Committed-secret scan | Pass; 2,253 files checked |
| Runtime dependency gate | Pass; 3 moderate, 0 high/critical |
| Prisma generation | Pass; Prisma 7.8.0 |
| TypeScript | Pass |
| Web tests | Pass; 199/199 |
| Targeted integration lint | Pass; 0 errors, 3 warnings |
| Next.js production build | Pass; 183 routes generated |
| Docker production image build | Pass; Node 22/Next.js 15 image |
| Runtime image migration/CLI check | Pass; all three migrations and Prisma 7.8.0 present |
| Runtime image `/login` smoke | Pass; HTTP 200 with forwarded HTTPS, 18,163-byte page |

The exact preview and PR #133 base are preserved in the complete-history bundle
`jewellink-next15-preview-c98458e2.bundle`, SHA-256
`05af30193fe9af46593525a9c765ea5cd7335f00d477d920c2fa1f8b9f7701b5`.
The temporary Docker image was deleted after verification.

## Gates before Phase 6

1. Merge PR #132 into `SmokeMain` only after its external deployment side
   effect and production baseline are acknowledged.
2. Add lint to PR #133 CI and resolve or explicitly waive its four errors.
3. Resolve or explicitly risk-accept the mobile critical/high dependency
   findings; add an enforced mobile runtime audit if that is the chosen gate.
4. Merge and validate PR #133 in the intended order.
5. Open/merge the final `SmokeMain` to `main` release PR, record its exact SHA,
   confirm green CI, and verify the production baseline.
6. Rerun `npm run qa:jewellink-merge-delta -- --target=<final-main-SHA>` before
   creating the JewelHire integration branch.
