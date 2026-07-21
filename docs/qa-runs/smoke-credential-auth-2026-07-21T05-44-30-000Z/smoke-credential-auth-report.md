# Production Smoke Credential Auth Audit

Created: 2026-07-21T05:44:18.425Z
Base: https://app.jewelhire.com
Result: PASS
Values printed: false

## Summary

- Required credential auth rows: 2
- Passing credential auth rows: 2
- Passing cleanup rows: 1
- Evidence request artifact: not generated

## Credential Auth Checks

| Credential | Result | Present | Password recorded | Session issued | Session role | Active store |
| --- | --- | --- | --- | --- | --- | --- |
| Store-owner smoke credential | PASS | yes | yes | yes | store_owner | yes |
| Applicant smoke credential | PASS | yes | yes | yes | associate | no |

## Cleanup Checks

| Cleanup | Result | Credential present | Password recorded | Explicit JewelLink SSO marker |
| --- | --- | --- | --- | --- |
| Native admin smoke password removed | PASS | yes | no | yes |

No full email addresses, passwords, database URLs, bearer tokens, cookies, customer data, or secret values are written to this report.
