# Production Public Fail-Closed Smoke Request

Created: 2026-07-21T16:24:55.388Z
Values printed: false

This packet is an evidence aid only. It does not create users, send email, transfer ownership, download or store resume content, write to JewelLink, or write to the JewelHire database.

Status: needed

## Missing Evidence

| Check | Evidence needed |
| --- | --- |
| store users count recorded before disabled invite probes | Provide the required authenticated pilot cookie, store id, resume application id, or investigate the failed live response. |
| team-invite capability is disabled before mutation probes | Provide the required authenticated pilot cookie, store id, resume application id, or investigate the failed live response. |
| team-invite mutation probes skipped because capability is not confirmed disabled | Provide the required authenticated pilot cookie, store id, resume application id, or investigate the failed live response. |
| resume download succeeds only for authenticated same-scope session with private headers | Provide the required authenticated pilot cookie, store id, resume application id, or investigate the failed live response. |

## Verification

Run `npm run qa:public-fail-closed-smoke -- --cookie-file=<local-cookie-file> --store-id=<pilot-store-id> --resume-application-id=<application-id>` and require the report to pass before using it for the publicFailClosed smoke evidence rows.

Do not place cookies, full email addresses, passwords, database URLs, bearer tokens, resume content, customer data, or secret values in committed evidence.
