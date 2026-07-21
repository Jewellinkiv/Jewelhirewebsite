# Production Smoke Credential Auth Audit

This audit validates that the controlled JewelHire smoke credentials in Secret
Manager can actually sign in to the live app with the expected roles. It is a
credential cleanup gate only: it does not send email, write to JewelHire, write
to JewelLink, create users, or change Secret Manager.

## Command

Run from the JewelHire repository:

```bash
npm run qa:smoke-credential-auth
```

The audit reads `jewelhire-smoke-test-credentials` from the JewelHire Google
Cloud project unless `--credentials-file=<path>` is supplied for fixtures. It
attempts password login for the controlled `store_owner` and `applicant`
credentials, then calls `/api/me` with the issued session cookie.

## What It Proves

- The controlled store-owner smoke credential signs in as a native
  `store_owner` session with an active store.
- The controlled applicant smoke credential signs in as a native `associate`
  applicant session.
- No obsolete native password credential is advertised as a platform-admin
  smoke path. Platform-admin pilot smoke must use the allowlisted JewelLink SSO
  admin persona, not native password login.

## Secret Handling

Reports include only role names, booleans, non-secret status fields, and whether
the cleanup request packet is needed. They do not write full email addresses,
passwords, session cookies, bearer tokens, database URLs, customer data, or
secret values.

## Latest Production Result

`docs/qa-runs/smoke-credential-auth-2026-07-21T01-30-00-783Z/` confirms the
controlled applicant credential signs in as an `associate` session. It fails
because the controlled store-owner credential does not produce a live session,
and the smoke secret still advertises an obsolete native admin password
credential. The run generated
`docs/qa-runs/smoke-credential-auth-2026-07-21T01-30-00-783Z/smoke-credential-auth-request.md`
with the required cleanup.

## Local Verification

Fixture coverage runs without production access:

```bash
node --test scripts/production-smoke-credential-auth-audit.test.mjs
```
