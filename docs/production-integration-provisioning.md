# JewelHire/JewelLink production integration provisioning

Updated: 2026-07-12

This runbook provisions the missing production configuration without sharing
cookies, session keys, or database credentials between products. Do not run it
until current backups of both production databases have been confirmed.

## Fixed production values

| Setting | Value |
| --- | --- |
| JewelHire project/service | `jewelhire-prod-20260626` / `jewelhire` |
| JewelLink project/service | `academy-460316` / `jewellink-dev` |
| JewelHire URL | `https://app.jewelhire.com` |
| JewelLink URL | `https://ai.jewellink.com` |
| JewelHire runtime identity | `806390481450-compute@developer.gserviceaccount.com` |
| JewelLink runtime identity | `481532612530-compute@developer.gserviceaccount.com` |
| JewelLink migration identity | `jewellink-migrate@academy-460316.iam.gserviceaccount.com` |

## Secret contract

Generate two independent random values of at least 256 bits. Never print them,
place them on a command line, commit them, or reuse either one as a session key.

| Purpose | JewelHire Secret Manager name | JewelLink Secret Manager name |
| --- | --- | --- |
| SSO code exchange | `jewelhire-jewellink-sso-shared-secret` | `JEWELHIRE_SSO_SHARED_SECRET` |
| Hire/JewelCert API | `jewelhire-jewellink-integration-shared-secret` | `JEWELHIRE_INTEGRATION_SHARED_SECRET` |

Install each value as a new secret or secret version in both projects through
an approved secret-ingestion channel. The value for a row must match across the
two projects; the two rows must not match each other.

Grant the JewelHire runtime identity `roles/secretmanager.secretAccessor` only
on the two JewelHire secrets. Grant the JewelLink runtime identity that role
only on the two JewelLink secrets.

## JewelLink migration identity

The normal JewelLink database user is intentionally unable to run DDL. Create
the dedicated identity once:

```bash
gcloud iam service-accounts create jewellink-migrate \
  --project=academy-460316 \
  --display-name="JewelLink database migrations"
```

Create `MIGRATION_DATABASE_URL` in the JewelLink project using a database-owner
connection supplied through the approved secret-ingestion channel. Grant only
`jewellink-migrate@academy-460316.iam.gserviceaccount.com` Secret Manager
accessor on this secret. Do not grant the JewelLink runtime identity access and
do not mount this secret on the web service.

The deploy operator also needs permission to act as the migration identity and
to create/execute the `jewellink-migrate` Cloud Run Job.

## Service configuration

Before the JewelHire workflow can pass its fail-closed preflight, mount its
integration settings:

```bash
gcloud run services update jewelhire \
  --project=jewelhire-prod-20260626 \
  --region=us-central1 \
  --update-env-vars=JEWELLINK_URL=https://ai.jewellink.com,JEWELHIRE_JEWELLINK_DIRECTOR_ROLE=store_owner,JEWELHIRE_JEWELLINK_MANAGER_ALL_LOCATIONS=0 \
  --update-secrets=JEWELLINK_SSO_SHARED_SECRET=jewelhire-jewellink-sso-shared-secret:latest,JEWELLINK_INTEGRATION_SHARED_SECRET=jewelhire-jewellink-integration-shared-secret:latest \
  --no-traffic
```

This creates a configuration revision without sending users to it. The manual
JewelHire workflow inherits the settings, builds the reviewed candidate, and
moves traffic only after migrations and public-route smoke checks pass.

JewelLink's reviewed `deploy.sh` mounts its matching secrets and sets
`JEWELHIRE_URL=https://app.jewelhire.com`. It refuses a dirty or out-of-date
`main`, a missing backup confirmation, either missing shared secret, a missing
migration credential, or a missing dedicated migration identity.

## Cutover

1. Record both live revision names and confirm both database backups.
2. Merge and review both repositories; deploy only committed `origin/main`.
3. Run JewelLink with `DATABASE_BACKUP_CONFIRMED=1 ./deploy.sh`.
4. Confirm its three integration migrations are applied and `/login` is healthy.
5. Explicitly choose JewelHire Postmark dry-run or acknowledge live delivery.
6. Dispatch JewelHire's production workflow with the backup confirmation.
7. Complete every post-deploy check in `production-rollout-checklist.md`.

If a migration, candidate smoke, or SSO check fails, do not move traffic. If a
post-cutover isolation or authorization check fails, restore traffic to the
recorded previous revision immediately and preserve logs for diagnosis.
