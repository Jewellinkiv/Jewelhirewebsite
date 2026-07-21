# Production Pilot Smoke Plan Request

Created: 2026-07-21T15:26:10.861Z
Values printed: false

This packet is an approval and preflight aid only. It does not authenticate, send email, create users, hire anyone, write to JewelLink, or write to the JewelHire production database.

Status: needed

## Missing Or Invalid Plan Items

| Field | Evidence needed |
| --- | --- |
| `approvals.approver` | Concrete non-placeholder non-secret value |
| `approvals.approvalChannel` | Concrete non-placeholder non-secret value |
| `approvals.scopeStatement` | Concrete non-placeholder non-secret value |
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
| `personas.directorAlias` | Concrete non-placeholder non-secret value |
| `personas.managerAlias` | Concrete non-placeholder non-secret value |
| `personas.studentAlias` | Concrete non-placeholder non-secret value |
| `personas.platformAdminAlias` | Concrete non-placeholder non-secret value |
| `personas.allowlistedNonAdminDenialAlias` | Concrete non-placeholder non-secret value |
| `personas.consultantDenialEvidence.strategy` | production-persona or source-policy-evidence |
| `personas.pausedCompanyDenialEvidence.strategy` | production-persona or deferred |
| `scopes.authenticatedSso.enabled` | true |
| `scopes.authenticatedSso.operatorAlias` | Concrete non-placeholder non-secret value |
| `scopes.authenticatedSso.approvedPersonaMatrix` | true |
| `scopes.authenticatedSso.nonPilotDataAvoidance` | true |
| `scopes.hireHandoff.enabled` | true |
| `scopes.hireHandoff.applicationAlias` | Concrete non-placeholder non-secret value |
| `scopes.hireHandoff.controlledMailboxAlias` | Concrete non-placeholder non-secret value |
| `scopes.hireHandoff.targetCompanyId` | Concrete non-placeholder non-secret value |
| `scopes.hireHandoff.previewBeforeConfirm` | true |
| `scopes.hireHandoff.repeatConfirmIdempotencyCheck` | true |
| `scopes.hireHandoff.revokeOrCancelCheck` | true |
| `scopes.jewelCert.enabled` | true |
| `scopes.jewelCert.inviteSourceAlias` | Concrete non-placeholder non-secret value |
| `scopes.jewelCert.controlledMailboxAlias` | Concrete non-placeholder non-secret value |
| `scopes.jewelCert.resultSyncTarget` | Concrete non-placeholder non-secret value |
| `scopes.jewelCert.retryFailureMode` | Concrete non-placeholder non-secret value |
| `scopes.jewelCert.liveEmailExpected` | true |
| `scopes.publicFailClosed.enabled` | true |
| `scopes.publicFailClosed.storeId` | Concrete non-placeholder non-secret value |
| `scopes.publicFailClosed.expectedStoreId` | Concrete non-placeholder non-secret value |
| `scopes.publicFailClosed.storeId` | storeId and expectedStoreId must match |
| `scopes.publicFailClosed.resumeApplicationId` | Concrete non-placeholder non-secret value |
| `scopes.publicFailClosed.cookieFileLocalIgnored` | true |
| `scopes.publicFailClosed.teamInvitesDisabledPrecheckRequired` | true |
| `stopConditions` | Cross-store or cross-company data exposure stop condition |
| `stopConditions` | Role/elevation stop condition |
| `stopConditions` | Hire duplication or wrong user stop condition |
| `stopConditions` | JewelCert wrong store/company/user stop condition |
| `stopConditions` | Unintended email/provider delivery stop condition |
| `stopConditions` | Secret-bearing evidence stop condition |

## Verification

Run `npm run qa:pilot-smoke-plan -- --smoke-plan-file=<path>` and require the pilot-smoke plan report to pass before starting authenticated SSO, hire, JewelCert, team-invite, or resume privacy smokes in production.

Do not place full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, full production data extracts, or raw resume content in the plan file.
