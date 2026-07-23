# Production Pilot Readiness Audit

Created: 2026-07-22T21:27:38.166Z
Result: PASS
Values printed: false
Fixture mode: false

## Services

- jewelhire: jewelhire-prod-20260626/us-central1/jewelhire
- jewellink: academy-460316/us-central1/jewellink-dev

## Checks

- PASS gcloud CLI is available
- PASS JewelHire Cloud Run service config readable
- PASS JewelHire Cloud Run reports a ready revision
- PASS JewelHire Cloud Run traffic target is explicit
- PASS JewelLink Cloud Run service config readable
- PASS JewelLink Cloud Run reports a ready revision
- PASS JewelLink Cloud Run traffic target is explicit
- PASS JewelHire env DATABASE_URL mounted
- PASS JewelHire env AUTH_SECRET mounted
- PASS JewelHire env JEWELLINK_URL mounted
- PASS JewelHire env JEWELLINK_SSO_SHARED_SECRET mounted
- PASS JewelHire env JEWELLINK_INTEGRATION_SHARED_SECRET mounted
- PASS JewelHire env JEWELHIRE_TEAM_INVITES_ENABLED mounted
- PASS JewelHire env JEWELHIRE_TRUSTED_PROXY_HOPS mounted
- PASS JewelHire env JEWELHIRE_REQUIRE_AUTH mounted
- PASS JewelHire env AUTH_MODE mounted
- PASS JewelHire env JEWELHIRE_STORAGE mounted
- PASS JewelHire env JEWELHIRE_ENABLE_SESSION_OVERRIDE mounted
- PASS JewelHire env EMAIL_NOTIFICATIONS_ENABLED mounted
- PASS JewelHire env POSTMARK_DRY_RUN mounted
- PASS JewelHire env POSTMARK_SERVER_TOKEN mounted
- PASS JewelHire env POSTMARK_FROM_EMAIL mounted
- PASS JewelHire env POSTMARK_MESSAGE_STREAM mounted
- PASS JewelHire env STRIPE_SECRET_KEY mounted
- PASS JewelHire env STRIPE_WEBHOOK_SECRET mounted
- PASS JewelHire env STRIPE_STORE_OWNER_MONTHLY_PRICE_ID mounted
- PASS JewelHire env STRIPE_STORE_OWNER_ANNUAL_PRICE_ID mounted
- PASS JewelHire env DATABASE_URL is secret-backed
- PASS JewelHire env AUTH_SECRET is secret-backed
- PASS JewelHire env JEWELLINK_SSO_SHARED_SECRET is secret-backed
- PASS JewelHire env JEWELLINK_INTEGRATION_SHARED_SECRET is secret-backed
- PASS JewelHire env POSTMARK_SERVER_TOKEN is secret-backed
- PASS JewelHire env STRIPE_SECRET_KEY is secret-backed
- PASS JewelHire env STRIPE_WEBHOOK_SECRET is secret-backed
- PASS JewelHire platform admin allowlist env mounted
- PASS JewelHire platform admin allowlist is secret-backed
- PASS JewelHire points to production JewelLink
- PASS JewelHire production auth is required
- PASS JewelHire auth mode is Google
- PASS JewelHire storage is Postgres
- PASS JewelHire test session override is disabled
- PASS JewelHire team invites are disabled for pilot
- PASS JewelHire trusted proxy hops is explicit and bounded
- PASS JewelHire email posture is explicit
- PASS JewelHire live email has Postmark dry-run disabled
- PASS JewelHire live email has secret-backed Postmark token
- PASS JewelLink env JEWELHIRE_URL mounted
- PASS JewelLink env JEWELHIRE_SSO_SHARED_SECRET mounted
- PASS JewelLink env JEWELHIRE_INTEGRATION_SHARED_SECRET mounted
- PASS JewelLink env JEWELHIRE_INTEGRATION_ENABLED mounted
- PASS JewelLink env JEWELHIRE_ROLLOUT_MODE mounted
- PASS JewelLink env JEWELHIRE_HIRE_EMAIL_MODE mounted
- PASS JewelLink env JEWELHIRE_SSO_SHARED_SECRET is secret-backed
- PASS JewelLink env JEWELHIRE_INTEGRATION_SHARED_SECRET is secret-backed
- PASS JewelLink points to production JewelHire
- PASS JewelLink integration is enabled for pilot
- PASS JewelLink rollout mode matches pilot plan
- PASS JewelLink pilot company IDs are configured
- PASS JewelLink hire email mode is explicit
- PASS SSO secrets are secret-backed on both services
- PASS SSO secret values match across services
- PASS SSO secret values are high entropy
- PASS integration handoff secrets are secret-backed on both services
- PASS integration handoff secret values match across services
- PASS integration handoff secret values are high entropy

## Mounted Env Names

### jewelhire

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
- NEXT_PUBLIC_APP_URL: literal
- NEXT_PUBLIC_FIREBASE_API_KEY: literal
- NEXT_PUBLIC_FIREBASE_APP_ID: literal
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: literal
- NEXT_PUBLIC_FIREBASE_PROJECT_ID: literal
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

