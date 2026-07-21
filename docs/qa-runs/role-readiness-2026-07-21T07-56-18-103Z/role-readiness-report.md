# Role And Session Readiness Audit

Base: https://app.jewelhire.com
Google Cloud project: jewelhire-prod-20260626
Cloud Run service: jewelhire
Created: 2026-07-21T07:56:19.666Z
Failures: 0

## Checks

- PASS Cloud Run requires auth
- PASS Cloud Run uses Postgres storage
- PASS Cloud Run staging session override is not enabled
- PASS Cloud Run admin email allowlist is secret-backed
- PASS live api ignores staging admin override
- PASS live store api ignores staging store override
- PASS live admin api ignores staging admin override
- PASS database URL available for role readiness
- PASS database has active login users
- PASS database has active store manager mappings
- PASS every active store has an active manager login candidate
- PASS database has applicant identities for portal matching

No user emails, database URLs, tokens, or secret values are written to this report.