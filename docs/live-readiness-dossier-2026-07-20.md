# Live Readiness Dossier — 2026-07-20

Status: **source-ready, production-pilot gated**.

This dossier is the current working record for getting JewelHire and the
JewelLink integration to a controlled live pilot. It does not authorize a
production cutover by itself.

## Validated heads

These are the heads used for the live-readiness evidence below. Later
documentation-only or audit-tooling JewelHire commits may supersede the
JewelHire SHA without changing runtime behavior.

| Product | Repository | Current head | Build/status |
| --- | --- | --- | --- |
| JewelHire | `Jewellinkiv/Jewelhire` | `c101c62c2925032467828609e0e2c86f90d08fd4` | GitHub workflow `29776216461` passed on 2026-07-20; deploy job skipped by workflow conditions |
| JewelLink | `Jewellinkiv/jewellink-app` | `bd1f344699e97ed968a6c272277dffeaf0975479` | `cloudrun-jewellink-dev-main-safe` passed on 2026-07-20 |

The latest JewelLink move from `ed225ce6` to `bd1f3446` changed only UP System
paths. It did not touch JewelHire integration, auth, deployment, Docker,
package, or Prisma migration paths.

## Green evidence

| Area | Result | Notes |
| --- | --- | --- |
| JewelHire SSO source audit | Pass | `scripts/jewellink-sso-audit.mjs` |
| JewelHire hire handoff source audit | Pass | `scripts/jewellink-hire-audit.mjs` |
| JewelHire JewelCert handoff source audit | Pass | `scripts/jewellink-jewelcert-audit.mjs` |
| JewelLink JewelHire integration source audit | Pass | `scripts/audit-jewelhire-sso.mjs`, 90 controls |
| Cross-product source acceptance | Pass | Current runner separates source audits from live-server audits |
| JewelHire local server access control | Pass | `scripts/access-control-audit.mjs --base=http://127.0.0.1:3004`; 0 issues and 0 known gaps |
| Cross-product acceptance with local JewelHire server | Pass | Included source audits, local tenant/location access-control, and live JewelLink fail-closed probes |
| Live public pages | Pass | `app.jewelhire.com/login`, `/privacy`, `/terms`, and `ai.jewellink.com/login` return `200` |
| Live unauthenticated endpoint posture | Pass | JewelLink SSO exchange/introspection, hire provisioning, JewelCert results, and JewelHire inbound JewelCert invite all reject without bearer auth |

Full safe cross-product command used for this snapshot:

```bash
node scripts/cross-product-acceptance.mjs \
  --jewellink-repo=/Users/sterling/.codex/tmp/jewellink-app-research-20260720 \
  --jewellink-base=https://ai.jewellink.com \
  --require-endpoint-probes \
  --include-server-audits \
  --jewelhire-base=http://127.0.0.1:3004
```

## Readiness gates still open

| Gate | Status | Needed before live pilot |
| --- | --- | --- |
| Production integration secrets | Unknown | Verify matching high-entropy SSO and integration secrets on both Cloud Run services without printing values |
| JewelHire integration env | Unknown | Run the strengthened `scripts/config-exposure-audit.mjs` from a machine with `gcloud`; verify `JEWELLINK_URL`, SSO/integration secrets, `JEWELHIRE_TEAM_INVITES_ENABLED=0`, trusted proxy hops, admin allowlist, email posture, Stripe env, and secret-backed mounts |
| JewelLink integration env | Unknown | Verify `JEWELHIRE_URL`, SSO/integration secrets, rollout mode, pilot company IDs, and hire email mode |
| Migration ledger state | Unknown | Confirm JewelHire and JewelLink production ledgers match reviewed pending migration lists; stop on drift |
| Authenticated pilot roster | Not selected | Record Diamond Exchange company/location IDs and role test aliases |
| End-to-end SSO smoke | Not run | Director, Manager, Student, Consultant denial, platform-admin allowlist, allowlisted non-admin denial |
| End-to-end hire smoke | Not run | Hire in JewelHire provisions/reactivates the correct JewelLink user and stays idempotent |
| End-to-end JewelCert smoke | Not run | JewelLink sends invite, JewelHire records result, JewelLink receives scoped aggregation |
| Rollback and monitoring evidence | Not recorded | Record prior revisions, rollback command, health scheduler/alert status, and handoff retry procedure |

## JewelLink approval boundary

JewelLink may be inspected and locally tested, but changes must not be pushed
without explicit approval.

The main JewelLink release-process concern remains the Cloud Build path:
`docs/JEWELHIRE_INTEGRATION_OPERATIONS_RUNBOOK.md` describes a non-traffic
candidate build, but the checked-in `cloudbuild.jewellink.yaml` still updates
the Cloud Run service image directly. Before a live pilot, decide whether to:

1. make the Cloud Build configuration match the gated candidate/promotion
   release contract, or
2. formally accept the current direct-update path for this pilot and document
   the rollback controls that compensate for it.

## Next work order

1. Run the strengthened JewelHire-side production configuration audit from a
   machine with `gcloud` access; it checks required environment names,
   expected fail-closed defaults, email/Stripe posture, integration settings,
   and admin allowlist mounts without reading secret values.
2. Prepare a no-push JewelLink release-process diff or written patch plan for
   the Cloud Build/candidate mismatch.
3. Fill the pilot roster and run the authenticated end-to-end smoke matrix.
4. Produce a final go/no-go record with exact commits, build IDs, migration
   ledger evidence, config evidence, smoke results, and rollback owner.
