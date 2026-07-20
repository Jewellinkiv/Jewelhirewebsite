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
| JewelHire | `Jewellinkiv/Jewelhire` | `b39dd3c6b9de5b689a27ec0a302ade63365d6d3e` | GitHub workflow `29776736801` passed on 2026-07-20; deploy job skipped by workflow conditions |
| JewelLink | `Jewellinkiv/jewellink-app` | `bd1f344699e97ed968a6c272277dffeaf0975479` | `cloudrun-jewellink-dev-main-safe` passed on 2026-07-20 |
| JewelLink local no-push patch | research checkout only | `da53e2ab7eac45c93285c91492903aeb7c1ed52d` | Local branch `codex/jewellink-cloudbuild-candidate-gate-20260720`; not pushed |

The latest JewelLink move from `ed225ce6` to `bd1f3446` changed only UP System
paths. It did not touch JewelHire integration, auth, deployment, Docker,
package, or Prisma migration paths.

The JewelLink Cloud Build release-path mismatch now has a prepared local patch
in the research checkout. It changes `cloudbuild.jewellink.yaml` to validate the
repo, build/push an immutable image, deploy a tagged `candidate-<12-sha>`
revision with `--no-traffic`, and smoke `/login`. This patch still requires
explicit approval before it can be pushed to `Jewellinkiv/jewellink-app`.

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
| JewelLink no-push release-path patch | Pass | Local commit `da53e2ab`; `node --test tests/deploy-release-safety.test.ts` passed 8/8; secret scan passed 2,505 files; Cloud Build embedded bash syntax checked |
| JewelLink durable approval packet | Pass | Patch artifact applies cleanly to JewelLink base `bd1f3446`; packet audit preserves no-push boundary and candidate-only controls |
| Production pilot readiness audit tooling | Pass | `scripts/production-pilot-readiness-audit.mjs` added with fixture coverage for matching and mismatched shared secrets without value leakage |
| Production cloud access | Pass | `gcloud` authenticated as `william@jewelrysalesacademy.com`; JewelHire and JewelLink Cloud Run service configs are readable |
| Production pilot readiness audit | Pass | `docs/qa-runs/production-pilot-readiness-2026-07-20T21-53-00-059Z/` reports `valuesPrinted: false`; both Cloud Run configs are readable; SSO and integration handoff secret pairs are secret-backed, matching, and high entropy |
| JewelHire production config | Pass | `docs/qa-runs/config-exposure-2026-07-20T21-53-00-066Z/` passed after explicit live-email acknowledgement |
| JewelHire Postmark safety | Pass | `docs/qa-runs/postmark-safety-2026-07-20T21-53-00-057Z/` passed after explicit live-email acknowledgement; no email was sent by the audit |
| JewelLink pilot rollout flags | Pass | Approved config-only Cloud Run update deployed `jewellink-dev-01153-dqz` at 100% traffic with `JEWELHIRE_INTEGRATION_ENABLED=true`, `JEWELHIRE_ROLLOUT_MODE=pilot`, and `JEWELHIRE_PILOT_COMPANY_IDS=comp_1` |
| JewelHire auth and role readiness | Pass | `docs/qa-runs/auth-readiness-2026-07-20T21-41-42-178Z/` and `docs/qa-runs/role-readiness-2026-07-20T21-42-09-766Z/` passed without printing credentials or database URLs |
| Go/no-go dossier | No-go recorded | `docs/production-pilot-go-no-go-dossier-2026-07-20.md` captures required evidence rows, pilot smoke matrix, rollback evidence, and stop conditions |

Full safe cross-product command used for this snapshot:

```bash
node scripts/cross-product-acceptance.mjs \
  --jewellink-repo=/Users/sterling/.codex/tmp/jewellink-app-research-20260720 \
  --jewellink-base=https://ai.jewellink.com \
  --require-endpoint-probes \
  --include-server-audits \
  --jewelhire-base=http://127.0.0.1:3004
```

## Readiness Gate Status

| Gate | Status | Needed before live pilot |
| --- | --- | --- |
| Production integration secrets | Closed | `qa:pilot-readiness` passed; shared SSO and integration handoff secrets match and are high entropy |
| JewelHire integration env | Closed | `qa:config` passed after explicit live-email acknowledgement |
| JewelLink integration env | Closed | `qa:pilot-readiness` passed after approved pilot rollout config update for Diamond Exchange `comp_1` |
| Migration ledger state | Unknown | Confirm JewelHire and JewelLink production ledgers match reviewed pending migration lists; stop on drift |
| Authenticated pilot roster | Not selected | Record Diamond Exchange company/location IDs and role test aliases |
| End-to-end SSO smoke | Not run | Director, Manager, Student, Consultant denial, platform-admin allowlist, allowlisted non-admin denial |
| End-to-end hire smoke | Not run | Hire in JewelHire provisions/reactivates the correct JewelLink user and stays idempotent |
| End-to-end JewelCert smoke | Not run | JewelLink sends invite, JewelHire records result, JewelLink receives scoped aggregation |
| JewelLink release-path patch approval | Open for future code/image deploys | Config-only pilot flag update was approved and completed; the Cloud Build candidate-release patch remains local and unpushed |
| Rollback and monitoring evidence | Not recorded | Record prior revisions, rollback command, health scheduler/alert status, and handoff retry procedure |

## JewelLink approval boundary

JewelLink may be inspected and locally tested, but changes must not be pushed
without explicit approval.

The main JewelLink release-process concern is prepared but not published.
`docs/JEWELHIRE_INTEGRATION_OPERATIONS_RUNBOOK.md` describes a non-traffic
candidate build, while current JewelLink `main` still updates the Cloud Run
service image directly. A local patch now makes Cloud Build match the gated
candidate/promotion contract. The patch must not be pushed or opened as a PR
without explicit approval.

## Next work order

1. Run the production pilot readiness audit from a machine with `gcloud`
   access; it checks both Cloud Run services, confirms integration secrets
   match without printing values, and records traffic/revision posture.
2. Review and approve the local no-push JewelLink Cloud Build candidate patch,
   then push/open a PR only after explicit approval.
3. Fill the pilot roster and run the authenticated end-to-end smoke matrix in
   `docs/production-pilot-go-no-go-dossier-2026-07-20.md`.
4. Move the go/no-go record to GO only after exact commits, build IDs,
   migration ledger evidence, config evidence, smoke results, and rollback
   owners are recorded.
