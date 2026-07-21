# Production Admin Allowlist Audit

Created: 2026-07-21T09:00:17.670Z
Result: PASS
JewelHire service: jewelhire-prod-20260626/us-central1/jewelhire
JewelHire admin secret: jewelhire-admin-emails-v2:2
JewelLink project: academy-460316

## Counts

- JewelHire allowlist entries: 9
- Active JewelLink admin-role users: 9
- Missing active admins: 0
- Extra allowlist entries: 0
- Allowlisted active non-admin users: 0

## Checks

- PASS JewelHire admin allowlist secret is mounted
- PASS JewelHire admin allowlist secret is readable for comparison
- PASS JewelLink database credential is available for allowlist comparison
- PASS active JewelLink admin-role user set is non-empty
- PASS JewelHire allowlist includes every active JewelLink admin-role user
- PASS JewelHire allowlist has no extra entries outside active JewelLink admin roles
- PASS JewelHire allowlist contains no active JewelLink non-admin users

No email addresses, database URLs, tokens, passwords, cookies, or secret values are written to this report.
