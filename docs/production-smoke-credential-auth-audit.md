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

`docs/qa-runs/smoke-credential-auth-2026-07-21T07-56-07-368Z/` passes. The
controlled store-owner credential signs in as a native `store_owner` session
with an active store, the controlled applicant credential signs in as an
`associate` session, and the obsolete native admin password path has been
replaced by a JewelLink SSO marker.

The store-owner smoke path now uses a dedicated JewelHire pilot smoke company
refreshed by `npm run ops:smoke-store-owner`; the operation creates or refreshes
one controlled store-owner user, rotates the password, grants a short `comped`
entitlement, and adds a new masked Secret Manager version without printing raw
credentials.

## Local Verification

Fixture coverage runs without production access:

```bash
node --test scripts/production-smoke-credential-auth-audit.test.mjs scripts/ops-smoke-store-owner-credential.test.mjs
```
