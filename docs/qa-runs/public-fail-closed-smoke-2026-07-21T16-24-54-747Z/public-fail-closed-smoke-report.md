# Production Public Fail-Closed Smoke

Created: 2026-07-21T16:24:55.388Z
Base: https://jewelhire-azgiue5n5q-uc.a.run.app
Result: FAIL
Values printed: false

## Checks

- PASS authenticated pilot cookie is provided
- PASS authenticated session is readable
- PASS store id is available for team-invite probes
- PASS resolved store matches expected pilot store
- FAIL store users count recorded before disabled invite probes
- FAIL team-invite capability is disabled before mutation probes
- FAIL team-invite mutation probes skipped because capability is not confirmed disabled
- PASS resume application id is provided
- PASS resume download rejects public access
- FAIL resume download succeeds only for authenticated same-scope session with private headers

No cookies, full email addresses, bearer tokens, passwords, database URLs, resume content, or customer data are written to this report.
