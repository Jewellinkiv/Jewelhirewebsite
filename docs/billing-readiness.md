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

## Payment-gated retained-account workflow

1. A JewelHire super admin opens the retained company and chooses an active store
   owner.
2. The admin selects monthly or annual billing. JewelHire creates an opaque,
   expiring `standalone_checkout_requests` record and a server-side Stripe
   Checkout Session using the corresponding configured Price id.
3. JewelHire emails the unique Checkout Session URL to that owner. Retrying an
   ambiguous delivery reuses the request and Stripe idempotency key.
4. The claim-link control remains locked. Creating a request, sending an email,
   or returning from Stripe does not grant access.
5. A signature-verified `checkout.session.completed` webhook must match the
   exact server-created session id, opaque request, selected interval, USD
   currency, paid subscription mode, and the expected pre-discount subtotal.
6. One transaction activates the Stripe subscription and organization
   entitlement, reactivates the retained company, and marks the request used.
7. The admin refreshes payment status and sends the separate three-day,
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
verify there are no open or unsettled sessions that depend on it. This revision
intentionally rejects legacy direct company/store checkout references because
they do not carry the new durable session binding. If an old session is still
outstanding, let it expire or reconcile it under an explicitly reviewed
cutover procedure; do not weaken the new webhook checks.

## Deployment order

1. Back up production.
2. Create the two exact recurring Prices, add their Price ids, and retain the
   existing Stripe secret/webhook secret as secret-backed runtime environment
   variables. Deactivate the legacy Payment Link only after the outstanding
   session check above.
3. Deploy the candidate without initiating a live checkout. The new signup and
   checkout surfaces return a branded `503` until migration `0025` is ready;
   unrelated application surfaces remain usable.
4. After the hardened revision owns traffic and migration `0024` has committed,
   apply additive migration `0025_standalone_billing_recovery.sql` in the same
   guarded post-promotion migration job. Do not send a checkout until readiness
   confirms it.
5. Run the static/unit verification below.
6. In Stripe test mode, complete one monthly checkout and one annual checkout for
   a disposable retained-company fixture. Confirm the claim stays locked before
   the webhook and unlocks afterward.
7. Replay each webhook event id and confirm no duplicate entitlement,
   subscription, notification, or claim is created.
8. Only then repeat with the approved pilot company and live Stripe Prices.

## Verification

```bash
npm run test:standalone-billing
npm run test:standalone-billing-postgres
npm run test:account-claim-hardening
npm run test:jewellink-sso-hardening
npm run qa:billing -- --skip-live
npm exec tsc -- --noEmit
npm run lint
npm run build
```

These checks do not create Checkout Sessions or charges. The test-mode and live
smokes are explicit operator steps and must never use production customer data
as a disposable fixture.
