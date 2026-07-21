# Production Pilot Roster Audit

This audit records the live pilot roster state needed before authenticated
JewelLink-to-JewelHire smoke testing. It is read-only: it does not create users,
change roles, update allowlists, send email, start SSO, hire anyone, or write to
either production database.

## Command

Run from the JewelHire repository on a machine with authenticated `gcloud`
access to both production projects:

```bash
npm run qa:pilot-roster -- \
  --jewelhire-project=jewelhire-prod-20260626 \
  --jewelhire-region=us-central1 \
  --jewelhire-service=jewelhire \
  --jewellink-project=academy-460316 \
  --jewellink-db-secret=DATABASE_URL \
  --pilot-company-id=comp_1 \
  --pilot-location-ids=loc_1,loc_2,loc_3,loc_4,loc_5,loc_6
```

The report is written under `docs/qa-runs/pilot-roster-*` unless
`--artifacts=<dir>` is supplied. Each run also writes
`pilot-roster-provisioning-packet.md` and
`pilot-roster-provisioning-packet.json` in the same artifact directory. The
packet lists any production account actions still needed for the controlled
denial personas; it is an approval aid only and does not mutate either product.

## What It Proves

- Diamond Exchange `comp_1` exists, is active, and is not paused.
- The expected pilot location IDs are present and no unexpected pilot IDs are
  included.
- Active JewelLink Director, Manager, and Student candidates exist for SSO
  smoke.
- A JewelLink platform-admin candidate exists in the JewelHire admin allowlist.
- The JewelHire admin allowlist has no active non-admin JewelLink users.
- JewelHire smoke credential auth prerequisites exist for admin SSO marker,
  native store owner, and native applicant smoke paths.
- Missing live-smoke personas are reported as GO blockers, not silently ignored.
- Missing controlled Consultant or paused-company denial personas are converted
  into a non-secret provisioning packet with constraints and verification
  commands.

## Latest Production Result

`docs/qa-runs/pilot-roster-2026-07-21T07-30-50-297Z/` confirms Diamond
Exchange `comp_1`, locations `loc_1`-`loc_6`, Director/Manager/Student SSO
candidates, a platform-admin candidate, clean admin allowlist, and JewelHire
smoke credential auth prerequisites. It still fails because the controlled
Consultant-denial and paused-company denial personas are missing. The same run
generated
`docs/qa-runs/pilot-roster-2026-07-21T07-30-50-297Z/pilot-roster-provisioning-packet.md`
with the two approval-required JewelLink production account actions.

Credential presence is not sufficient for GO evidence. Run
`npm run qa:smoke-credential-auth` and require a passing report before using the
controlled JewelHire smoke credentials for pilot smoke artifacts.

## Secret Handling

The audit reads the JewelLink database URL and JewelHire smoke/admin secrets
only in memory. It writes masked email aliases only. It does not write database
URLs, bearer tokens, cookies, passwords, secret values, or full email
addresses. The JSON report includes `valuesPrinted: false`.

## Local Verification

Fixture coverage runs without `gcloud`:

```bash
node --test scripts/production-pilot-roster-audit.test.mjs
```

The fixture tests prove the complete-roster path, the safe failure path when
controlled denial personas are missing, and the provisioning packet's
no-secret behavior.
