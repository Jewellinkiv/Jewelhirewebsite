#!/usr/bin/env node
import fs from "node:fs";

const service = fs.readFileSync(new URL("../lib/server/jewellink-integration.ts", import.meta.url), "utf8");
const hireRoute = fs.readFileSync(new URL("../app/api/applications/[id]/hire/route.ts", import.meta.url), "utf8");
const retryRoute = fs.readFileSync(new URL("../app/api/applications/[id]/hire-sync/route.ts", import.meta.url), "utf8");
const store = fs.readFileSync(new URL("../lib/server/postgres-phase1.ts", import.meta.url), "utf8");
let failures = 0;

function check(name, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  if (!pass) failures += 1;
}

check("new PostgreSQL hires start pending", store.includes("'pending',") && store.includes("JewelLink account provisioning queued"));
check("hire payload keeps email, phone, and local location", store.includes("email: preview.applicant.email") && store.includes("locationId: resolved.locationId"));
check("JewelLink company and location mappings are required", service.includes("jewellink_organization_not_linked") && service.includes("jewellink_location_not_linked"));
check("hire handoff uses the integration secret", service.includes("JEWELLINK_INTEGRATION_SHARED_SECRET"));
check("hire handoff is no-store and HTTPS-only in production", service.includes('cache: "no-store"') && service.includes('protocol !== "https:"'));
check("successful handoff stores the real JewelLink user ID", service.includes("set jewellink_team_member_id = $1, sync_status = 'synced'"));
check("failed handoff is durable without rolling back the hire", service.includes("set sync_status = 'failed'") && hireRoute.includes("syncPostgresHireToJewelLink"));
check("failed handoff has a location-scoped retry route", retryRoute.includes("export const POST") && retryRoute.includes('"hire_sync.retry"'));

process.exitCode = failures ? 1 : 0;
