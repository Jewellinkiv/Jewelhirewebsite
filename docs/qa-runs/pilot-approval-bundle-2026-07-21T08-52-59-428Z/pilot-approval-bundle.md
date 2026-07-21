# Production Pilot Live Approval Bundle

Created: 2026-07-21T08:52:59.431Z
Values printed: false
Production mutation performed: no
JewelLink repo push or deploy performed: no

This bundle is an operator checklist. It does not authenticate, send email, create users, submit applications, hire anyone, write to JewelLink, deploy, move traffic, or write to either production database.

## Source Artifacts

| Packet | Artifact |
| --- | --- |
| operations-request | `docs/qa-runs/operations-readiness-2026-07-21T08-30-56-864Z/operations-readiness-evidence-request.json` |
| roster-packet | `docs/qa-runs/pilot-roster-2026-07-21T08-30-56-900Z/pilot-roster-provisioning-packet.json` |
| application-request | `docs/qa-runs/pilot-application-submission-2026-07-21T08-31-25-486Z/pilot-application-submission-request.json` |
| smoke-plan-request | `docs/qa-runs/pilot-smoke-plan-2026-07-21T08-13-07-305Z/pilot-smoke-plan-request.json` |

## Open Approvals And Actions

| Area | Field/action | Required evidence |
| --- | --- | --- |
| Operations rollback | `rollback.jewelhireOwner` | Named owner and contact or approval channel |
| Operations rollback | `rollback.jewellinkOwner` | Named owner and contact or approval channel |
| Operations rollback | `rollback.jewellinkIamOwner` | Named owner and contact or approval channel |
| Operations rollback | `rollback.databaseRecoveryOwner` | Named owner and contact or approval channel |
| Operations rollback | `rollback.observationWindow` | Approved UTC start/end window |
| Operations rollback | `rollback.rollbackThresholds` | Approved stop/rollback threshold summary |
| JewelLink controlled persona | `consultant-denial` | Create controlled JewelLink CONSULTANT denial persona |
| JewelLink controlled persona | `paused-company-denial` | Create controlled active user in a paused JewelLink company |
| Controlled public application setup | `execution mode is explicitly requested` | --execute for production write; dry-run is safe by default |
| Controlled public application setup | `local ignored execution approval file` | Before rerunning with --execute, record approver, approval channel, approvedAt, controlledPublicApplicationSubmissionApproved, liveEmailSendsAcknowledged, controlledApplicantMailboxApproved, and a stable submissionId. |
| Approval | `approvals.productionUserCreationApproved` | true |
| Approval | `approvals.hireConfirmationApproved` | true |
| Approval | `approvals.jewelCertProductionMutationApproved` | true |
| Approval | `approvals.publicFailClosedProbeApproved` | true |
| Approval | `approvals.rollbackWindowApproved` | true |
| Prerequisite artifact | `prerequisites.operationsReadinessReport` | Existing PASS docs/qa-runs operations-readiness report with rollback owner/window evidence closed |
| Prerequisite artifact | `prerequisites.pilotRosterReport` | Existing PASS docs/qa-runs pilot-roster report with all SSO personas ready |
| Persona or acceptance | `personas.consultantDenialAlias` | Concrete non-placeholder non-secret value |
| Persona or acceptance | `personas.pausedCompanyDenialAlias` | Concrete non-placeholder non-secret value |
| Persona or acceptance | `personas.allowlistedNonAdminDenialEvidence.acceptedBy` | Concrete non-placeholder non-secret value |
| Persona or acceptance | `personas.allowlistedNonAdminDenialEvidence.acceptanceChannel` | Concrete non-placeholder non-secret value |
| Persona or acceptance | `personas.allowlistedNonAdminDenialEvidence.acceptedAt` | ISO-like UTC timestamp |
| Smoke scope | `scopes.authenticatedSso.approvedPersonaMatrix` | true |
| Smoke scope | `scopes.hireHandoff.applicationAlias` | Concrete non-placeholder non-secret value |
| Smoke scope | `scopes.publicFailClosed.resumeApplicationId` | Concrete non-placeholder non-secret value |

## Operator Reply Template

Use this as the approval/owner intake text. Replace placeholders before treating it as approval evidence; leaving placeholders means the gate remains NO-GO.

