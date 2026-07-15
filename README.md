# JewelHire

Production jewelry hiring platform with public store careers pages, applicant accounts,
JewelCert/GemMatch screening, interviews, training, team management, billing, and an internal admin portal.

## Stack
- Next.js 16 (App Router) · React 18 · TypeScript
- Tailwind CSS (design tokens in `tailwind.config.ts`)
- PostgreSQL (`pg`) with a local in-memory development adapter
- Google/Firebase and email/password authentication
- Cloud Run, Stripe, Postmark, Cloudinary, Google Calendar, and Microsoft Calendar integrations

## Run
```bash
npm ci
npm run dev
```
Open http://localhost:3000

## Design tokens (from the v2 direction doc)
- Primary `#4681F4` · hover `#3576c8` · accent `#4a90e2`
- Page `#f4f7fb` · panel `#fff` · border `#c2cfe0`
- Text `#0f172a` / `#243447` · muted `#64748b` · row hover `#edf5ff`
- GemMatch profiles — Visionary `#4681F4`, Connector `#7C6CF0`, Foundation `#1f9e75`, Determined `#e2683c`

Copy `.env.example` to `.env.local` for local configuration. The checked-in defaults use the
local adapter and mock auth. Never deploy those defaults to a public environment.

## Validation

```bash
npm run lint
npm run build
npm audit --audit-level=moderate
npm run qa:notifications
npm run qa:billing
npm run test:standalone-billing
npm run test:standalone-billing-postgres
npm run qa:public-careers
npm run qa:jewellink-sso
npm run qa:browser
```

Database status and readiness checks are read-only:

```bash
npm run db:migrate:status
npm run db:readiness
```

## Deployment

Production runs on Google Cloud Run at `https://app.jewelhire.com`. Pull requests and pushes to
`main` run validation. Production deployment is manual through the `Validate and deploy to Cloud Run`
GitHub Actions workflow and requires the `deploy_production` confirmation.

The production workflow creates a no-traffic candidate revision, runs the guarded migration command
from that exact image, smokes the candidate, and only then moves traffic. It refuses to continue
without a confirmed database backup, required JewelLink configuration, and an explicit live-email
posture. Never deploy application code that depends on an unapplied migration outside this sequence.

## Discovery docs
- `docs/aptitude-tests.md` has the full legacy aptitude inventory: 3 tests, 82 questions, targets, answers, and point values.
- `docs/course-inventory.md` has the first-pass legacy course inventory: 20 published courses, 4 unpublished courses, course editor structure, and observed media.
- `docs/assessment-model.md` translates the legacy test structure into v2 assessment records and review flows.
- `docs/frontend-design-plan.md` is the working handoff brief for Claude-led frontend design.

## Safety notes

- Production must use PostgreSQL, real auth, a strong secret, and no session override.
- Secrets belong in Secret Manager or `.env.local`, never source control.
- Keep Postmark disabled/dry-run until live-send approval and preference enforcement are verified.
- Stripe webhook events are signature-verified and billing notifications are deduplicated by event id. Standalone access is activated only by a paid, exact-price Checkout Session bound to an opaque server-side request.
- Public applications and signup require acceptance of the versioned Privacy Policy and Terms.
