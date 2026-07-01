# Provider Readiness Handoff

Production app: `https://app.jewelhire.com`
Cloud Run project: `jewelhire-prod-20260626`
Updated: 2026-07-01

This checklist is for dashboard verification only. Do not enable live email sends, create live checkout sessions, create charges, or replay real webhooks unless the product owner explicitly approves the action.

## Safe Automated Evidence

Run:

```bash
npm run qa:postmark
npm run qa:billing
npm run qa:provider-handoff
```

Latest safe evidence:

- Postmark safety: `docs/qa-runs/postmark-safety-2026-07-01T04-29-16-192Z/`
- Billing readiness: `docs/qa-runs/billing-readiness-2026-07-01T06-35-08-144Z/`
- Provider handoff audit: `docs/qa-runs/provider-handoff-2026-07-01T06-53-32-362Z/`

Current local `gcloud` credentials need interactive reauthentication before the Postmark safety audit can refresh Cloud Run email-gate metadata. The static adapter/doc checks pass before that Cloud Run lookup.

## Postmark Dashboard Checklist

Verify in Postmark without sending live customer email:

- Sender signature or domain is verified for the configured from address.
- Message stream matches the configured JewelHire stream.
- Server token exists and is not exposed in docs, screenshots, or test evidence.
- Suppression list has no expected QA recipient suppressed.
- Recent activity/logs show no unexpected live sends from the QA window.
- Bounce, spam complaint, and unsubscribe handling are understood before live sends are enabled.
- `EMAIL_NOTIFICATIONS_ENABLED` stays disabled, or `POSTMARK_DRY_RUN` stays enabled, until a controlled live-send test is approved.

## Stripe Dashboard Checklist

Verify in Stripe without making live charges:

- Store-owner payment link points to the intended recurring plan.
- Price amount, billing interval, currency, and product name match the launch offer.
- Promotion/discount settings match launch policy.
- Webhook endpoint targets the deployed JewelHire webhook URL.
- Webhook signing secret is configured in Secret Manager, not exposed in source or docs.
- Required events include checkout, subscription, and invoice lifecycle events.
- Recent webhook deliveries show no unexpected failures or unreviewed live events.
- Customer portal or billing-management route expectations are clear before customer traffic.

## Manual Evidence To Capture

For each dashboard, capture only non-secret evidence:

- Provider name and environment/mode.
- Timestamp and reviewer.
- Pass/fail status for each checklist item.
- Redacted screenshot if useful.
- Any blocker, owner, and resolution date.

Never capture API tokens, webhook secrets, card details, customer PII, or full provider event payloads.
