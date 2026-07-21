# Config Exposure Audit

Base: https://app.jewelhire.com
Google Cloud project: jewelhire-prod-20260626
Cloud Run service: jewelhire
Created: 2026-07-21T09:30:44.287Z
Failures: 0

## Checks

- PASS repo ignores real env files
- PASS repo keeps env example only
- PASS Cloud Run service config readable
- PASS Cloud Run env DATABASE_URL mounted
- PASS Cloud Run env AUTH_SECRET mounted
- PASS Cloud Run env JEWELLINK_URL mounted
- PASS Cloud Run env JEWELLINK_SSO_SHARED_SECRET mounted
- PASS Cloud Run env JEWELLINK_INTEGRATION_SHARED_SECRET mounted
- PASS Cloud Run env JEWELHIRE_TEAM_INVITES_ENABLED mounted
- PASS Cloud Run env JEWELHIRE_TRUSTED_PROXY_HOPS mounted
- PASS Cloud Run env JEWELHIRE_REQUIRE_AUTH mounted
- PASS Cloud Run env AUTH_MODE mounted
- PASS Cloud Run env JEWELHIRE_STORAGE mounted
- PASS Cloud Run env JEWELHIRE_ENABLE_SESSION_OVERRIDE mounted
- PASS Cloud Run env EMAIL_NOTIFICATIONS_ENABLED mounted
- PASS Cloud Run env POSTMARK_DRY_RUN mounted
- PASS Cloud Run env POSTMARK_SERVER_TOKEN mounted
- PASS Cloud Run env POSTMARK_FROM_EMAIL mounted
- PASS Cloud Run env POSTMARK_MESSAGE_STREAM mounted
- PASS Cloud Run env STRIPE_SECRET_KEY mounted
- PASS Cloud Run env STRIPE_WEBHOOK_SECRET mounted
- PASS Cloud Run env STRIPE_STORE_OWNER_MONTHLY_PRICE_ID mounted
- PASS Cloud Run env STRIPE_STORE_OWNER_ANNUAL_PRICE_ID mounted
- PASS Cloud Run env STRIPE_STORE_OWNER_PAYMENT_LINK mounted
- PASS Cloud Run env NEXT_PUBLIC_FIREBASE_API_KEY mounted
- PASS Cloud Run env NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN mounted
- PASS Cloud Run env NEXT_PUBLIC_FIREBASE_PROJECT_ID mounted
- PASS Cloud Run env NEXT_PUBLIC_FIREBASE_APP_ID mounted
- PASS Cloud Run env FIREBASE_PROJECT_ID mounted
- PASS platform admin allowlist env mounted
- PASS platform admin allowlist is secret-backed
- PASS private launch env DATABASE_URL is secret-backed
- PASS private launch env AUTH_SECRET is secret-backed
- PASS private launch env GOOGLE_CLIENT_SECRET is secret-backed
- PASS private launch env JEWELLINK_SSO_SHARED_SECRET is secret-backed
- PASS private launch env JEWELLINK_INTEGRATION_SHARED_SECRET is secret-backed
- PASS private launch env POSTMARK_SERVER_TOKEN is secret-backed
- PASS private launch env STRIPE_SECRET_KEY is secret-backed
- PASS private launch env STRIPE_WEBHOOK_SECRET is secret-backed
- PASS database env mounted
- PASS private runtime env vars are secret-backed when mounted
- PASS JewelLink URL is HTTPS
- PASS production auth is required
- PASS production auth mode is Google
- PASS production storage is Postgres
- PASS test session override is disabled
- PASS Diamond Exchange team invites are disabled
- PASS trusted proxy hops is explicit and bounded
- PASS Stripe recurring price ids are distinct configured ids
- PASS legacy Stripe payment link is configured for drain checks
- PASS verified applicant signup email is enabled
- PASS Postmark dry-run is disabled for launch
- PASS live email sends are explicitly acknowledged
- PASS Postmark token is secret-backed when live email config exists
- PASS public HTML does not expose private env names
- PASS public pages do not return server errors during exposure check

## Mounted Env Names

- AUTH_MODE: literal
- AUTH_SECRET: secret
- CLOUDINARY_URL: secret
- DATABASE_URL: secret
- EMAIL_NOTIFICATIONS_ENABLED: literal
- FIREBASE_PROJECT_ID: literal
- GOOGLE_CLIENT_ID: secret
- GOOGLE_CLIENT_SECRET: secret
- JEWELHIRE_ADMIN_EMAILS: secret
- JEWELHIRE_ENABLE_SESSION_OVERRIDE: literal
- JEWELHIRE_JEWELLINK_DIRECTOR_ROLE: literal
- JEWELHIRE_JEWELLINK_MANAGER_ALL_LOCATIONS: literal
- JEWELHIRE_REQUIRE_AUTH: literal
- JEWELHIRE_STORAGE: literal
- JEWELHIRE_TEAM_INVITES_ENABLED: literal
- JEWELHIRE_TRUSTED_PROXY_HOPS: literal
- JEWELLINK_INTEGRATION_SHARED_SECRET: secret
- JEWELLINK_SSO_SHARED_SECRET: secret
- JEWELLINK_URL: literal
- NEXT_PUBLIC_APP_URL: literal (public client config)
- NEXT_PUBLIC_FIREBASE_API_KEY: literal (public client config)
- NEXT_PUBLIC_FIREBASE_APP_ID: literal (public client config)
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: literal (public client config)
- NEXT_PUBLIC_FIREBASE_PROJECT_ID: literal (public client config)
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: literal
- OUTLOOK_CLIENT_ID: secret
- OUTLOOK_CLIENT_SECRET: secret
- OUTLOOK_TENANT_ID: secret
- POSTMARK_DRY_RUN: literal
- POSTMARK_FROM_EMAIL: literal
- POSTMARK_MESSAGE_STREAM: literal
- POSTMARK_SERVER_TOKEN: secret
- QA_RESET_TOKEN: secret
- STRIPE_SECRET_KEY: secret
- STRIPE_STORE_OWNER_ANNUAL_PRICE_ID: literal
- STRIPE_STORE_OWNER_MONTHLY_PRICE_ID: literal
- STRIPE_STORE_OWNER_PAYMENT_LINK: literal
- STRIPE_WEBHOOK_SECRET: secret

Secret values, literal values, API keys, tokens, database URLs, and passwords are never written to this report.