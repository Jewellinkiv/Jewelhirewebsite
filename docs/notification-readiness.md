# Notification Readiness

JewelHire has a Postmark-backed notification adapter, but live email sends remain gated by `EMAIL_NOTIFICATIONS_ENABLED`.

## Current State

- `sendNotification` supports Postmark with dry-run and disabled modes.
- Public application submission sends candidate confirmation and store manager notification statuses through the adapter.
- Assessment/GemMatch completion sends candidate and manager notification statuses when recipients are available.
- JewelCert/GemMatch invite creation sends a candidate invite status through the adapter.
- New-candidate interview scheduling sends a candidate interview status through the adapter.
- Store/company user invites and admin invite resends send invited-user notification statuses through the adapter.
- Reconciled Stripe billing, subscription, checkout, and invoice webhooks send billing-contact notification statuses through the adapter.
- Training assignment creation and first completion send learner notification statuses through the adapter.
- `npm run qa:notifications` is static and safe; it does not send email.
- Latest audit passed on 2026-07-01 with seven expected triggers wired, zero blockers, and zero warnings. Artifact: `docs/qa-runs/notification-readiness-2026-07-01T06-17-36-290Z/`.

## Remaining Notification Work

- Store/company user invite emails currently point to `/login`; update the deep link when invite-token or first-password setup is finalized.
- Training overdue reminders need a scheduled runner, and manager notifications need a stable manager-recipient policy.
- Billing notification emails currently point to `/settings`; update the deep link if a dedicated billing portal or customer portal route is added.

## Safe Verification

```bash
npm run qa:notifications
npm run qa:security:live
npm run qa:live
```

Keep `EMAIL_NOTIFICATIONS_ENABLED=false` until Postmark sender identity, test recipients, and unsubscribe/notification-preference behavior are confirmed.
