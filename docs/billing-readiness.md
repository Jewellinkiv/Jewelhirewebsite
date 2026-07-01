# Billing Readiness

JewelHire currently keeps billing safe for live users by exposing billing reads behind admin auth and using configured Stripe values only as credential-ready launch inputs.

## Current State

- Cloud Run has Stripe secret, webhook secret, publishable key, and store-owner payment link configured.
- `/api/admin/billing` is admin-auth gated.
- `/api/stripe/webhook` verifies Stripe signatures before acknowledging events.
- Verified Stripe subscription, checkout, invoice-paid, and invoice-payment-failed events reconcile billing rows when company metadata is present.
- Verified Stripe checkout sessions can also map back from Payment Link `client_reference_id` to the originating store/company.
- Every verified Stripe event is recorded in `admin_audit_entries` without storing secret values.
- Reconciled Stripe billing events return a gated Postmark notification status for the billing contact; notification delivery never blocks Stripe acknowledgement.
- Store-owner Settings exposes a protected Stripe billing checkout entry point backed by `STRIPE_STORE_OWNER_PAYMENT_LINK`.
- Checkout payload helpers support Stripe promotion codes through `allow_promotion_codes` or an explicit promotion code id.
- The store-owner billing route can prefill a safe promotion-code value for Stripe checkout.
- No live checkout session is created by QA.
- No live webhook is accepted by QA.
- Latest audit passed on 2026-07-01 with zero failures, zero blockers, and zero warnings. Artifact: `docs/qa-runs/billing-readiness-2026-07-01T11-23-13-218Z/`.

## Remaining Launch Work

- Add per-plan Stripe price IDs if JewelHire should create Checkout Sessions directly instead of sending store owners to the configured Payment Link.
- Add a controlled Stripe test-mode/live-mode smoke with a safe billing test account before enabling real customer billing automation.
- Update billing notification deep links if JewelHire adds a dedicated billing portal or Stripe customer portal route.

## Verification

```bash
npm run qa:billing
npm run qa:security:live
npm run qa:live
```

`npm run qa:billing` is side-effect safe. It does not create checkout sessions, charges, discounts, or webhooks.
