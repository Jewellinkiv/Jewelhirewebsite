# Production Pilot Approval Bundle

This helper builds a single non-secret operator packet from the latest open
approval/request artifacts for the controlled JewelHire/JewelLink pilot. It is
read-only: it does not authenticate, send email, create users, submit
applications, hire anyone, write to JewelLink, deploy, move traffic, or write to
either production database.

## Command

```bash
npm run qa:pilot-approval-bundle
```

The report is written under `docs/qa-runs/pilot-approval-bundle-*` unless
`--artifacts=<dir>` is supplied.

The latest production result is
`docs/qa-runs/pilot-approval-bundle-2026-07-21T08-31-38-716Z/`. It passes and
writes `pilot-approval-bundle.md`.

## What It Combines

- Operations rollback owner/window/threshold request fields.
- JewelLink controlled persona provisioning actions.
- Controlled public application submission approval-file requirements.
- Smoke-plan approval, persona, acceptance, application, and resume ID gaps.
- Local ignored file skeletons for the operations evidence file, controlled
  application approval file, and pilot smoke plan.
- The recommended command sequence from approval collection through final
  live-readiness validation.

## Secret Handling

The bundle refuses source request packets containing full email addresses,
database URLs, bearer token values, cookie values, password values, token values,
secret values, or customer data. It writes only non-secret artifact paths,
required field names, local ignored file skeletons, and command references.

Do not commit filled approval files. Use the generated skeletons only in local
ignored paths such as `.qa_tmp/production-operations-evidence.json`,
`.qa_tmp/production-pilot-application-approval.json`, and
`.qa_tmp/production-pilot-smoke-plan.json`.

## Verification

Fixture coverage:

```bash
npm run test:production-pilot-approval-bundle
```

Release-control coverage now includes this helper through
`npm run test:release-controls`.
