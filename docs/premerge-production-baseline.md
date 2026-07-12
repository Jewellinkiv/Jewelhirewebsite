# Pre-merge production baseline

Read-only snapshot: 2026-07-12T16:57:20Z

No service, secret, IAM principal, API, database, revision, job, or traffic
setting was created or changed while collecting this baseline.

## Subsequent externally observed change

At 2026-07-12T17:10:20Z, PR #132's external Cloud Build was observed to have
created `jewellink-dev-01039-8nh` and moved 100% JewelLink traffic to that
revision. The build source substitution was the existing `main` SHA
`9a163831113e88b24d22c8bdeecbf4c68412f138`, and `/login` returned 200 after
the change. This task did not trigger the build or change traffic. Recapture the
baseline again before any integration cutover; see
`jewellink-pending-merge-validation.md`.

## Source references

| Product | Local preservation/release HEAD | Fetched `origin/main` |
| --- | --- | --- |
| JewelHire | `51572f45cb2145c83fc9af718faa3f193e77422e` | `ec37568b726154eedb3df465e0502786daa9fe77` |
| JewelLink | `cbf4ce224e2bc20c68c0b4a2334327a136d01465` | `9a163831113e88b24d22c8bdeecbf4c68412f138` |

These are evidence references only. Neither local branch has been pushed,
merged, or approved for production.

## Cloud Run traffic

| Product | Project/service | Latest ready/created revision | Traffic |
| --- | --- | --- | --- |
| JewelHire | `jewelhire-prod-20260626` / `jewelhire` | `jewelhire-00082-q7t` | 100% to `jewelhire-00082-q7t` |
| JewelLink | `academy-460316` / `jewellink-dev` | `jewellink-dev-01038-kk7` | 100% to `jewellink-dev-01038-kk7`; tagged historical revision `jewellink-dev-00670-zev` remains at `native-ios-diamond` with no percentage |

Recapture both 100%-traffic revision names immediately before any cutover; do
not assume these values remain current.

## Public route baseline

| Route | Status | Observation |
| --- | --- | --- |
| `https://app.jewelhire.com/login` | 200 | Public |
| `https://app.jewelhire.com/signup` | 200 | Public |
| `https://app.jewelhire.com/signup/store` | 200 | Public |
| `https://app.jewelhire.com/privacy` | 307 | Redirects to `/login?next=%2Fprivacy`; release candidate fixes this |
| `https://app.jewelhire.com/terms` | 307 | Redirects to `/login?next=%2Fterms`; release candidate fixes this |
| `https://ai.jewellink.com/login` | 200 | Public |
| `https://ai.jewellink.com/integrations/jewelhire` | 307 | Redirects an unauthenticated request to JewelLink login, as expected |

## Integration configuration presence

Presence-only Secret Manager and Cloud Run checks found:

| Required item | Present? |
| --- | --- |
| JewelHire secret `jewelhire-jewellink-sso-shared-secret` | No |
| JewelHire secret `jewelhire-jewellink-integration-shared-secret` | No |
| JewelLink secret `JEWELHIRE_SSO_SHARED_SECRET` | No |
| JewelLink secret `JEWELHIRE_INTEGRATION_SHARED_SECRET` | No |
| JewelLink secret `MIGRATION_DATABASE_URL` | No |
| JewelLink service account `jewellink-migrate@academy-460316.iam.gserviceaccount.com` | No |
| JewelHire service env `JEWELLINK_URL`, `JEWELLINK_SSO_SHARED_SECRET`, `JEWELLINK_INTEGRATION_SHARED_SECRET` | No |
| JewelLink service env `JEWELHIRE_URL`, `JEWELHIRE_SSO_SHARED_SECRET`, `JEWELHIRE_INTEGRATION_SHARED_SECRET` | No |

No secret values were accessed or printed. The integration provisioning owner
must be an approved JewelLink/JewelHire production administrator. The named
human owner and maintenance window remain unassigned and must be recorded in
the rollout checklist before provisioning.

## Other launch gates

- JewelHire currently mounts `EMAIL_NOTIFICATIONS_ENABLED=true` and a
  secret-backed Postmark token. `POSTMARK_DRY_RUN` is absent. The release audit
  therefore requires explicit live-send acknowledgement or an approved dry-run
  configuration before deployment.
- JewelLink `npm audit --omit=dev` currently reports 13 high and 12 moderate
  findings, with 0 critical. Re-run and resolve or formally risk-accept against
  the final merged lockfile; do not remediate the obsolete pre-merge tree.
- JewelHire workflow YAML parses successfully. The preserved JewelLink
  `deploy.sh` passes `bash -n`. These checks establish syntax only, not runtime
  correctness of the final merged deployment pipeline.
- The database provider and provider-native backup identifiers are not exposed
  in Cloud Run metadata. The JewelLink project's Cloud SQL Admin API is disabled
  and was not enabled during this audit. The database owner must record the
  actual provider/resource and backup evidence using
  `production-backup-and-rollback.md`.

## Approval-gated decisions

1. Name the database/provisioning operator and maintenance window.
2. Choose Postmark dry-run or explicitly approve controlled live internal mail.
3. Resolve or risk-accept the final JewelLink dependency audit.
4. Approve production backup creation and later secret/IAM provisioning.
5. Approve one Stripe test-mode checkout/webhook and the controlled Postmark
   smoke only after the no-traffic candidate is ready.
