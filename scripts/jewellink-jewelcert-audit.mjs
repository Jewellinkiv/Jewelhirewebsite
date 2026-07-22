#!/usr/bin/env node
import fs from "node:fs";

const inviteRoute = fs.readFileSync(new URL("../app/api/integrations/jewellink/jewelcert/invites/route.ts", import.meta.url), "utf8");
const completionRoute = fs.readFileSync(new URL("../app/api/gemmatch/responses/route.ts", import.meta.url), "utf8");
const integration = fs.readFileSync(new URL("../lib/server/jewellink-integration.ts", import.meta.url), "utf8");
const lifecycle = fs.readFileSync(new URL("../lib/server/postgres-phase1.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../db/migrations/0015_jewellink_jewelcert_integration.sql", import.meta.url), "utf8");
const proxy = fs.readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const healthRoute = fs.readFileSync(new URL("../app/api/stores/[storeId]/integrations/jewellink/health/route.ts", import.meta.url), "utf8");
const healthPanel = fs.readFileSync(new URL("../components/JewelLinkIntegrationHealth.tsx", import.meta.url), "utf8");
const claimPostgresTest = fs.readFileSync(new URL("../scripts/jewelcert-claim-postgres.test.mjs", import.meta.url), "utf8");
const deployWorkflow = fs.readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
let failures = 0;

function check(name, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  if (!pass) failures += 1;
}

check("JewelLink invite endpoint requires a timing-safe server secret", inviteRoute.includes("timingSafeEqual") && inviteRoute.includes("JEWELLINK_INTEGRATION_SHARED_SECRET"));
check("invite organization and location are resolved through external IDs", inviteRoute.includes("c.jewellink_company_id = $1") && inviteRoute.includes("l.jewellink_location_id = $2"));
check("employee assessments use a non-recruiting application source", migration.includes("jewellink_employee") && inviteRoute.includes("'jewellink_employee', 'hired'"));
check("invite retries are idempotent within a store", migration.includes("jewelcert_invites_store_external_request_uidx") && inviteRoute.includes("on conflict (store_id, external_request_id)"));
check("employee assessment completion preserves hired stage", lifecycle.includes('application.source === "jewellink_employee"') && lifecycle.includes("Completed JewelLink employee JewelCert"));
check("employee assessment records are excluded from recruiting lists", (lifecycle.match(/a\.source <> 'jewellink_employee'/g) || []).length >= 4);
check("completed results are delivered to JewelLink server-to-server", completionRoute.includes("syncPostgresJewelCertResultToJewelLink") && integration.includes("/api/integrations/jewelhire/jewelcert/results"));
check("result delivery state is durable and retryable", migration.includes("result_sync_status") && integration.includes("result_sync_status = 'failed'") && integration.includes("result_sync_status = 'synced'"));
check("bearer-authenticated integration routes bypass cookie middleware", proxy.includes('/api/integrations/jewellink/'));
check("integration health and retries are store-owner operations", healthRoute.includes('"integrations.jewellink.health"') && healthRoute.includes('"integrations.jewellink.retry"'));
check("retry IDs are verified against the requested store", healthRoute.includes("issueStoreId !== storeId") && healthRoute.includes("getPostgresJewelCertResultSyncStoreId"));
check("JewelCert retries record pending before delivery", integration.includes("result_sync_status = 'pending'") && integration.includes("result_sync_status = 'failed'"));
check("JewelCert result sync has PostgreSQL behavior coverage", claimPostgresTest.includes("syncPostgresJewelCertResultToJewelLink") && claimPostgresTest.includes("gemmatch-sync-failed") && claimPostgresTest.includes("gemmatch-sync-retry") && claimPostgresTest.includes("not_linked"));
check("deploy runs JewelCert PostgreSQL behavior coverage", deployWorkflow.includes("npm run test:jewelcert-claim-postgres"));
check("owner settings expose integration issues and retry controls", healthPanel.includes("pending or failed") && healthPanel.includes("Retry") && healthPanel.includes("configuration.configured"));

process.exitCode = failures ? 1 : 0;
