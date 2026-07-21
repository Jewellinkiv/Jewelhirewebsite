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
`docs/qa-runs/pilot-approval-bundle-2026-07-21T09-17-40-733Z/`. It passes,
writes `pilot-approval-bundle.md`, and preserves the already-recorded
monitoring evidence in the local operations evidence skeleton while leaving
the six rollback approval fields empty.

## What It Combines

- Operations rollback owner/window/threshold request fields.
- JewelLink controlled persona provisioning actions.
- Controlled public application submission approval-file requirements.
- Smoke-plan approval, persona, acceptance, application, and resume ID gaps.
- A single operator reply template that collects rollback owners, controlled
  setup approval, mutating smoke approval, source-test acceptance, and the
  JewelLink no-code-push boundary.
- A companion intake path for validating a filled reply and drafting the local
  ignored audit files without printing approval values.
- Local ignored file skeletons for the operations evidence file, controlled
  application approval file, and pilot smoke plan; the operations skeleton
  reuses the current non-secret operations evidence file when present.
- The recommended command sequence from approval collection through final
  live-readiness validation.

## Filled Reply Intake

After the operator reply template is filled, save it in a local ignored file
and run:

```bash
npm run qa:pilot-operator-reply-intake -- \
  --reply-file=.qa_tmp/production-pilot-operator-reply.txt \
  --write-local-drafts
```

That helper fails closed if placeholders, unsafe values, or JewelLink code
push/deploy approval are mixed into the pilot approval. When it passes, it
writes the local draft files under `.qa_tmp/pilot-operator-reply-intake/` for
the operations-readiness, controlled-application, and smoke-plan gates.

## Secret Handling

The bundle refuses source request packets and operations evidence drafts
containing full email addresses, database URLs, bearer token values, cookie
values, password values, token values, secret values, or customer data. It
writes only non-secret artifact paths, required field names, local ignored file
skeletons, and command references.

Do not commit filled approval files. Use the generated skeletons only in local
ignored paths such as `.qa_tmp/production-operations-evidence.json`,
`.qa_tmp/production-pilot-application-approval.json`, and
`.qa_tmp/production-pilot-smoke-plan.json`.

## Verification

Fixture coverage:

```bash
npm run test:production-pilot-approval-bundle
npm run test:production-pilot-operator-reply-intake
```

Release-control coverage now includes this helper through
`npm run test:release-controls`.
