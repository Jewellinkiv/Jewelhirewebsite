# Auth Readiness

JewelHire supports two Google sign-in paths:

- Server-side Google OAuth: `/api/auth/google/start` and `/api/auth/google/callback`.
- Firebase Google Auth: client Firebase popup plus `/api/auth/firebase/session`.

Both paths resolve the Google email into the JewelHire Postgres user/store scope before setting the `jewelhire_session` cookie.

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
