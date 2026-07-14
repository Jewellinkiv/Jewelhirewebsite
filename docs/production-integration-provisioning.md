# JewelHire/JewelLink production integration provisioning

Updated: 2026-07-13

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
only on the two JewelLink integration secrets in addition to its explicitly
approved existing per-secret grants.

## Remove broad JewelLink runtime secret access

The 2026-07-13 read-only snapshot found that the JewelLink web runtime still
has project-wide `roles/secretmanager.secretAccessor`. Do not create the
privileged migration credential while that binding exists; doing so would
expose it to the web service.

Use this ordered conversion before creating `MIGRATION_DATABASE_URL`:

1. Inventory every secret referenced by the current service and any required
   dynamic consumer. Record the nonsecret secret names and dependent workload.
2. Add per-secret accessor grants for the current runtime identity on every
   approved runtime secret, including the two JewelHire integration secrets.
3. Before touching the live identity, use IAM Policy Simulator or a temporary
   canary identity with the proposed per-secret grants to verify every required
   access and deny an unrelated/migration-only test secret. A live-service
   smoke while the broad binding remains cannot prove the narrow grants are
   complete.
4. Record the exact project-level member binding that will be removed and the
   approved command/operator for immediately restoring that same binding.
   Validate the currently serving revision and a no-traffic revision against
   core authentication, CRM, UP, POS, settings, provider, and public-form paths.
5. Remove the project-wide accessor binding from the web runtime identity,
   then immediately repeat the current/no-traffic smoke and effective-IAM
   checks. If any required access fails, re-add the recorded binding first,
   verify service recovery, and stop the cutover.
6. Only after the narrow policy passes, create `MIGRATION_DATABASE_URL` and
   grant access solely to the dedicated migration identity. Never mount it on
   the web service.

Record the before/after IAM policy evidence without secret payloads. Keep the
existing production revision available for application rollback, but note that
traffic rollback does not undo a project IAM change; the recorded IAM binding
restore is a separate required recovery action.

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
  --update-env-vars=JEWELLINK_URL=https://ai.jewellink.com,JEWELHIRE_JEWELLINK_DIRECTOR_ROLE=store_owner,JEWELHIRE_JEWELLINK_MANAGER_ALL_LOCATIONS=0,JEWELHIRE_TEAM_INVITES_ENABLED=0 \
  --update-secrets=JEWELLINK_SSO_SHARED_SECRET=jewelhire-jewellink-sso-shared-secret:latest,JEWELLINK_INTEGRATION_SHARED_SECRET=jewelhire-jewellink-integration-shared-secret:latest \
  --no-traffic
```

This creates a configuration revision without sending users to it. The manual
JewelHire workflow inherits the settings, builds the reviewed candidate, and
moves traffic only after migrations and public-route smoke checks pass.
The workflow refuses the Diamond Exchange pilot unless
`JEWELHIRE_TEAM_INVITES_ENABLED` is present as the literal value `0`.

JewelLink's reviewed `deploy.sh` mounts its matching secrets and sets
`JEWELHIRE_URL=https://app.jewelhire.com`. It refuses a dirty or out-of-date
`main`, a missing backup confirmation, either missing shared secret, a missing
migration credential, or a missing dedicated migration identity.

## Cutover

Keep JewelHire disabled while the compatible code and schema reach both
products. Enable only an approved pilot company after both live revisions pass
their non-integration smoke checks.

1. Record both live revision names, image digests, and traffic assignments.
   Confirm current backups of both production databases and record their backup
   identifiers and timestamps.
2. Merge the reviewed safety PR before the stacked integration PR. Require green
   CI in both repositories and deploy only a clean local `main` that exactly
   matches `origin/main`.
3. Verify the legacy JewelLink main-push Cloud Build trigger is still disabled.
   Provision the two shared-secret pairs, `MIGRATION_DATABASE_URL`, and the
   dedicated JewelLink migration identity described above.
4. Build JewelLink's integration-disabled candidate:

   ```bash
   DATABASE_BACKUP_CONFIRMED=1 \
   JEWELHIRE_INTEGRATION_ENABLED=false \
   JEWELHIRE_ROLLOUT_MODE=off \
   JEWELHIRE_HIRE_EMAIL_MODE=disabled \
   ./deploy.sh candidate
   ```

   Record the candidate revision, tag URL, image digest, and current live
   revision. Production traffic is unchanged.
5. Re-run the read-only `_prisma_migrations` ledger comparison against the exact
   candidate commit. Continue only when there are no failed rows, no
   applied-but-missing migrations, and the reviewed pending list contains only:

   - `20260712043000_add_jewelhire_sso_codes`
   - `20260712052000_add_jewelhire_hire_provisioning`
   - `20260712053000_add_jewelhire_jewelcert_results`
   - `20260713120000_add_email_verification`
   - `20260713130000_add_auth_session_policy`
   - `20260714100000_invalidate_company_auth_sessions`
   - `20260714110000_deactivate_email_integrations_on_company_change`

   The final migration forces old-company mailbox integrations into a
   fail-closed, inactive state when a user is reassigned to another tenant. A
   mailbox must be reconnected inside the user's current company before it can
   be used again.

6. Apply the seven migrations from the immutable candidate image, then promote
   the same disabled revision:

   ```bash
   DATABASE_BACKUP_CONFIRMED=1 \
   MIGRATION_LEDGER_AUDIT_CONFIRMED=1 \
   MIGRATION_CONFIRMED=1 \
   ./deploy.sh migrate <candidate-revision>

   PROMOTE_CONFIRMED=1 \
   MIGRATION_STATUS_CONFIRMED=1 \
   ./deploy.sh promote <candidate-revision>
   ```

7. Mount JewelHire's URL and Secret Manager references with `--no-traffic`,
   explicitly choose Postmark dry-run or acknowledge live delivery, and dispatch
   JewelHire's manual production workflow with backup confirmation. Its workflow
   creates a no-traffic candidate, applies migrations from that image, smokes the
   public routes, and restores the previous revision if the live smoke fails.
8. After both compatible revisions are live, build a second JewelLink candidate
   for one approved company ID:

   ```bash
   DATABASE_BACKUP_CONFIRMED=1 \
   JEWELHIRE_INTEGRATION_ENABLED=true \
   JEWELHIRE_ROLLOUT_MODE=pilot \
   JEWELHIRE_PILOT_COMPANY_IDS='<approved-company-id>' \
   JEWELHIRE_HIRE_EMAIL_MODE=disabled \
   ./deploy.sh candidate
   ```

   Run the complete candidate SSO/role/new-tab/cancellation smoke. Because the
   reviewed migrations are already applied, verify their status and promote the
   exact pilot revision only with the explicit promotion confirmations.
9. Complete every post-deploy check in `production-rollout-checklist.md`. Hold
   the pilot for an agreed observation window before considering `all` mode.

If a migration, candidate smoke, or SSO check fails, do not move traffic. If a
post-cutover isolation or authorization check fails, restore traffic to the
recorded previous revision immediately and preserve logs for diagnosis. Traffic
rollback does not reverse schema changes; use the reviewed forward-repair plan
for any migration issue.
