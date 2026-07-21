# Production Pilot Live Readiness Request

Created: 2026-07-21T09:01:05.446Z
Values printed: false

This packet is a final evidence checklist only. It does not authenticate, send email, create users, create applications, hire anyone, write to JewelLink, deploy, move traffic, or write to either production database.

Status: needed

## Missing Or Invalid Evidence

| Field | Evidence needed |
| --- | --- |
| `decision.expectedDecision` | GO for controlled pilot |
| `decision.goNoGoDossier` | No TBD, MISSING, NOT RUN, WAITING APPROVAL, PARTIAL, or PROPOSED markers, and no blocked table statuses |
| `evidence.operationsReadinessReport` | Existing PASS artifact under docs/qa-runs/ |
| `evidence.pilotRosterReport` | Existing PASS artifact under docs/qa-runs/ |
| `evidence.pilotSmokeTargetsReport` | Existing PASS artifact under docs/qa-runs/ |
| `evidence.pilotApplicationSubmissionReport` | Existing PASS artifact under docs/qa-runs/ |
| `evidence.pilotSmokePlanReport` | Existing PASS artifact under docs/qa-runs/ |
| `evidence.pilotSmokeEvidenceReport` | Existing PASS artifact under docs/qa-runs/ |
| `approvals.jewelLinkRepoMovementApproval` | Concrete non-placeholder approval reference, ticket, or artifact path |
| `approvals.rollbackWindowApproval` | Concrete non-placeholder approval reference, ticket, or artifact path |
| `approvals.controlledApplicationSubmissionApproval` | Concrete non-placeholder approval reference, ticket, or artifact path |
| `approvals.mutatingSmokeApproval` | Concrete non-placeholder approval reference, ticket, or artifact path |

## Verification

Run `npm run qa:pilot-live-readiness -- --readiness-file=<path>` and require the live-readiness report to pass before treating the pilot as GO-ready.

Do not place full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, full production data extracts, or raw resume content in the manifest.