```text
I approve the controlled JewelHire/JewelLink pilot readiness work to proceed only within the documented pilot scope and stop conditions.

Approval metadata:
- Approver: <name/role>
- Approval channel: <ticket/thread/reference>
- Approved at: <UTC timestamp>
- Scope statement: <approved pilot QA scope summary>

Rollback and observation window:
- JewelHire rollback owner: <name/channel>
- JewelLink rollback owner: <name/channel>
- JewelLink IAM/config rollback owner: <name/channel>
- Database recovery owner: <name/channel>
- Observation window: <UTC start/end>
- Rollback thresholds: <approved stop/rollback threshold summary>
- I approve the rollback window and rollback thresholds above for the controlled pilot.

Controlled setup:
- I approve creating or approving the controlled JewelLink CONSULTANT denial persona for the pilot SSO denial smoke.
- I approve creating or approving the controlled active paused-company JewelLink user for stale-access denial smoke.
- I approve executing exactly one controlled JewelHire public application submission through the guarded helper, using a local ignored approval file, with live application notification emails acknowledged and controlled applicant mailbox access approved.
- Stable controlled application submission ID: <idempotency key>

Smoke aliases and non-secret targets:
- Director SSO persona alias: <alias>
- Manager SSO persona alias: <alias>
- Student SSO persona alias: <alias>
- Consultant-denial SSO persona alias: <alias after persona exists>
- Platform-admin SSO persona alias: <alias>
- Paused-company denial SSO persona alias: <alias after persona exists>
- Authenticated SSO operator alias: <operator alias>
- Allowlisted non-admin denial strategy: source-test-plus-clean-allowlist
- Allowlisted non-admin denial alias: source-test-plus-clean-allowlist
- Allowlisted non-admin source-test accepted by: <name/role>
- Allowlisted non-admin source-test acceptance channel: <ticket/thread/reference>
- Allowlisted non-admin source-test accepted at: <UTC timestamp>
- Controlled hire application alias: <alias/application id after setup>
- Hire controlled mailbox alias: <alias>
- JewelCert invite source alias: <alias>
- JewelCert controlled mailbox alias: <alias>
- JewelCert retry/failure mode: <summary>
- Public/fail-closed store ID: <store id>
- Public/fail-closed expected store ID: <same store id>
- Resume application ID: <application id after controlled setup>

Mutating smoke scope:
- I approve controlled production user/persona creation only for the documented pilot QA personas.
- I approve controlled hire preview, confirm, repeat-confirm, and revoke/cancel access smoke for the pilot application.
- I approve controlled JewelCert invite, completion, result sync, and retry/failure-mode smoke for the pilot mailbox and company.
- I approve authenticated public/fail-closed probes, including team-invite-disabled and resume privacy checks, using local ignored session artifacts only.
- I approve authenticated SSO using only the listed persona matrix for Director, Manager, Student, Consultant denial, platform admin, allowlisted non-admin denial, and paused-company denial, while avoiding non-pilot data.
- I accept the source-test plus clean-allowlist strategy for allowlisted non-admin denial, or I will provide a controlled production non-admin denial persona instead.

JewelLink boundary:
- I do not approve a JewelLink code push or code deploy unless I state that separately. This approval covers only the already-approved pilot flag/config movement and the controlled pilot smoke setup.
```

## Local Ignored File Skeletons

Operations evidence file:

```json
{
  "recommendedPath": ".qa_tmp/production-operations-evidence.json",
  "value": {
    "backups": {
      "jewelhire": {
        "method": "encrypted-logical",
        "id": "jewelhire-postgres-2026-07-21T02-02-42Z.dump.enc",
        "completedAt": "2026-07-21T02:04:43.051Z",
        "verifiedAt": "2026-07-21T02:04:43.174Z",
        "retention": "Encrypted logical backup retained in operator backup folder for pilot rollback evidence; passphrase stored in Secret Manager secret jewelhire-pilot-logical-backup-passphrase-20260721 version 1.",
        "restoreEvidence": "pg_restore --list verified 602 archive entries; restore-list artifact jewelhire-postgres-2026-07-21T02-02-42Z.restore-list.txt; restore-list sha256 bba55a29024f4b065787d18d0de2d84d1c03cf62469ddf47b643d3a4ebdb6eec.",
        "logicalSha256": "3cbb0a1f6a9d511842b3864f1bb13274b0d7b9c750869eb3b168b28a2692b4a0"
      },
      "jewellink": {
        "method": "encrypted-logical",
        "id": "jewellink-postgres-2026-07-21T02-02-42Z.dump.enc",
        "completedAt": "2026-07-21T02:19:00Z",
        "verifiedAt": "2026-07-21T02:20:06.050Z",
        "retention": "Encrypted logical backup retained in operator backup folder for pilot rollback evidence; passphrase stored in Secret Manager secret jewelhire-pilot-logical-backup-passphrase-20260721 version 1.",
        "restoreEvidence": "pg_restore --list verified 2640 archive entries; restore-list artifact jewellink-postgres-2026-07-21T02-02-42Z.restore-list.txt; restore-list sha256 d975df3c2bdf09b2ce6956fba7c634cf9787a0432fc712afe6761d466f008ae1.",
        "logicalSha256": "524d079ae12e47a931bd4b449cd88379f1f780fa6c129415ca92f98e35fbf7b8"
      }
    },
    "rollback": {
      "jewelhireOwner": "",
      "jewellinkOwner": "",
      "jewellinkIamOwner": "",
      "databaseRecoveryOwner": "",
      "observationWindow": "",
      "rollbackThresholds": ""
    },
    "monitoring": {
      "channel": ""
    }
  },
  "verificationCommand": "npm run qa:operations-readiness -- --operations-evidence-file=.qa_tmp/production-operations-evidence.json"
}
```

