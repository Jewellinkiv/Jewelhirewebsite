# Production Operations Evidence Request

Created: 2026-07-21T08:11:40.984Z
Values printed: false

This packet is an approval aid only. It does not deploy, migrate, move traffic, create backups, restore data, create scheduler jobs, create alert policies, or write to either production database.

Status: needed

## Observed Runtime Targets

| Product | Project/service | Latest ready revision | Live traffic | Database host | Provider hint |
| --- | --- | --- | --- | --- | --- |
| JewelHire | `jewelhire-prod-20260626/jewelhire` | `jewelhire-00111-dup` | jewelhire-00111-dup 100% | `us-east-1.pg.psdb.cloud` | external Postgres on pg.psdb.cloud |
| JewelLink | `academy-460316/jewellink-dev` | `jewellink-dev-01154-xpx` | jewellink-dev-01154-xpx 100% | `us-east-4.pg.psdb.cloud` | external Postgres on pg.psdb.cloud |

## Missing Evidence Fields

| Field | Evidence needed |
| --- | --- |
| `rollback.jewelhireOwner` | Named owner and contact or approval channel |
| `rollback.jewellinkOwner` | Named owner and contact or approval channel |
| `rollback.jewellinkIamOwner` | Named owner and contact or approval channel |
| `rollback.databaseRecoveryOwner` | Named owner and contact or approval channel |
| `rollback.observationWindow` | Approved UTC start/end window |
| `rollback.rollbackThresholds` | Approved stop/rollback threshold summary |

## Blocking Checks

- JewelHire rollback owner is recorded
- JewelLink rollback owner is recorded
- JewelLink IAM rollback owner is recorded
- Database recovery owner is recorded
- Observation window is recorded
- Immediate rollback thresholds are recorded

## Verification

Run `npm run qa:operations-readiness -- --operations-evidence-file=<path>` and require the operations-readiness report to pass before treating backup/rollback/monitoring as GO-ready.

Do not place database URLs, bearer tokens, passwords, cookies, customer data, secret values, or full production data extracts in the evidence file.
