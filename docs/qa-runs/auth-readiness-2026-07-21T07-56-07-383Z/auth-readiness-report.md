# Auth Readiness Audit

Base: https://app.jewelhire.com
Google Cloud project: jewelhire-prod-20260626
Created: 2026-07-21T07:56:11.298Z
Failures: 0

- PASS firebase verifier exists
- PASS firebase session route exists
- PASS login renders firebase button component
- PASS login renders standard email password form
- PASS password credential storage exists
- PASS password session route exists
- PASS password login routes configured admins to JewelLink MFA
- PASS root dashboard redirects admin sessions
- PASS setup: firebase api enabled
- PASS setup: identity toolkit api enabled
- PASS setup: gcp project is attached to firebase
- PASS setup: firebase web app exists
- PASS setup: firebase auth is initialized
- PASS setup: app domain authorized in firebase auth
- PASS setup: firebase google provider enabled
- PASS setup: cloud run env NEXT_PUBLIC_FIREBASE_API_KEY mounted
- PASS setup: cloud run env NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN mounted
- PASS setup: cloud run env NEXT_PUBLIC_FIREBASE_PROJECT_ID mounted
- PASS setup: cloud run env NEXT_PUBLIC_FIREBASE_APP_ID mounted
- PASS setup: cloud run env FIREBASE_PROJECT_ID mounted
- PASS live login loads
- PASS live login has Google sign-in
- PASS live login has standard email password form
- PASS live firebase login visible when expected
- PASS firebase invalid token rejected
- PASS password invalid credentials rejected on public app host

Firebase/GCP setup values are reported as present/missing only; no secret or API key values are written.