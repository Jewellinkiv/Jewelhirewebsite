# Database Security Notes

Date: 2026-06-24

## Current Decision

The JewelHire v2 database credential must live only in runtime secrets:

- Local development: `.env.local`
- Deployed environments: hosting provider or infrastructure secret store
- Source-controlled files: placeholders only

Do not commit a real `DATABASE_URL`, password, `.env`, `.env.local`, certificates, or downloaded
database credentials.

## Credential Exposure

The initial PlanetScale Postgres credential was shared in chat. Treat that password as exposed before
production use:

1. Use it only for short-lived local verification if needed.
2. Rotate the password before production or shared staging.
3. Replace local/deployed `DATABASE_URL` values with the rotated credential.

## Local Wiring

- `.env.example` documents the expected variables without secrets.
- `.gitignore` excludes real env files and certificate material.
- `lib/server/postgres.ts` creates a `pg` connection pool from `DATABASE_URL` or `POSTGRES_URL`.
  The default `POSTGRES_POOL_MAX` is `1` for staging/dev safety against low connection limits; raise
  it only after production capacity is known.
- `GET /api/admin/database/health` checks connectivity and returns only redacted database metadata.
- `scripts/run-migrations.mjs` loads `.env.local`, prints redacted target metadata, and refuses to
  apply migrations unless `APPLY_DATABASE_MIGRATIONS=1` is explicitly set.
- `scripts/run-seeds.mjs` uses the same env-only and redacted-output pattern, creates `seed_runs`,
  and refuses to apply demo seeds unless `APPLY_DATABASE_SEEDS=1` is explicitly set.
- `GET /api/admin/database/readiness` and `npm run db:readiness` perform read-only schema/seed
  checks with redacted target metadata and no credential output.
- `x-jewelhire-session` is a staging/API smoke override only. It is enabled in `next dev`; in
  production-mode staging it requires `JEWELHIRE_ENABLE_SESSION_OVERRIDE=1`. Do not enable it for
  production traffic.

## Package Audit

`pg` was added for Postgres connectivity. The security audit also found Next.js advisories in the
existing app stack:

- Patched within Next 14 as far as the current major allows: `next@14.2.35`.
- Remaining audit findings require a major Next upgrade according to `npm audit`.
- Do not force-upgrade Next during backend wiring; plan a separate framework upgrade and regression
  QA pass before production.
