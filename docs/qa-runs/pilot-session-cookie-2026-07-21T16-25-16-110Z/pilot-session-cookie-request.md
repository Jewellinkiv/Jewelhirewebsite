# Production Pilot Session Cookie Request

Created: 2026-07-21T16:25:16.248Z
Values printed: false

This packet is an evidence aid only. It calls for a real authenticated JewelLink SSO session but does not create users, send email, write to JewelHire, or write to JewelLink.

Status: needed

## Missing Evidence

| Check | Evidence needed |
| --- | --- |
| session came from expected auth source | Capture a fresh Diamond Exchange JewelLink SSO session in an allowed operator environment, save only the local cookie file, and rerun this read-only audit. |
| active store matches expected pilot store | Capture a fresh Diamond Exchange JewelLink SSO session in an allowed operator environment, save only the local cookie file, and rerun this read-only audit. |
| session store list includes expected pilot store | Capture a fresh Diamond Exchange JewelLink SSO session in an allowed operator environment, save only the local cookie file, and rerun this read-only audit. |

## Verification

Run `npm run qa:pilot-session-cookie -- --cookie-file=<local-cookie-file> --expected-store-id=<pilot-store-id> --allowed-roles=store_owner,manager` and require the report to pass before using the cookie for authenticated SSO, public/fail-closed, hire, or JewelCert smoke evidence.

Do not place cookies, full email addresses, passwords, database URLs, bearer tokens, customer data, or secret values in committed evidence.
