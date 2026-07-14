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

- Apply JewelLink's seven reviewed integration/auth migrations from the exact
  no-traffic candidate image using only the dedicated migration identity.
  `20260714110000_deactivate_email_integrations_on_company_change` forces
  old-company mailbox integrations into a fail-closed, inactive state on user
  tenant reassignment; do not reactivate one unless it has been reconnected
  inside the current company.
- Apply JewelHire migrations `0012` through `0023` from its exact no-traffic
  candidate image before promotion. Migration `0023` is an additive expand
  step that remains compatible with the recorded pre-v2 rollback revision.
- After the hardened revision owns traffic and its public production smoke
  passes, apply JewelHire migration `0024` from the same immutable candidate
  image and run full readiness. Migration `0024` is the contract fence; after
  it commits, never restore a pre-v2 revision.
- Every JewelHire migration transaction uses a 5-second lock wait and a
  2-minute statement limit. A timeout is a stop condition: do not move traffic
  or bypass the limit; investigate the blocker and rerun the guarded job only
  after the database owner approves.
- Capture migration status before and after each job.
- Stop before traffic movement on any failed, unexpected, missing, or modified
  migration.
- The schema changes are forward-compatible, but JewelHire migration `0019`
  intentionally disables native auth for linked identities, expires legacy
  company-unbound claims, and deduplicates outstanding action tokens. Do not
  improvise a destructive down migration during an incident. Roll traffic back
  first, preserve evidence, and decide whether a point-in-time/full restore is
  actually required.
- JewelHire migration `0020` is additive and stores only hashed, expiring
  applicant-setup state. Readiness must show both its table and exact migration
  ledger row before the candidate provider probe or any traffic movement.
- JewelHire migration `0021` additively initializes `users.native_auth_epoch` to
  zero. Hardened native cookies require this value, and password reset or a
  retained-account password claim advances it atomically. Once epoch-aware code
  has received traffic, **never roll application traffic back to a pre-0021
  revision**: that code ignores the durable epoch and can accept a cookie the
  hardened revision revoked. The recorded JewelHire rollback target must be an
  epoch-aware revision. If none exists, keep traffic stopped and forward-repair
  from the candidate; do not decrement epochs or bypass request-time checks.
- JewelHire migration `0022` supplies the delivery state and partial indexes
  required by after-response password reset. The candidate must show the
  migration ledger row and the detailed delivery-state readiness invariant
  before it receives any traffic.
- JewelHire migration `0023` is additive and may run while the recorded pre-v2
  revision remains the rollback target. Before promotion, every version-1
  JewelCert invite in `sent` or `started` state must still be exported for
  reconciliation and cancelled. After the hardened revision owns traffic and
  its public smoke passes, migration `0024` independently checks that no active
  version-1 row exists and installs the v2-only fence. Its deliberate
  precondition failure is a stop condition, not a reason to bypass or edit the
  migration; keep the hardened revision serving traffic, reconcile and cancel
  the legacy row, and rerun the guarded contract step.

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
4. Before any smoke that creates an authenticated cookie, create a new
   `AUTH_SECRET` version and mount it on the no-traffic revision. A restore can
   lower `native_auth_epoch` values and otherwise revive cookies signed before
   the restored point; the old signing secret must not return to service.
5. In one reviewed transaction on the restored target, mark every unused
   `password_reset` and `account_claim` action token used. A restore can also
   revive an emailed bearer that was consumed or superseded after the restored
   point. Record the affected row count and require users to request fresh
   links.
6. Repoint the no-traffic, new-secret revision to the restored database and
   smoke it, including direct login, JewelLink SSO, reset request, and claim
   reissue.
7. Move traffic only after approval; preserve the damaged database read-only for
   investigation.

The reviewed restored-target invalidation is:

```sql
begin;
update auth_action_tokens
set used_at = now()
where purpose in ('password_reset', 'account_claim')
  and used_at is null;
commit;
```

Rotating `AUTH_SECRET` intentionally signs every user out of JewelHire,
including SSO-derived sessions; JewelLink users re-enter through MFA-backed SSO.
Do not move traffic to a restored database with the pre-restore secret.

For a logical archive, the operator-side restore pattern is:

```bash
export RESTORE_DATABASE_URL='<empty isolated restore target supplied out of band>'
pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-acl '<verified backup file>'
unset RESTORE_DATABASE_URL
```

Never run `--clean` against the live database. Never overwrite the only usable
backup or remove the pre-cutover database until retention and incident owners
approve it.
