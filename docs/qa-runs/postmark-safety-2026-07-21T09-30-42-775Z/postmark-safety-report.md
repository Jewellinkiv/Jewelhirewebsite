# Postmark Safety Audit

Google Cloud project: jewelhire-prod-20260626
Cloud Run service: jewelhire
Created: 2026-07-21T09:30:43.636Z
Failures: 0

## Checks

- PASS Postmark adapter source exists
- PASS adapter exposes disabled and dry-run states
- PASS adapter checks notification gate before token and fetch
- PASS adapter skips missing recipients before runtime send checks
- PASS adapter sends through Postmark API only from central helper
- PASS adapter hard-times out ambiguous provider requests
- PASS adapter includes message stream and metadata controls
- PASS docs keep live-send gate explicit
- PASS Cloud Run Postmark token is mounted as secret
- PASS Cloud Run Postmark sender is configured by name only
- PASS Cloud Run Postmark stream is configured by name only
- PASS Cloud Run live sends are disabled or explicitly allowed
- PASS Cloud Run live sends are not active during default QA loop unless explicitly allowed

Live side effects: none. This audit does not call Postmark, does not send email, and does not print token, sender, stream, or recipient values.