Controlled application approval file:

```json
{
  "recommendedPath": ".qa_tmp/production-pilot-application-approval.json",
  "value": {
    "approvals": {
      "approver": "",
      "approvalChannel": "",
      "approvedAt": "",
      "controlledPublicApplicationSubmissionApproved": false,
      "liveEmailSendsAcknowledged": false,
      "controlledApplicantMailboxApproved": false,
      "submissionId": ""
    }
  },
  "verificationCommand": "npm run qa:pilot-application-submission -- --execute --target-report=<pilot-smoke-targets-report.json> --approval-file=.qa_tmp/production-pilot-application-approval.json"
}
```

Smoke plan file:

```json
{
  "recommendedPath": ".qa_tmp/production-pilot-smoke-plan.json",
  "value": {
    "approvals": {
      "approver": "",
      "approvalChannel": "",
      "approvedAt": "",
      "scopeStatement": "",
      "liveEmailSendsAcknowledged": false,
      "jewelLinkPilotFlagMovementApproved": false,
      "productionUserCreationApproved": false,
      "hireConfirmationApproved": false,
      "jewelCertProductionMutationApproved": false,
      "publicFailClosedProbeApproved": false,
      "rollbackWindowApproved": false
    },
    "prerequisites": {
      "operationsReadinessReport": "",
      "pilotRosterReport": "",
      "integrationSmokePreflightReport": "",
      "smokeCredentialAuthReport": ""
    },
    "personas": {
      "directorAlias": "",
      "managerAlias": "",
      "studentAlias": "",
      "consultantDenialAlias": "",
      "platformAdminAlias": "",
      "allowlistedNonAdminDenialAlias": "",
      "allowlistedNonAdminDenialEvidence": {
        "strategy": "",
        "sourceTestReport": "",
        "cleanAllowlistReport": "",
        "acceptedBy": "",
        "acceptanceChannel": "",
        "acceptedAt": ""
      },
      "pausedCompanyDenialAlias": ""
    },
    "scopes": {
      "authenticatedSso": {
        "enabled": true,
        "operatorAlias": "",
        "approvedPersonaMatrix": false,
        "nonPilotDataAvoidance": false
      },
      "hireHandoff": {
        "enabled": true,
        "applicationAlias": "",
        "controlledMailboxAlias": "",
        "targetCompanyId": "comp_1",
        "previewBeforeConfirm": false,
        "repeatConfirmIdempotencyCheck": false,
        "revokeOrCancelCheck": false
      },
      "jewelCert": {
        "enabled": true,
        "inviteSourceAlias": "",
        "controlledMailboxAlias": "",
        "resultSyncTarget": "comp_1",
        "retryFailureMode": "",
        "liveEmailExpected": false
      },
      "publicFailClosed": {
        "enabled": true,
        "storeId": "",
        "expectedStoreId": "",
        "resumeApplicationId": "",
        "cookieFileLocalIgnored": false,
        "teamInvitesDisabledPrecheckRequired": false
      }
    },
    "stopConditions": [
      "Cross-store or cross-company data exposure",
      "Unexpected role elevation or Consultant access",
      "Duplicate hire provisioning or wrong JewelLink user link",
      "JewelCert result sync to the wrong store/company/user",
      "Email/provider delivery to an unintended recipient",
      "Any evidence artifact prints a secret, token, cookie, password, database URL, or customer data"
    ]
  },
  "verificationCommand": "npm run qa:pilot-smoke-plan -- --smoke-plan-file=.qa_tmp/production-pilot-smoke-plan.json"
}
```

## Recommended Sequence

1. Fill operations rollback owners, exact UTC observation window, and rollback thresholds in the local operations evidence file; rerun qa:operations-readiness and require PASS.
2. Create or approve the two controlled JewelLink production personas from the roster packet; rerun qa:pilot-roster and require PASS.
3. Save the filled operator reply in a local ignored file and run qa:pilot-operator-reply-intake with --write-local-drafts; use the generated local drafts for the next audits and do not commit the filled reply or drafts.
4. After explicit controlled-application approval, fill the local application approval file with a stable submissionId and execute qa:pilot-application-submission once.
5. Rerun qa:pilot-smoke-targets and copy only non-secret application IDs into the local smoke plan.
6. Fill the smoke-plan approvals, persona aliases, acceptance metadata, and controlled IDs; rerun qa:pilot-smoke-plan and require PASS before live authenticated smokes.
7. Run authenticated SSO, hire, JewelCert, and public fail-closed smokes; fill the smoke evidence file and require qa:pilot-smoke-evidence PASS.
8. Only after the dossier is changed to GO and all PASS artifacts exist, fill the final live-readiness manifest and require qa:pilot-live-readiness PASS.

## Secret Handling

Do not place full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, full production extracts, or raw resume content in any committed evidence or local approval file.
