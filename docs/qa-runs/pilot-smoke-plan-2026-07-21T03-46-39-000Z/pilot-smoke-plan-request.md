# Production Pilot Smoke Plan Request

Created: 2026-07-21T03:47:49.070Z
Values printed: false

This packet is an approval and preflight aid only. It does not authenticate, send email, create users, hire anyone, write to JewelLink, or write to the JewelHire production database.

Status: needed

## Missing Or Invalid Plan Items

| Field | Evidence needed |
| --- | --- |
| `approvals.productionUserCreationApproved` | true |
| `approvals.hireConfirmationApproved` | true |
| `approvals.jewelCertProductionMutationApproved` | true |
| `approvals.publicFailClosedProbeApproved` | true |
| `approvals.rollbackWindowApproved` | true |
| `prerequisites.operationsReadinessReport` | Existing PASS docs/qa-runs operations-readiness report with rollback owner/window evidence closed |
| `prerequisites.pilotRosterReport` | Existing PASS docs/qa-runs pilot-roster report with all SSO personas ready |
| `personas.consultantDenialAlias` | Non-secret value |
| `personas.allowlistedNonAdminDenialAlias` | Non-secret value |
| `personas.pausedCompanyDenialAlias` | Non-secret value |
| `scopes.authenticatedSso.approvedPersonaMatrix` | true |
| `scopes.hireHandoff.applicationAlias` | Non-secret value |
| `scopes.publicFailClosed.resumeApplicationId` | Non-secret value |

## Verification

Run `npm run qa:pilot-smoke-plan -- --smoke-plan-file=<path>` and require the pilot-smoke plan report to pass before starting authenticated SSO, hire, JewelCert, team-invite, or resume privacy smokes in production.

Do not place full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, full production data extracts, or raw resume content in the plan file.
