# Production Operations Readiness Audit

Created: 2026-07-21T16:25:03.059Z
Result: PASS
Values printed: false

## Runtime Rollback Targets

### JewelHire

- Project/service: jewelhire-prod-20260626/jewelhire
- Latest ready revision: jewelhire-00111-dup
- Live traffic: jewelhire-00111-dup 100%
- Database host: us-east-1.pg.psdb.cloud
- Database provider hint: external Postgres on pg.psdb.cloud
- Backup method: encrypted-logical
- Backup ID recorded: yes
- Backup completed at: 2026-07-21T02:04:43.051Z
- Backup verified at: 2026-07-21T02:04:43.174Z
- PITR/retention evidence recorded: yes
- Restore/list evidence recorded: yes
- Logical SHA-256 recorded: yes
- Alert policies: 1
- Enabled policies with notification channels: 1
- Notification channels readable: 1
- Attached enabled notification channels: 1
- Logging metrics: 1
- Scheduler jobs readable: no

### JewelLink

- Project/service: academy-460316/jewellink-dev
- Latest ready revision: jewellink-dev-01157-l7q
- Live traffic: jewellink-dev-01157-l7q 100%
- Database host: us-east-4.pg.psdb.cloud
- Database provider hint: external Postgres on pg.psdb.cloud
- Backup method: encrypted-logical
- Backup ID recorded: yes
- Backup completed at: 2026-07-21T02:19:00Z
- Backup verified at: 2026-07-21T02:20:06.050Z
- PITR/retention evidence recorded: yes
- Restore/list evidence recorded: yes
- Logical SHA-256 recorded: yes
- Alert policies: 1
- Enabled policies with notification channels: 1
- Notification channels readable: 1
- Attached enabled notification channels: 1
- Logging metrics: 1
- Scheduler jobs readable: yes

## JewelLink Integration Health Scheduler

- Expected job: jewellink-jewelhire-integration-health
- Found: yes
- State: ENABLED
- Target path: jewellink-dev-5wjpjpkoia-uc.a.run.app/api/cron/jewelhire-integration-health

## Declared Operations Evidence

- Monitoring channel recorded or attached: yes
- JewelHire rollback owner recorded: yes
- JewelLink rollback owner recorded: yes
- JewelLink IAM rollback owner recorded: yes
- Database recovery owner recorded: yes
- Observation window recorded: yes
- Rollback thresholds recorded: yes
- Evidence request artifact: not generated

## Checks

- PASS JewelHire Cloud Run service metadata is readable
- PASS JewelHire Cloud Run has a single 100% live revision
- PASS JewelHire production database credential is readable for host discovery
- PASS JewelHire production database target is identified without exposing credentials
- PASS JewelHire Cloud Scheduler metadata is readable or confirmed unavailable
- PASS JewelHire Cloud Monitoring alert policies are readable
- PASS JewelHire has at least one enabled monitoring alert policy
- PASS JewelHire enabled monitoring alert policy has notification channel
- PASS JewelHire Cloud Monitoring notification channels are readable
- PASS JewelHire attached notification channels are enabled
- PASS JewelHire Cloud Logging metric metadata is readable
- PASS JewelHire Cloud SQL metadata is readable or confirmed unavailable
- PASS JewelHire backup method is recorded
- PASS JewelHire backup identifier is recorded
- PASS JewelHire backup completion timestamp is recorded
- PASS JewelHire backup verification timestamp is recorded
- PASS JewelHire PITR or retention evidence is recorded
- PASS JewelHire restore/list verification evidence is recorded
- PASS JewelHire encrypted logical backup SHA-256 is recorded when required
- PASS JewelLink Cloud Run service metadata is readable
- PASS JewelLink Cloud Run has a single 100% live revision
- PASS JewelLink production database credential is readable for host discovery
- PASS JewelLink production database target is identified without exposing credentials
- PASS JewelLink Cloud Scheduler metadata is readable or confirmed unavailable
- PASS JewelLink Cloud Monitoring alert policies are readable
- PASS JewelLink has at least one enabled monitoring alert policy
- PASS JewelLink enabled monitoring alert policy has notification channel
- PASS JewelLink Cloud Monitoring notification channels are readable
- PASS JewelLink attached notification channels are enabled
- PASS JewelLink Cloud Logging metric metadata is readable
- PASS JewelLink Cloud SQL metadata is readable or confirmed unavailable
- PASS JewelLink backup method is recorded
- PASS JewelLink backup identifier is recorded
- PASS JewelLink backup completion timestamp is recorded
- PASS JewelLink backup verification timestamp is recorded
- PASS JewelLink PITR or retention evidence is recorded
- PASS JewelLink restore/list verification evidence is recorded
- PASS JewelLink encrypted logical backup SHA-256 is recorded when required
- PASS JewelLink JewelHire integration health scheduler job exists
- PASS JewelLink JewelHire integration health scheduler job is enabled
- PASS JewelLink JewelHire integration health scheduler targets the health endpoint
- PASS Monitoring channel is recorded or attached and enabled
- PASS JewelHire rollback owner is recorded
- PASS JewelLink rollback owner is recorded
- PASS JewelLink IAM rollback owner is recorded
- PASS Database recovery owner is recorded
- PASS Observation window is recorded
- PASS Immediate rollback thresholds are recorded

No database URLs, bearer tokens, passwords, cookies, customer data, or secret values are written to this report.
