# Pilot Rollback Window Proposal - 2026-07-20

Status: **proposed only, not GO evidence**.

This records a concrete operating proposal for the controlled pilot. It still
requires named owner approval before the go/no-go dossier can treat rollback
owners, observation window, or thresholds as closed.

## Proposed Owner Slots

| Slot | Proposed requirement | Approval status |
| --- | --- | --- |
| JewelHire traffic rollback owner | One named operator with GCP access to `jewelhire-prod-20260626/jewelhire` | Pending |
| JewelLink traffic rollback owner | One named operator with GCP access to `academy-460316/jewellink-dev` | Pending |
| JewelLink IAM/config rollback owner | One named operator allowed to revert Secret Manager IAM and Cloud Run env/config | Pending |
| Database recovery owner | One named database operator with provider-native backup/PITR access for both `pg.psdb.cloud` databases | Pending |
| Incident commander | One named person who can call stop/rollback during the pilot window | Pending |

## Proposed Observation Window

- Start: immediately after any approved pilot promotion or traffic/config
  movement.
- Duration: first 60 staffed minutes, with the owner team actively watching
  JewelHire, JewelLink, Cloud Run errors, the JewelLink health scheduler, and
  email/provider delivery.
- Extension: continue observing until 30 consecutive quiet minutes have passed
  after the last retry, warning, or manual correction.
- Closeout: record the exact UTC start/end time, owners present, alert status,
  smoke outcomes, and any rollback decisions in the go/no-go dossier.

## Proposed Immediate Rollback Thresholds

Rollback or disable the pilot path immediately for any of these:

- Any cross-store or cross-company data exposure.
- Any JewelLink role mapping that grants excess JewelHire authority.
- Consultant access or allowlisted non-admin platform-admin elevation.
- Private API access without authentication.
- Duplicate hire provisioning, wrong JewelLink user link, or non-idempotent hire
  retry.
- JewelCert invite/result sync to the wrong store, company, user, or role scope.
- Missing, mismatched, unreadable, or unexpectedly rotated integration secrets.
- New production migration drift, failed migration row, or unapproved schema
  repair.
- Sustained Cloud Run 5xx errors on either product: 3 or more 5xx responses in
  5 minutes on pilot paths, or any continuous 5xx burst that prevents login,
  SSO, hire, or JewelCert smoke completion.
- JewelLink JewelHire health scheduler failure twice in a row.
- Postmark or provider delivery to an unintended recipient.
- Any evidence artifact that prints a secret value, token, password, database
  URL, cookie, or customer PII.

## Proposed First Response

1. Stop new pilot actions and preserve logs/artifacts.
2. Roll back application traffic first when the failure is application,
   authorization, or integration behavior.
3. Disable or tighten pilot flags if the issue is limited to JewelLink launcher
   exposure or company allowlisting.
4. Use database restore only when the incident commander and database recovery
   owner confirm data or schema damage that traffic rollback cannot tolerate.
5. Record the exact action, UTC time, owner, revision/config target, and
   verification result before resuming any pilot work.
