# Billing Readiness

JewelHire offers one organization subscription for standalone store-owner access:

- `$149/month`
- `$1,299/year` (a `$489` annual savings versus monthly billing)

JewelLink-included access remains free while the upstream membership is valid.
When that membership ends, JewelHire retains the company, stores, jobs,
applications, analytics, users, and assessments. Payment and account recovery do
not create a replacement tenant.

Both the store and super-admin checkout endpoints reject paid standalone
checkout while a current `jewellink_included` entitlement is active. The paid
recovery path becomes available only after that included access is no longer
current.

The super-admin checkout action verifies the linked company directly against
JewelLink's current database through the bearer-authenticated
`/api/integrations/jewelhire/company-access` endpoint before it creates or
emails any Stripe session. An active response keeps paid checkout blocked. A
paused or inactive response idempotently pauses only the
`jewellink_included` entitlement and the local company shell; stores, jobs,
applications, analytics, users, and assessments remain intact. A timeout,
unknown external company, mismatched identity, or malformed response fails
closed with no checkout and no email.

## Payment-gated retained-account workflow

1. A JewelHire super admin opens the retained company and chooses an active store
   owner.
2. JewelHire verifies the company's current JewelLink membership server to
   server and records any included-access transition in the admin audit log.
3. The admin selects monthly or annual billing. JewelHire creates an opaque,
   expiring `standalone_checkout_requests` record and a server-side Stripe
   Checkout Session using the corresponding configured Price id.
4. JewelHire emails the unique Checkout Session URL to that owner. Retrying an
   ambiguous delivery reuses the request and Stripe idempotency key.
5. The claim-link control remains locked. Creating a request, sending an email,
   or returning from Stripe does not grant access.
6. A signature-verified `checkout.session.completed` webhook must match the
   exact server-created session id, opaque request, selected interval, USD
   currency, paid subscription mode, and the expected pre-discount subtotal.
7. One transaction activates the Stripe subscription and organization
   entitlement, reactivates the retained company, and marks the request used.
8. The admin refreshes payment status and sends the separate three-day,
   single-use account claim. Issuance and redemption both re-check the active
   non-JewelLink entitlement.

Subscription update/deletion webhooks only reconcile a provider subscription
already bound by the paid Checkout Session. An arbitrary active Stripe
subscription event cannot create JewelHire access.

The super-admin billing dashboard reports MRR from current Stripe-backed
organization entitlements (annual revenue normalized across 12 months). Active
free JewelLink-included, comped, and contract access is not counted as paid MRR.

## Required Stripe configuration

Create two recurring USD Prices in the same Stripe account used by
`STRIPE_SECRET_KEY`:

| Environment variable | Stripe recurrence | Exact unit amount |
| --- | --- | ---: |
| `STRIPE_STORE_OWNER_MONTHLY_PRICE_ID` | monthly | `$149.00` |
| `STRIPE_STORE_OWNER_ANNUAL_PRICE_ID` | yearly | `$1,299.00` |

Configure `STRIPE_WEBHOOK_SECRET` for the production endpoint and subscribe it
to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

`STRIPE_ALLOW_PROMOTION_CODES=1` lets the customer enter a Stripe promotion code
inside Checkout. Discounts do not change the expected pre-discount subtotal
used to identify the selected offer.

Checkout Sessions currently request card payments so `checkout.session.completed`
has a synchronous paid outcome. Do not enable asynchronous payment methods
without adding and testing their success/failure webhook lifecycle first.

The legacy shared `STRIPE_STORE_OWNER_PAYMENT_LINK` is not used for this flow.
Server-created Checkout Sessions are intentionally one-time and can be bound to
the durable recovery request.

Before enabling this revision, deactivate the legacy shared Payment Link and
verify there are no open or unsettled sessions or current subscriptions that
depend on it. The production workflow enforces that check with GET-only Stripe
API calls and refuses to move traffic while the link is active or any legacy
state still needs migration. This revision intentionally rejects legacy direct
company/store checkout references because they do not carry the new durable
session binding. If an old session is still outstanding, let it expire or
reconcile it under an explicitly reviewed cutover procedure; do not weaken the
new webhook checks.

The read-only provider gate also retrieves both configured Prices and requires
live mode, USD, exact amounts, one-month/one-year recurrence, active state, and
one shared product. It requires exactly one enabled live webhook at
`https://app.jewelhire.com/api/stripe/webhook` with every billing lifecycle
event above. Stripe never returns an endpoint signing secret through its API,
so the manual production dispatch additionally requires confirmation of one
recent signature-verified delivery using the current secret. The job only uses
Stripe `GET` requests; it cannot create a Checkout Session, customer, charge,
subscription, or event.

## Deployment order

1. Back up production.
2. Create the two exact recurring Prices, add their Price ids, and retain the
   Stripe API and webhook secrets as Secret Manager-backed runtime variables.
   Confirm the exact production webhook has every required event and one recent
   signature-verified delivery. Inventory the legacy Payment Link, allow open
   sessions to expire, migrate any current subscription, and then deactivate
   the link.
3. Dispatch the manual production workflow without initiating a live checkout.
   It creates an immutable no-traffic candidate first.
4. Before any database change, the GET-only Stripe gate verifies the exact
   offers, endpoint events, deactivated legacy link, and zero unresolved legacy
   sessions/subscriptions.
5. The migration job requires the already-applied
   `0024_jewelcert_claim_token_version_fence` ledger row and checksum, then
   applies only the additive `0025_standalone_billing_recovery` schema while the
   prior revision still owns all traffic. It refuses to cross the 0024 contract
   boundary in this job.
6. Before traffic moves, database readiness verifies every required 0025
   column, default, check/foreign-key constraint, and valid partial/unique index,
   including pending-signup serialization and out-of-order subscription state.
7. Only after those gates and the no-traffic candidate smoke pass may the
   workflow move traffic. Because 0025 is additive, the previous revision stays
   a valid traffic rollback target.
8. Before production dispatch, in Stripe test mode complete one monthly checkout
   and one annual checkout for a disposable retained-company fixture. Confirm
   the claim stays locked before the webhook and unlocks afterward.
9. Replay each webhook event id and confirm no duplicate entitlement,
   subscription, notification, or claim is created.
10. Only then repeat with the approved pilot company and live Stripe Prices.

## Verification

```bash
npm run test:standalone-billing
npm run test:standalone-billing-postgres
npm run test:deploy-migration-safety
npm run test:account-claim-hardening
npm run test:jewellink-sso-hardening
npm run qa:billing -- --skip-live
npm exec tsc -- --noEmit
npm run lint
npm run build
```

These checks and the production provider gate do not create Checkout Sessions,
charges, subscriptions, or webhook events. The test-mode and live smokes are
explicit operator steps and must never use production customer data as a
disposable fixture.
