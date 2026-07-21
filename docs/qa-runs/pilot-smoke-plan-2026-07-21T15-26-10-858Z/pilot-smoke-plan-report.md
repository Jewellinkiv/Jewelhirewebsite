# Production Pilot Smoke Plan Audit

Created: 2026-07-21T15:26:10.861Z
Result: FAIL
Values printed: false

## Summary

- Plan file provided: no
- Checks: 54
- Passing checks: 2
- Missing or invalid checks: 52
- Plan request artifact: pilot-smoke-plan-request.md

## Checks

- PASS pilot smoke plan contains no unsafe secret or PII values
- FAIL Named pilot smoke approver is recorded
- FAIL Approval channel or ticket reference is recorded
- FAIL Approved production smoke scope statement is recorded
- FAIL Approval timestamp is ISO-like UTC
- FAIL Live email sends are explicitly acknowledged for pilot QA
- FAIL JewelLink pilot rollout flag movement is explicitly approved
- FAIL Controlled production user/persona creation is explicitly approved
- FAIL Controlled hire confirmation/revocation smoke is explicitly approved
- FAIL Controlled JewelCert invite/completion/result smoke is explicitly approved
- FAIL Authenticated public/fail-closed probes are explicitly approved
- FAIL Rollback owner/window/threshold evidence is explicitly approved
- FAIL Operations readiness report is a concrete PASS artifact
- FAIL Pilot roster report is a concrete PASS artifact
- FAIL Integration smoke preflight report is a concrete PASS artifact
- FAIL Smoke credential auth report is a concrete PASS artifact
- FAIL Director SSO persona alias is recorded
- FAIL Manager SSO persona alias is recorded
- FAIL Student SSO persona alias is recorded
- FAIL Platform-admin SSO persona alias is recorded
- FAIL Allowlisted non-admin denial persona alias or approved evidence strategy alias is recorded
- FAIL Consultant denial strategy is recognized
- PASS Allowlisted non-admin denial strategy is recognized
- FAIL Paused-company denial strategy is recognized
- FAIL Authenticated SSO smoke is in scope
- FAIL Authenticated SSO operator alias is recorded
- FAIL Authenticated SSO persona matrix is approved
- FAIL Authenticated SSO smoke avoids non-pilot data
- FAIL Hire handoff smoke is in scope
- FAIL Hire handoff controlled application alias is recorded
- FAIL Hire handoff controlled mailbox alias is recorded
- FAIL Hire handoff target JewelLink company ID is recorded
- FAIL Hire handoff previews before confirmation
- FAIL Hire handoff repeat-confirm idempotency check is planned
- FAIL Hire handoff revoke/cancel access check is planned
- FAIL JewelCert smoke is in scope
- FAIL JewelCert invite source alias is recorded
- FAIL JewelCert controlled mailbox alias is recorded
- FAIL JewelCert result sync target is recorded
- FAIL JewelCert retry failure mode is recorded
- FAIL JewelCert live email send is expected and acknowledged
- FAIL Public/fail-closed smoke is in scope
- FAIL Public/fail-closed store ID is recorded
- FAIL Public/fail-closed expected store ID is recorded
- FAIL Public/fail-closed store ID matches expected store ID
- FAIL Public/fail-closed resume application ID is recorded
- FAIL Public/fail-closed cookie file stays local and ignored
- FAIL Public/fail-closed team-invites-disabled precheck is required
- FAIL Stop conditions include tenant data exposure
- FAIL Stop conditions include role elevation
- FAIL Stop conditions include hire duplication or wrong user link
- FAIL Stop conditions include JewelCert wrong target
- FAIL Stop conditions include email/provider misdelivery
- FAIL Stop conditions include secret-bearing evidence

No full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, secret values, or raw production data are written to this report.
