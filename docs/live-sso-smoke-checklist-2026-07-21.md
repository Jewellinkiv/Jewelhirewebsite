# Live SSO Smoke Checklist - 2026-07-21

Status: waiting on a real Diamond Exchange JewelLink SSO session.

This checklist is the next operator runbook after JewelLink PR `#246` merged
and release-path PR `#247` was opened. It does not authorize a deploy,
production traffic movement, database migration, customer-data review, or
unscoped production write.

## Current Inputs

| Item | Value |
| --- | --- |
| JewelHire production base | `https://app.jewelhire.com` |
| Pilot company | Diamond Exchange, JewelLink `comp_1` |
| Pilot JewelHire store | `store-jl-58deb73ef9454405c4fe` |
| Controlled application | `app-32dbfd01-3092-4190-9c15-cf43aa72ff46` |
| Passing smoke plan | `docs/qa-runs/pilot-smoke-plan-2026-07-21T16-24-32-315Z/pilot-smoke-plan-report.md` |
| Latest smoke evidence request | `docs/qa-runs/pilot-smoke-evidence-2026-07-21T16-25-53-517Z/pilot-smoke-evidence-request.md` |
| Local cookie file target | `.qa_tmp/diamond-exchange-pilot-jewelhire-cookie.json` |

## Required Session Capture

Capture a fresh JewelHire session that was created from JewelLink SSO, not a
native JewelHire login.

Use either the Diamond Exchange Director or Manager JewelLink account selected
by the roster audit:

- Director alias: `cmnjh2zrj0000p6y8axdo1608`
- Manager alias: `cmnjh2zw40002p6y81ytmlxqb`

After launching JewelHire from JewelLink, save only the JewelHire session
cookie into the ignored local cookie file. Do not commit cookies, full email
addresses, passwords, bearer tokens, database URLs, customer data, resume
contents, or screenshots containing private data.

## First Gate

Run the read-only session preflight before any authenticated smoke uses the
cookie:

```bash
npm run qa:pilot-session-cookie -- \
  --base=https://app.jewelhire.com \
  --cookie-file=.qa_tmp/diamond-exchange-pilot-jewelhire-cookie.json \
  --expected-store-id=store-jl-58deb73ef9454405c4fe \
  --allowed-roles=store_owner,manager \
  --expected-auth-source=jewellink_sso
```

Expected result: PASS. If it fails as `native`, wrong store, wrong role, or
missing `jewellink_sso`, stop and recapture through JewelLink SSO.

## Smoke Rows To Close

| Area | Rows still requiring live authenticated evidence |
| --- | --- |
| SSO | Director, Manager, Student, and platform-admin |
| Hire handoff | Preview, confirm, repeat-confirm idempotency, revoked/cancelled access |
| JewelCert | Invite from JewelLink, completion, scoped sync to JewelLink, retry |
| Public/fail-closed | Team invites disabled without mutation, resume public `401` plus same-store authorized access |

Consultant denial is intentionally closed by source-policy evidence because
Consultants cannot access JewelHire. Paused-company denial is deferred for this
pilot scope. Allowlisted non-admin denial is accepted through source-test plus
clean live allowlist evidence.

## Public/Fail-Closed Producer

After the session preflight passes, run:

```bash
npm run qa:public-fail-closed-smoke -- \
  --base=https://app.jewelhire.com \
  --cookie-file=.qa_tmp/diamond-exchange-pilot-jewelhire-cookie.json \
  --store-id=store-jl-58deb73ef9454405c4fe \
  --expected-store-id=store-jl-58deb73ef9454405c4fe \
  --resume-application-id=app-32dbfd01-3092-4190-9c15-cf43aa72ff46
```

The runner must refuse invite and ownership-transfer probes unless JewelHire
first confirms `teamInvitesEnabled: false`.

## Evidence Closure

After every authenticated row has a non-secret artifact under `docs/qa-runs/`,
copy `docs/production-pilot-smoke-evidence.template.json` to an ignored local
path, fill artifact paths only, and run:

```bash
npm run qa:pilot-smoke-evidence -- \
  --smoke-evidence-file=.qa_tmp/production-pilot-smoke-evidence.json
```

Only after that passes should the go/no-go dossier move from NO-GO to GO and
the final `qa:pilot-live-readiness` manifest be filled.
