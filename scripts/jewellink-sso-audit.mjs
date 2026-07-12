#!/usr/bin/env node
import fs from "node:fs";

const files = {
  start: fs.readFileSync(new URL("../app/api/auth/jewellink/start/route.ts", import.meta.url), "utf8"),
  callback: fs.readFileSync(new URL("../app/api/auth/jewellink/callback/route.ts", import.meta.url), "utf8"),
  service: fs.readFileSync(new URL("../lib/server/jewellink-sso.ts", import.meta.url), "utf8"),
  migration: fs.readFileSync(new URL("../db/migrations/0014_jewellink_sso.sql", import.meta.url), "utf8"),
  claimRoute: fs.readFileSync(new URL("../app/api/admin/companies/[id]/claim-links/route.ts", import.meta.url), "utf8"),
  companyPage: fs.readFileSync(new URL("../app/(admin)/admin/companies/[id]/page.tsx", import.meta.url), "utf8"),
  notifications: fs.readFileSync(new URL("../lib/server/notifications.ts", import.meta.url), "utf8"),
};

let failures = 0;
function check(name, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  if (!pass) failures += 1;
}

check("JewelHire starts SSO through JewelLink", files.start.includes("/api/integrations/jewelhire/sso/start"));
check("production JewelLink URL requires HTTPS", files.start.includes('protocol !== "https:"') && files.service.includes('protocol !== "https:"'));
check("authorization code exchange uses a server bearer secret", files.service.includes("authorization: `Bearer ${secret}`"));
check("authorization code exchange is no-store", files.service.includes('cache: "no-store"'));
check("callback mints the standard signed JewelHire session", files.callback.includes("setSessionCookie(response, session)"));
check("Student and Consultant do not receive store membership", files.service.includes('if (role === "MANAGER")') && !files.service.includes('role === "STUDENT"'));
check("Manager maps to manager", files.service.includes('if (role === "MANAGER") return "manager"'));
check("Director mapping is configurable", files.service.includes("JEWELHIRE_JEWELLINK_DIRECTOR_ROLE"));
check("JewelLink entitlement is organization-level and free", files.service.includes("'jewellink_included', 'jewellink_free', 'active', 0"));
check("JewelLink user identity is stable and unique", files.migration.includes("users_jewellink_user_id_uidx"));
check("JewelLink-managed memberships can be revoked on role change", files.migration.includes("source in ('manual', 'jewellink')") && files.service.includes("status = 'inactive'"));
check("Super Admin can send a retained-account claim link", files.claimRoute.includes('requireAdminAccess("admin.company_users.send_claim")') && files.companyPage.includes("Send access link"));
check("Recovery claim links are single-use and replace older links", files.claimRoute.includes('invalidateActionTokens("account_claim"') && files.claimRoute.includes('purpose: "account_claim"'));
check("Recovery email explains retained data and avoids duplicates", files.notifications.includes("data is still safely retained") && files.notifications.includes("does not create a new company or duplicate your data"));

process.exitCode = failures ? 1 : 0;
