# JewelHire — Canonical Repo

**Decision:** `~/Desktop/jewelhire` is the single source of truth for all JewelHire work.
Any other JewelHire codebase (e.g. `~/Documents/Jewelhire`, or the separate `src/`+Prisma+Firebase
build described in `launch-gap-report.md`) is to be **retired**.

## What this means
- All feature work, QA, and deploys reference `~/Desktop/jewelhire` only.
- Plumbing that currently lives only in the other codebase (Prisma/Postgres persistence, Firebase/
  Google auth, Stripe billing, Postmark email, Cloud Run deploy) is treated as **work to port into
  this repo**, not a second app to keep alive.
- `docs/launch-gap-report.md` remains a useful requirements/checklist reference, but its `src/…` file
  paths and Cloud Run assumptions describe the *old* codebase.

## Before deleting the other repo — READ THIS
The other codebase may currently be **the source that deploys to `app.jewelhire.com` / Cloud Run
`jewelhire-prod-20260626`**. Deleting it before this repo can take over would orphan the live app's
source. Do the deletion **yourself**, in this order:

1. **Confirm what actually deploys prod.** Check the Cloud Run service / CI config for
   `jewelhire-prod-20260626` — which folder/repo builds it? If it's the other codebase, do not delete
   until this repo can build and deploy the same surface.
2. **Archive, don't just delete.** `tar czf ~/jewelhire-legacy-$(date +%Y%m%d).tgz ~/Documents/Jewelhire`
   (or push it to a `legacy/` git branch/remote) so nothing is unrecoverable.
3. **Port the gaps** into `~/Desktop/jewelhire` (auth, persistence, billing, email, deploy) and prove
   them with the QA ladder + `docs/qa-plan-features.md`.
4. **Cut prod over** to this repo (staging → verify → domain swap), then remove the archived legacy
   copy.

> Claude does not delete repos/files on your behalf (hard-deletes are yours to run, and the other
> codebase isn't in this session's mounted folder anyway). The steps above are the safe path.
