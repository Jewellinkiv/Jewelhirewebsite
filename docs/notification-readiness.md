# Notification Readiness

JewelHire has a Postmark-backed notification adapter, but live email sends remain gated by `EMAIL_NOTIFICATIONS_ENABLED`.

## Current State

- `sendNotification` supports Postmark with dry-run and disabled modes.
- Postmark requests have a hard 10-second maximum timeout. Network errors and
  timeouts are classified as ambiguous because the provider may have accepted
  the message before the response was lost.
- Only stable Postmark request/auth/validation responses (`400`, `401`, `403`,
  `404`, `405`, `406`, `410`, `413`, `415`, `422`) are definite rejection.
  Timeout/conflict/throttling responses (`408`, `409`, `425`, `429`), every
  `5xx`, and unknown non-success responses are conservatively ambiguous.
- Applicant signup commits an independent hashed link before provider I/O,
  retains accepted or ambiguous links, and deletes only a definitely
  undelivered row. No database transaction or pooled connection is held while
  Postmark is running.
- Password-reset email keeps the one-time bearer in the URL fragment so it is
  excluded from HTTP access logs and Referer headers. Redemption rechecks the
  current email, active/native-auth policy, and platform-admin denylist after
  user/token locks, then commits the credential, native-session epoch bump, and
  token consumption together. Every older native cookie is rejected on its next
  request; JewelLink SSO assurance is unchanged. A retained-account claim also
  bumps this epoch because it replaces the native credential.
  New bearers use the `pr2_` transport version; pre-cutover query-string
  bearers are deliberately rejected even if their database expiry has not
  elapsed, because those URLs may already exist in access logs.
- Reset initiation limits the client before reading a body, accepts no more than
  4 KiB, validates a 254-character-or-shorter email, and silently applies an
  HMAC-pseudonymous normalized-mailbox limit. Malformed, unknown, throttled,
  accepted, and failed-delivery paths have the same `200 {ok:true}` body,
  no-store policy, and timing floor with jitter. The account lookup, short
  pending-token transaction, and Postmark send run through Next's
  request-scoped after-response hook, so provider latency and known-account
  token persistence are absent from the public timing signal.
- Password-reset provider I/O holds no transaction, row lock, or pooled
  connection. A second short transaction settles the delivery. Definite
  Postmark rejection marks only its candidate rejected and preserves the last
  active link. Accepted and ambiguous outcomes keep the possibly delivered
  candidate usable, retire every older active or pending bearer, and resolve
  concurrent sends by issuance order rather than provider-response order. A
  crash after dispatch but before settlement leaves the hashed pending bearer
  redeemable; a later successfully delivered request supersedes it.
- Retained store-owner access claims use versioned `ac2_` bearers delivered only
  in `/claim-account#token=...`. The client captures and immediately scrubs the
  fragment, then previews and redeems through POST bodies. Legacy query-string
  claim links are deliberately unredeemable and must be reissued at cutover.
- Public application submission sends candidate confirmation and store manager notification statuses through the adapter.
- Assessment/GemMatch completion sends candidate and manager notification statuses when recipients are available.
- JewelCert/GemMatch invite creation sends a candidate invite status through the adapter.
- New-candidate interview scheduling sends a candidate interview status through the adapter.
- Store/company user invites and admin invite resends send invited-user notification statuses through the adapter.
- Reconciled Stripe billing, subscription, checkout, and invoice webhooks send billing-contact notification statuses through the adapter.
- Training assignment creation and first completion send learner notification statuses through the adapter.
- Applicant notification preferences are checked centrally before candidate-facing invite, interview, status, hire, and training messages are sent.
- `npm run qa:notifications` is static and safe; it does not send email.
- The production workflow requires `JEWELHIRE_RELEASE_PROBE_EMAIL` and a
  provider-accepted no-traffic applicant-signup probe before moving traffic.
- Latest audit passed on 2026-07-01 with seven expected triggers wired, zero blockers, and zero warnings. Artifact: `docs/qa-runs/notification-readiness-2026-07-01T11-05-56-878Z/`.

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

Keep `EMAIL_NOTIFICATIONS_ENABLED=false` until the Postmark sender identity, message
stream, controlled probe mailbox, and notification-preference behavior are
confirmed. Verified applicant signup then requires live delivery and the
guarded no-traffic provider probe before production traffic moves.