### jewellink

- AZURE_CLIENT_ID: secret
- AZURE_CLIENT_SECRET: secret
- AZURE_TENANT_ID: secret
- BUBBLE_API_TOKEN: secret
- BUBBLE_API_URL: secret
- CARDPOINTE_PRODUCTION_TERMINAL_API_BASE_URL: secret
- CARDPOINTE_PRODUCTION_TERMINAL_AUTH_PATH: secret
- CARDPOINTE_PRODUCTION_TERMINAL_CONNECT_PATH: secret
- CARDPOINTE_SANDBOX_TERMINAL_API_BASE_URL: secret
- CARDPOINTE_SANDBOX_TERMINAL_AUTH_PATH: secret
- CARDPOINTE_SANDBOX_TERMINAL_CONNECT_PATH: secret
- CLOUDINARY_API_KEY: secret
- CLOUDINARY_API_SECRET: secret
- CLOUDINARY_CLOUD_NAME: secret
- CLOUDINARY_URL: secret
- CRON_SECRET: secret
- CSRF_SECRET: secret
- DATABASE_URL: secret
- EDT_AUTO_LINK_SHARED_SECRET: literal
- EDT_MEDIA_API_KEY: secret
- ELEVENLABS_API_KEY: secret
- FORM_LINK_SECRET: secret
- GA_MEASUREMENT_ID: literal
- GEMINI_API_KEY: secret
- GOOGLE_CLIENT_ID: secret
- GOOGLE_CLIENT_SECRET: secret
- HEYGEN_API_KEY: secret
- JEWELHIRE_HIRE_EMAIL_ALLOWLIST: unknown
- JEWELHIRE_HIRE_EMAIL_MODE: literal
- JEWELHIRE_INTEGRATION_ENABLED: literal
- JEWELHIRE_INTEGRATION_SHARED_SECRET: secret
- JEWELHIRE_PILOT_COMPANY_IDS: literal
- JEWELHIRE_ROLLOUT_MODE: literal
- JEWELHIRE_SSO_SHARED_SECRET: secret
- JEWELHIRE_URL: literal
- META_APP_ID: secret
- META_APP_SECRET: secret
- META_CONFIG_ID: secret
- META_OAUTH_REDIRECT_URI: secret
- META_WEBHOOK_VERIFY_TOKEN: secret
- MIDDLEWARE_DB_HOST: secret
- MIDDLEWARE_DB_NAME: secret
- MIDDLEWARE_DB_PASSWORD: secret
- MIDDLEWARE_DB_USER: secret
- MONDAY_API_KEY: secret
- MONDAY_BOARD_ID: secret
- MONDAY_GROUP_ID: secret
- NEXT_PUBLIC_STRIPE_CONNECT_PUBLISHABLE_KEY: secret
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: secret
- NEXTAUTH_SECRET: secret
- NEXTAUTH_URL: secret
- OAUTH_REDIRECT_BASE: secret
- OPENAI_API_KEY: secret
- OPENAI_IMAGE_MODEL: secret
- OPERATIONAL_NOTIFICATION_ENVIRONMENT: literal
- OPERATIONAL_NOTIFICATIONS_ENABLED: literal
- PODIUM_CLIENT_ID: secret
- PODIUM_CLIENT_SECRET: secret
- PODIUM_REDIRECT_URI: secret
- POSTMARK_FROM_EMAIL: secret
- POSTMARK_SERVER_TOKEN: secret
- SCORM_CLOUD_API_BASE: secret
- SCORM_CLOUD_APP_ID: secret
- SCORM_CLOUD_SECRET_KEY: secret
- STRIPE_CONNECT_SECRET_KEY: secret
- STRIPE_CONNECT_WEBHOOK_SECRET: secret
- STRIPE_SECRET_KEY: secret
- STRIPE_WEBHOOK_SECRET: secret
- TOKEN_ENCRYPTION_KEY: secret
- TWILIO_ACCOUNT_SID: secret
- TWILIO_AUTH_TOKEN: secret
- TWILIO_LEGACY_SMS_WEBHOOK_URL: literal
- TWILIO_LEGACY_STATUS_WEBHOOK_URL: literal
- TWILIO_PUBLIC_WEBHOOK_BASE_URL: literal
- TWILIO_VERIFY_SERVICE_SID: secret
- TWO_FACTOR_SIGNING_KEY: secret
- WEB_PUSH_VAPID_PRIVATE_KEY: secret
- WEB_PUSH_VAPID_PUBLIC_KEY: secret

## Traffic Summary

### jewelhire

- Latest ready revision: jewelhire-00111-dup
- jewelhire-00111-dup: 100% tag=candidate-29518763228

### jewellink

- Latest ready revision: jewellink-dev-01179-f7d
- jewellink-dev-01179-f7d: 100%

Secret values, secret hashes, literal env values, API keys, tokens, database URLs, and passwords are never written to this report.