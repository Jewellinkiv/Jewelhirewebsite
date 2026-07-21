# Production Pilot Session Cookie Audit

This audit validates that a local authenticated JewelHire cookie is safe to use
for the remaining Diamond Exchange pilot smoke rows. It is read-only: it calls
`/api/me` only, does not create users, does not send email, does not write to
JewelHire, and does not write to JewelLink.

## Command

Run from the JewelHire repository after a real Diamond Exchange JewelLink SSO
session has been captured in an ignored local cookie file:

```bash
npm run qa:pilot-session-cookie -- \
  --base=https://jewelhire-azgiue5n5q-uc.a.run.app \
  --cookie-file=.qa_tmp/diamond-exchange-pilot-jewelhire-cookie.json \
  --expected-store-id=store-jl-58deb73ef9454405c4fe \
  --allowed-roles=store_owner,manager \
  --expected-auth-source=jewellink_sso
```

The cookie file may contain a raw cookie string, `{"cookie":"..."}`,
`{"jewelhire_session":"..."}`, or an array/object with a `cookies` list that
includes `{ "name": "jewelhire_session", "value": "..." }`.

## What It Proves

- A JewelHire session cookie is present and readable.
- `/api/me` returns an authenticated session.
- The session came from JewelLink SSO, unless the command explicitly uses
  `--expected-auth-source=any`.
- The session role is one of the roles allowed for the pilot smoke run.
- The active store and store list match the expected Diamond Exchange
  JewelHire store.

A passing report can be used as the preflight artifact before running the
authenticated SSO, public/fail-closed, hire handoff, and JewelCert smoke rows
with the same local cookie file.

## Current Pilot Scope

The current Diamond Exchange pilot store is
`store-jl-58deb73ef9454405c4fe`. The selected controlled application for hire
handoff and resume privacy is
`app-32dbfd01-3092-4190-9c15-cf43aa72ff46`.

If this audit fails because the session is `native`, points at another store,
or lacks the expected store, do not widen the native smoke account into the
pilot store. Capture a fresh JewelLink SSO Director or Manager session in an
allowed operator environment and rerun this audit.

## Secret Handling

Do not commit the local cookie file. Do not paste cookies, full email
addresses, passwords, database URLs, bearer tokens, customer data, or secret
values into evidence. The report records booleans and safe labels only.

## Local Verification

Fixture coverage runs without production access:

```bash
node --test scripts/production-pilot-session-cookie-audit.test.mjs
```
