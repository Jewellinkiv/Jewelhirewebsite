# Cloud Reauthentication Runbook

Use this when local `gcloud` credentials expire during launch verification.

Source repo: `/Users/williamiv/Desktop/Jewelhire`
Google Cloud project: `jewelhire-prod-20260626`
Cloud Run service: `jewelhire`
Region: `us-central1`

## Safety Rules

- Do not paste Secret Manager values, database URLs, API tokens, webhook secrets, or smoke passwords into docs, tickets, Slack, screenshots, or terminal transcripts.
- Do not enable live email sends, create checkout sessions, replay real webhooks, or make provider dashboard changes from this runbook.
- Artifact reports may list env names, pass/fail status, counts, and paths only.

## Reauth

```bash
cd /Users/williamiv/Desktop/Jewelhire
gcloud config set project jewelhire-prod-20260626
gcloud auth login
gcloud auth list
```

If `gcloud auth list` shows multiple accounts, select the intended JewelHire production account:

```bash
gcloud config set account <account-email>
```

## Post-Reauth Verification

Run these checks from `/Users/williamiv/Desktop/Jewelhire`:

```bash
gcloud run services describe jewelhire \
  --project jewelhire-prod-20260626 \
  --region us-central1 \
  --format='value(status.latestReadyRevisionName,status.traffic[0].revisionName,status.traffic[0].percent,status.url)'

npm run qa:config
npm run qa:postmark
npm run qa:auth -- --expect-firebase
npm run qa:handoff
```

Expected result:

- Cloud Run latest ready revision matches the 100% traffic revision.
- Config exposure audit passes without printing secret values.
- Postmark safety audit confirms Cloud Run email gates and secret-backed token mount without sending email.
- Full auth readiness confirms Firebase/GCP setup without printing Firebase keys or OAuth secrets.
- Tester handoff audit can read the smoke-credential secret and validates roles without printing passwords.

## If Reauth Still Fails

- Confirm the account has access to project `jewelhire-prod-20260626`.
- Confirm the active account with `gcloud config get-value account`.
- Keep using the already-passing hosted HTTP/browser checks as runtime evidence, and leave cloud-backed checks marked blocked until access is fixed.
