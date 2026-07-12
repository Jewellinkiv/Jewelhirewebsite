# Two-database backup and rollback runbook

Updated: 2026-07-12

Use this runbook for the JewelLink/JewelHire cutover. It is an operator checklist,
not authorization to access credentials, create backups, restore data, deploy,
or move traffic.

## Required evidence before migration

Complete every field for both databases. A checkbox without a provider backup
ID or verified dump is not sufficient.

| Evidence | JewelHire | JewelLink |
| --- | --- | --- |
| Named operator |  |  |
| Provider and project/account |  |  |
| Database resource/cluster ID |  |  |
| Current database/schema name |  |  |
| Backup method (snapshot/PITR/logical) |  |  |
| Backup/snapshot ID |  |  |
| Backup completed UTC |  |  |
| Point-in-time recovery enabled and retention |  |  |
| Logical dump encrypted location, if used |  |  |
| SHA-256 of encrypted logical artifact |  |  |
| Restore/list verification completed UTC |  |  |
| Restore target/drill evidence |  |  |
| Approved retention/deletion date |  |  |

Also record immediately before deployment:

| Runtime | 100%-traffic revision before cutover |
| --- | --- |
| JewelHire `jewelhire-prod-20260626/jewelhire` |  |
| JewelLink `academy-460316/jewellink-dev` |  |

## Preferred backup sequence

1. Put normal administrative data imports and schema work on hold for the
   maintenance window.
2. Create a provider-native on-demand snapshot for each database and record its
   immutable ID and completion time.
3. Confirm the snapshot is in a completed/available state and that its retention
   covers the cutover and verification window.
4. When provider snapshots are unavailable or policy requires a second copy,
   create an encrypted logical dump from a secure operator environment.
5. Verify the logical archive can be listed and, preferably, restore it into an
   isolated non-production database before setting
   `DATABASE_BACKUP_CONFIRMED=1` or approving the JewelHire workflow input.

## Logical PostgreSQL backup fallback

Do not place a URL or password in shell history. Obtain a read-capable backup
credential through the approved secret channel and export it only in the
operator process. The following placeholders must be replaced locally without
committing or pasting values into task logs:

```bash
umask 077
export PGDATABASE_URL='<secret URL supplied out of band>'
export BACKUP_FILE='<approved encrypted path>/<product>-pre-jewelhire-UTC.dump'
pg_dump --dbname="$PGDATABASE_URL" --format=custom --compress=9 --no-owner --no-acl --file="$BACKUP_FILE"
pg_restore --list "$BACKUP_FILE" >/dev/null
shasum -a 256 "$BACKUP_FILE"
unset PGDATABASE_URL
```

If the approved storage location does not provide encryption at rest, encrypt
the dump before it leaves the secure host and securely remove the plaintext
copy. Never store database dumps in either Git repository or `docs/qa-runs`.

## Migration policy

- Apply JewelLink's three integration migrations from the exact no-traffic
  candidate image using only the dedicated migration identity.
- Apply JewelHire migrations `0012` through `0018` from its exact no-traffic
  candidate image.
- Capture migration status before and after each job.
- Stop before traffic movement on any failed, unexpected, missing, or modified
  migration.
- These migrations are additive. Do not improvise a destructive down migration
  during an incident. Roll traffic back first, preserve evidence, and decide
  whether a point-in-time/full restore is actually required.

## Traffic rollback

Replace the revision placeholders with the values recorded immediately before
cutover. These commands change production and require incident/cutover approval.

```bash
gcloud run services update-traffic jewelhire \
  --project=jewelhire-prod-20260626 \
  --region=us-central1 \
  --to-revisions='<JEWELHIRE_PREVIOUS_REVISION>=100'

gcloud run services update-traffic jewellink-dev \
  --project=academy-460316 \
  --region=us-central1 \
  --to-revisions='<JEWELLINK_PREVIOUS_REVISION>=100'
```

After rollback, verify `/login` for both products, JewelHire public routes,
authenticated role isolation, and error rates. Do not delete the failed
candidate or migration-job logs until the incident is reviewed.

## Database restore decision

Traffic rollback is the first response for application, authorization, or
integration failures. Restore a database only when the incident commander and
database owner confirm that the migration or application caused data/schema
damage that the prior revision cannot safely tolerate.

Preferred recovery is restore-to-new:

1. Freeze writes and record the incident time.
2. Restore the provider snapshot/PITR point or logical dump into a new isolated
   database resource.
3. Validate migration history, tenant counts, users, applications, résumés,
   JewelCert records, and representative read-only queries.
4. Repoint a no-traffic revision to the restored database and smoke it.
5. Move traffic only after approval; preserve the damaged database read-only for
   investigation.

For a logical archive, the operator-side restore pattern is:

```bash
export RESTORE_DATABASE_URL='<empty isolated restore target supplied out of band>'
pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-acl '<verified backup file>'
unset RESTORE_DATABASE_URL
```

Never run `--clean` against the live database. Never overwrite the only usable
backup or remove the pre-cutover database until retention and incident owners
approve it.
