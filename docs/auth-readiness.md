# Auth Readiness

JewelHire supports two Google sign-in paths:

- Server-side Google OAuth: `/api/auth/google/start` and `/api/auth/google/callback`.
- Firebase Google Auth: client Firebase popup plus `/api/auth/firebase/session`.
- Standard email/password auth: `/api/auth/password/session`, backed by `password_credentials`.

Both paths resolve the Google email into the JewelHire Postgres user/store scope before setting the `jewelhire_session` cookie.
Email/password auth resolves the same active JewelHire user and sets the same `jewelhire_session` cookie after verifying a salted scrypt password hash.

## Standard Email/Password Login

`/login` must render email and password fields before Google fallback.

Setup:

```bash
npm run db:migrate:apply
DATABASE_URL=<postgres> JEWELHIRE_OPERATOR_PASSWORD=<temporary-12+-character-password> npm run ops:password-credential -- --email owner@example.com
```

Rules:

- Password hashes live in `password_credentials`, not in `users`.
- Temporary passwords come from `JEWELHIRE_OPERATOR_PASSWORD`; do not pass them as command-line arguments.
- Password login uses the same active user/store authorization lookup as Google and Firebase login.
- Hosted `app.jewelhire.com/login` is not launch-ready unless it includes `Sign in with email`.
- Invalid password redirects must stay on the public `app.jewelhire.com` host, not Cloud Run's internal request host.

Current production state as of 2026-07-01:

- Cloud Run revision `jewelhire-00040-x7v` is serving 100% traffic after database password rotation.
- `0003_password_credentials.sql` is applied.
- `npm run qa:auth -- --expect-firebase` passes against `https://app.jewelhire.com` with Cloud Run and Firebase setup checks. Latest artifact: `docs/qa-runs/auth-readiness-2026-07-01T11-42-53-280Z/`.
- Smoke credentials for admin, store owner, manager, and applicant are stored in Secret Manager secret `jewelhire-smoke-test-credentials`.

## Firebase Required Config

Set these public web app values on Cloud Run to show the Firebase Google button:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

Set this server-side value when it differs from the public project id:

```bash
FIREBASE_PROJECT_ID
```

The Firebase session endpoint verifies ID tokens against Google's Firebase secure token certificates, checks issuer/audience/expiry/email verification, and rejects unknown JewelHire users.

## Current Live Safety

`AUTH_MODE=google` and `JEWELHIRE_REQUIRE_AUTH=1` keep private routes protected. The existing Google OAuth path remains active while Firebase credentials are added.

## Verification

```bash
npm run build
npm audit --audit-level=moderate
npm run qa:auth
npm run qa:auth -- --expect-firebase
npm run qa:security:live
npm run qa:live
```

The auth and live security audits include an invalid-token probe for `/api/auth/firebase/session`.

`npm run qa:auth -- --expect-firebase` also verifies the Firebase setup behind the login flow:

- Firebase API is enabled on `jewelhire-prod-20260626`.
- Identity Toolkit API is enabled.
- The Google Cloud project is attached to Firebase.
- A Firebase web app exists.
- Firebase Auth is initialized.
- `app.jewelhire.com` is an authorized Firebase Auth domain.
- Google is enabled as a Firebase sign-in provider.
- Cloud Run has the Firebase web config env vars mounted.

The audit only reports setup values as present, missing, enabled, or disabled. It does not print Firebase API keys, OAuth secrets, or token values.
