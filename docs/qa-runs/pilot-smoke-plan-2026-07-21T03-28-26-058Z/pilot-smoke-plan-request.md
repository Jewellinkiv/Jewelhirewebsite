# Production Pilot Smoke Plan Request

Created: 2026-07-21T03:28:26.060Z
Values printed: false

This packet is an approval and preflight aid only. It does not authenticate, send email, create users, hire anyone, write to JewelLink, or write to the JewelHire production database.

Status: needed

## Missing Or Invalid Plan Items

| Field | Evidence needed |
| --- | --- |
| `approvals.approver` | Non-secret value |
| `approvals.approvalChannel` | Non-secret value |
| `approvals.scopeStatement` | Non-secret value |
| `approvals.approvedAt` | ISO-like UTC timestamp |
| `approvals.liveEmailSendsAcknowledged` | true |
| `approvals.jewelLinkPilotFlagMovementApproved` | true |
| `approvals.productionUserCreationApproved` | true |
| `approvals.hireConfirmationApproved` | true |
| `approvals.jewelCertProductionMutationApproved` | true |
| `approvals.publicFailClosedProbeApproved` | true |
| `approvals.rollbackWindowApproved` | true |
| `prerequisites.operationsReadinessReport` | Existing PASS docs/qa-runs operations-readiness report with rollback owner/window evidence closed |
| `prerequisites.pilotRosterReport` | Existing PASS docs/qa-runs pilot-roster report with all SSO personas ready |
| `prerequisites.integrationSmokePreflightReport` | Existing PASS docs/qa-runs integration-smoke-preflight report |
| `prerequisites.smokeCredentialAuthReport` | Existing PASS docs/qa-runs smoke-credential-auth report |
| `personas.directorAlias` | Non-secret value |
| `personas.managerAlias` | Non-secret value |
| `personas.studentAlias` | Non-secret value |
| `personas.consultantDenialAlias` | Non-secret value |
| `personas.platformAdminAlias` | Non-secret value |
| `personas.allowlistedNonAdminDenialAlias` | Non-secret value |
| `personas.pausedCompanyDenialAlias` | Non-secret value |
| `scopes.authenticatedSso.operatorAlias` | Non-secret value |
| `scopes.authenticatedSso.approvedPersonaMatrix` | true |
| `scopes.authenticatedSso.nonPilotDataAvoidance` | true |
| `scopes.hireHandoff.applicationAlias` | Non-secret value |
| `scopes.hireHandoff.controlledMailboxAlias` | Non-secret value |
| `scopes.hireHandoff.previewBeforeConfirm` | true |
| `scopes.hireHandoff.repeatConfirmIdempotencyCheck` | true |
| `scopes.hireHandoff.revokeOrCancelCheck` | true |
| `scopes.jewelCert.inviteSourceAlias` | Non-secret value |
| `scopes.jewelCert.controlledMailboxAlias` | Non-secret value |
| `scopes.jewelCert.retryFailureMode` | Non-secret value |
| `scopes.jewelCert.liveEmailExpected` | true |
| `scopes.publicFailClosed.storeId` | Non-secret value |
| `scopes.publicFailClosed.expectedStoreId` | Non-secret value |
| `scopes.publicFailClosed.storeId` | storeId and expectedStoreId must match |
| `scopes.publicFailClosed.resumeApplicationId` | Non-secret value |
| `scopes.publicFailClosed.cookieFileLocalIgnored` | true |
| `scopes.publicFailClosed.teamInvitesDisabledPrecheckRequired` | true |

## Verification

Run `npm run qa:pilot-smoke-plan -- --smoke-plan-file=<path>` and require the pilot-smoke plan report to pass before starting authenticated SSO, hire, JewelCert, team-invite, or resume privacy smokes in production.

Do not place full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, full production data extracts, or raw resume content in the plan file.
