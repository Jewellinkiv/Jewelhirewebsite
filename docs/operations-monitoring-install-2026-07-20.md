# Operations Monitoring Install - 2026-07-20

This records non-secret monitoring resources installed for the JewelHire and
JewelLink pilot readiness gate. It does not authorize production traffic
promotion.

## Installed Resources

| Product | Project | Resource | Evidence |
| --- | --- | --- | --- |
| JewelHire | `jewelhire-prod-20260626` | Alert policy `JewelHire pilot Cloud Run 5xx responses` | `projects/jewelhire-prod-20260626/alertPolicies/9567259419796776304` |
| JewelHire | `jewelhire-prod-20260626` | Email notification channel `JewelHire Pilot Operations Email` | `projects/jewelhire-prod-20260626/notificationChannels/10170517523806111204` |
| JewelHire | `jewelhire-prod-20260626` | Log-based metric `jewelhire_pilot_cloud_run_5xx` | Count of Cloud Run `5xx` log entries for service `jewelhire` |
| JewelLink | `academy-460316` | Alert policy `JewelLink pilot Cloud Run 5xx responses` | `projects/academy-460316/alertPolicies/9688291971768655601` |
| JewelLink | `academy-460316` | Email notification channel `JewelLink Pilot Operations Email` | `projects/academy-460316/notificationChannels/6069355864943001083` |
| JewelLink | `academy-460316` | Log-based metric `jewellink_pilot_cloud_run_5xx` | Count of Cloud Run `5xx` log entries for service `jewellink-dev` |
| JewelLink | `academy-460316` | Scheduler job `jewellink-jewelhire-integration-health` | Enabled every 5 minutes against `/api/cron/jewelhire-integration-health` |

## Verification

- `docs/qa-runs/operations-readiness-2026-07-20T23-05-00-020Z/operations-readiness-report.md`
  reports alert policies, attached notification channels, log metrics, and the
  JewelLink health scheduler as passing.
- The report writes no database URLs, bearer tokens, passwords, cookies,
  customer data, or secret values.

## Remaining Operations Gates

- Provider backup IDs and verification timestamps are still missing for both
  external Postgres databases.
- Rollback owners, database recovery owner, observation window, and immediate
  rollback thresholds are still missing.
- If Google requires email-channel recipient verification, verify both pilot
  operations channels before the observation window starts.
