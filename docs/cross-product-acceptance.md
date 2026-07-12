# JewelHire/JewelLink cross-product acceptance

The acceptance runner checks the preserved JewelLink integration and the
curated JewelHire release together without sending email, exposing secrets, or
changing production.

## Source acceptance

From the JewelHire repository:

```bash
npm run qa:cross-product
```

The default assumes JewelLink is the sibling directory `../JewelLink`. Override
that location when needed:

```bash
npm run qa:cross-product -- --jewellink-repo=/absolute/path/to/JewelLink
```

This mode runs both products' contract audits and verifies role mapping,
platform-admin isolation, location scope, one-time SSO-code controls, hire and
JewelCert idempotency, cancellation recovery, public careers, legal consent,
private résumé access, aggregate analytics, and application throttling.

## Safe local endpoint probes

When a local JewelLink server is already running, add its origin to verify that
the integration endpoints reject unauthenticated requests before parsing or
mutating data:

```bash
npm run qa:cross-product -- \
  --jewellink-base=http://127.0.0.1:3001 \
  --require-endpoint-probes
```

The endpoint probes use no shared secret and expect HTTP 401. They never create
an SSO code, user, hire, assessment, or result.

## Artifacts

Each run writes an ignored timestamped directory beneath `docs/qa-runs/` with:

- `cross-product-report.json` and `.md`
- `fixture-inventory.json`
- `environment-contract.json`

The fixtures contain synthetic identifiers only. The environment contract uses
placeholders and never reads or records `.env.local` values.
