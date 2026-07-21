# Production Pilot Smoke Plan Audit

Created: 2026-07-21T03:47:49.070Z
Result: FAIL
Values printed: false

## Summary

- Plan file provided: yes
- Checks: 53
- Passing checks: 40
- Missing or invalid checks: 13
- Plan request artifact: pilot-smoke-plan-request.md

## Checks

- PASS pilot smoke plan contains no unsafe secret or PII values
- PASS Named pilot smoke approver is recorded
- PASS Approval channel or ticket reference is recorded
- PASS Approved production smoke scope statement is recorded
- PASS Approval timestamp is ISO-like UTC
- PASS Live email sends are explicitly acknowledged for pilot QA
- PASS JewelLink pilot rollout flag movement is explicitly approved
- FAIL Controlled production user/persona creation is explicitly approved
- FAIL Controlled hire confirmation/revocation smoke is explicitly approved
- FAIL Controlled JewelCert invite/completion/result smoke is explicitly approved
- FAIL Authenticated public/fail-closed probes are explicitly approved
- FAIL Rollback owner/window/threshold evidence is explicitly approved
- FAIL Operations readiness report is a concrete PASS artifact (docs/qa-runs/operations-readiness-2026-07-21T02-23-48-469Z/operations-readiness-report.md)
- FAIL Pilot roster report is a concrete PASS artifact (docs/qa-runs/pilot-roster-2026-07-21T02-31-32-809Z/pilot-roster-report.md)
- PASS Integration smoke preflight report is a concrete PASS artifact (docs/qa-runs/integration-smoke-preflight-2026-07-20T23-29-09-249Z/integration-smoke-preflight-report.md)
- PASS Smoke credential auth report is a concrete PASS artifact (docs/qa-runs/smoke-credential-auth-2026-07-21T01-47-42-153Z/smoke-credential-auth-report.md)
- PASS Director SSO persona alias is recorded
- PASS Manager SSO persona alias is recorded
- PASS Student SSO persona alias is recorded
- FAIL Consultant-denial SSO persona alias is recorded
- PASS Platform-admin SSO persona alias is recorded
- FAIL Allowlisted non-admin denial persona alias or approved evidence strategy alias is recorded
- FAIL Paused-company denial persona alias is recorded
- PASS Authenticated SSO smoke is in scope
- PASS Authenticated SSO operator alias is recorded
- FAIL Authenticated SSO persona matrix is approved
- PASS Authenticated SSO smoke avoids non-pilot data
- PASS Hire handoff smoke is in scope
- FAIL Hire handoff controlled application alias is recorded
- PASS Hire handoff controlled mailbox alias is recorded
- PASS Hire handoff target JewelLink company ID is recorded
- PASS Hire handoff previews before confirmation
- PASS Hire handoff repeat-confirm idempotency check is planned
- PASS Hire handoff revoke/cancel access check is planned
- PASS JewelCert smoke is in scope
- PASS JewelCert invite source alias is recorded
- PASS JewelCert controlled mailbox alias is recorded
- PASS JewelCert result sync target is recorded
- PASS JewelCert retry failure mode is recorded
- PASS JewelCert live email send is expected and acknowledged
- PASS Public/fail-closed smoke is in scope
- PASS Public/fail-closed store ID is recorded
- PASS Public/fail-closed expected store ID is recorded
- PASS Public/fail-closed store ID matches expected store ID
- FAIL Public/fail-closed resume application ID is recorded
- PASS Public/fail-closed cookie file stays local and ignored
- PASS Public/fail-closed team-invites-disabled precheck is required
- PASS Stop conditions include tenant data exposure
- PASS Stop conditions include role elevation
- PASS Stop conditions include hire duplication or wrong user link
- PASS Stop conditions include JewelCert wrong target
- PASS Stop conditions include email/provider misdelivery
- PASS Stop conditions include secret-bearing evidence

No full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, or raw production data are written to this report.
