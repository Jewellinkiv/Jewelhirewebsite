# Production Pilot Session Cookie Audit

Created: 2026-07-21T16:25:16.248Z
Base: https://jewelhire-azgiue5n5q-uc.a.run.app
Result: FAIL
Values printed: false

## Expected Scope

- Expected auth source: jewellink_sso
- Allowed roles: store_owner, manager
- Expected store id recorded: true

## Checks

- PASS authenticated JewelHire session cookie is provided
- PASS /api/me returns an authenticated session
- FAIL session came from expected auth source
- PASS session role is allowed for pilot smoke
- PASS expected pilot store id is configured
- FAIL active store matches expected pilot store
- FAIL session store list includes expected pilot store

No cookies, full email addresses, bearer tokens, passwords, database URLs, customer data, or secret values are written to this report.
