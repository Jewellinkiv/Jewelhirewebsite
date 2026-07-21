# Production Pilot Operator Reply Intake

This helper validates a filled operator approval reply from the production
pilot approval bundle and can draft the local ignored files consumed by the
existing live-readiness audits.

It is non-mutating: it does not authenticate, send email, create users, submit
applications, hire anyone, write to JewelLink, deploy, move traffic, or write to
either production database.

## Command

Save the filled reply in a local ignored path, then run:

```bash
npm run qa:pilot-operator-reply-intake -- \
  --reply-file=.qa_tmp/production-pilot-operator-reply.txt \
  --write-local-drafts
```

The value-free report is written under
`docs/qa-runs/pilot-operator-reply-intake-*`. Draft files are written under
`.qa_tmp/pilot-operator-reply-intake/` only when every intake check passes.

## Drafts

When the reply is complete, the helper writes:

- `.qa_tmp/pilot-operator-reply-intake/production-operations-evidence.json`
- `.qa_tmp/pilot-operator-reply-intake/production-pilot-application-approval.json`
- `.qa_tmp/pilot-operator-reply-intake/production-pilot-smoke-plan.json`

Use those drafts with the existing gates:

```bash
npm run qa:operations-readiness -- --operations-evidence-file=.qa_tmp/pilot-operator-reply-intake/production-operations-evidence.json
npm run qa:pilot-application-submission -- --execute --target-report=<pilot-smoke-targets-report.json> --approval-file=.qa_tmp/pilot-operator-reply-intake/production-pilot-application-approval.json
npm run qa:pilot-smoke-plan -- --smoke-plan-file=.qa_tmp/pilot-operator-reply-intake/production-pilot-smoke-plan.json
```

## Safety Rules

The helper fails closed if the reply contains placeholder markers, full email
addresses, database URLs, bearer tokens, cookie values, password values, token
values, secret values, or customer data.

It also fails closed if the reply mixes in JewelLink code push or code deploy
approval. JewelLink code movement remains separate from the controlled pilot
flag/config and smoke setup approvals.

Do not commit filled replies or generated drafts.

## Verification

Fixture coverage:

```bash
npm run test:production-pilot-operator-reply-intake
```

Release-control coverage includes this helper through
`npm run test:release-controls`.
