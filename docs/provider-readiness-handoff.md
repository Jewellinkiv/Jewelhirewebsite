# Provider Readiness Handoff

Production app: `https://app.jewelhire.com`
Cloud Run project: `jewelhire-prod-20260626`
Updated: 2026-07-15

This checklist is for dashboard verification only. Do not enable live email sends, create live checkout sessions, create charges, or replay real webhooks unless the product owner explicitly approves the action.

## Safe Automated Evidence

Run:

```bash
npm run qa:postmark
npm run qa:billing
npm run qa:provider-handoff
```

Latest safe evidence:

- Postmark safety: `docs/qa-runs/postmark-safety-2026-07-01T11-42-53-275Z/`
- Billing readiness: `docs/qa-runs/billing-readiness-2026-07-01T11-23-13-218Z/`
- Provider handoff audit: `docs/qa-runs/provider-handoff-2026-07-01T11-44-43-768Z/`

Local `gcloud` access was refreshed on 2026-07-01, and the Postmark safety audit can read Cloud Run email-gate metadata. If access expires again, use the reauth runbook before rerunning cloud-backed checks.

Cloud reauth steps and post-reauth verification commands are documented in `docs/cloud-reauth-runbook.md`.

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

- Monthly Stripe Price is recurring USD `$149.00` and its id is configured as `STRIPE_STORE_OWNER_MONTHLY_PRICE_ID`.
- Annual Stripe Price is recurring USD `$1,299.00` and its id is configured as `STRIPE_STORE_OWNER_ANNUAL_PRICE_ID`.
- Both Prices belong to the intended JewelHire organization-access product; JewelHire creates one-time Checkout Sessions server-side rather than exposing a shared Payment Link.
- Promotion/discount settings match launch policy.
- Webhook endpoint targets the deployed JewelHire webhook URL.
- Webhook signing secret is configured in Secret Manager, not exposed in source or docs.
- Required events include checkout, subscription, and invoice lifecycle events.
- Recent webhook deliveries show no unexpected failures or unreviewed live events.
- Customer portal or billing-management route expectations are clear before customer traffic.

The production workflow runs `npm run stripe:readiness:production` inside a
short-lived Cloud Run job with Secret Manager mounts. It performs Stripe API
`GET` requests only and fails promotion unless both exact live Prices share one
product, the exact production webhook is uniquely enabled with all six required
events, the legacy shared Payment Link is inactive, and its open/unsettled
session plus current-subscription counts are zero. Do not run this command with
secrets copied into a terminal transcript or CI log.

The 2026-07-15 GET-only audit found two remaining provider actions:

- add `invoice.paid` to the production webhook's event selection;
- deactivate legacy Payment Link `plink_1Tngh8Jcq3gleedT9vWeCQZ2` at controlled
  cutover (the audit found zero open sessions, zero completed-unsettled sessions,
  and zero current subscriptions).

Stripe does not expose webhook signing secrets via its read API. After the event
selection is fixed, capture one recent signature-verified production delivery
and use that evidence for the workflow's explicit webhook-delivery confirmation.

## Manual Evidence To Capture

For each dashboard, capture only non-secret evidence:

- Provider name and environment/mode.
- Timestamp and reviewer.
- Pass/fail status for each checklist item.
- Redacted screenshot if useful.
- Any blocker, owner, and resolution date.

Never capture API tokens, webhook secrets, card details, customer PII, or full provider event payloads.
