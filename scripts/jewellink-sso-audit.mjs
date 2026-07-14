#!/usr/bin/env node
import fs from "node:fs";

const files = {
  start: fs.readFileSync(new URL("../app/api/auth/jewellink/start/route.ts", import.meta.url), "utf8"),
  callback: fs.readFileSync(new URL("../app/api/auth/jewellink/callback/route.ts", import.meta.url), "utf8"),
  service: fs.readFileSync(new URL("../lib/server/jewellink-sso.ts", import.meta.url), "utf8"),
  contract: fs.readFileSync(new URL("../lib/server/jewellink-sso-contract.ts", import.meta.url), "utf8"),
  safeRedirect: fs.readFileSync(new URL("../lib/server/safe-redirect.ts", import.meta.url), "utf8"),
  migration: fs.readFileSync(new URL("../db/migrations/0014_jewellink_sso.sql", import.meta.url), "utf8"),
  nativePolicyMigration: fs.readFileSync(new URL("../db/migrations/0019_jewellink_native_auth_policy.sql", import.meta.url), "utf8"),
  auth: fs.readFileSync(new URL("../lib/server/auth.ts", import.meta.url), "utf8"),
  access: fs.readFileSync(new URL("../lib/server/access-control.ts", import.meta.url), "utf8"),
  password: fs.readFileSync(new URL("../lib/server/password-auth.ts", import.meta.url), "utf8"),
  actionTokens: fs.readFileSync(new URL("../lib/server/action-tokens.ts", import.meta.url), "utf8"),
  storeSignup: fs.readFileSync(new URL("../lib/server/store-signup.ts", import.meta.url), "utf8"),
  passwordRoute: fs.readFileSync(new URL("../app/api/auth/password/session/route.ts", import.meta.url), "utf8"),
  resetRequest: fs.readFileSync(new URL("../app/api/auth/password/reset-request/route.ts", import.meta.url), "utf8"),
  accountClaim: fs.readFileSync(new URL("../app/api/auth/account-claim/route.ts", import.meta.url), "utf8"),
  googleStart: fs.readFileSync(new URL("../app/api/auth/google/start/route.ts", import.meta.url), "utf8"),
  google: fs.readFileSync(new URL("../app/api/auth/google/callback/route.ts", import.meta.url), "utf8"),
  firebase: fs.readFileSync(new URL("../app/api/auth/firebase/session/route.ts", import.meta.url), "utf8"),
  reset: fs.readFileSync(new URL("../app/api/auth/password/reset/route.ts", import.meta.url), "utf8"),
  claimRoute: fs.readFileSync(new URL("../app/api/admin/companies/[id]/claim-links/route.ts", import.meta.url), "utf8"),
  companyPage: fs.readFileSync(new URL("../app/(admin)/admin/companies/[id]/page.tsx", import.meta.url), "utf8"),
  notifications: fs.readFileSync(new URL("../lib/server/notifications.ts", import.meta.url), "utf8"),
  storeLayout: fs.readFileSync(new URL("../app/(store)/layout.tsx", import.meta.url), "utf8"),
  storeIdentity: fs.readFileSync(new URL("../lib/server/store-shell-identity.ts", import.meta.url), "utf8"),
  topbar: fs.readFileSync(new URL("../components/Topbar.tsx", import.meta.url), "utf8"),
};

let failures = 0;
function check(name, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  if (!pass) failures += 1;
}

check("JewelHire starts SSO through a branded JewelLink page", files.start.includes("/integrations/jewelhire/launch") && !files.start.includes("/api/integrations/jewelhire/sso/start"));
check("SSO launch has a short-lived production-secure browser state cookie", files.start.includes("jewelLinkStateCookieName") && files.start.includes("httpOnly: true") && files.start.includes('sameSite: "lax"') && files.start.includes("jewelLinkStateCookieSecure") && files.start.includes("STATE_TTL_SECONDS") && files.auth.includes("__Host-jewelhire_jewellink_state"));
check("callback binds URL, cookie, and exchanged claim state", files.callback.includes("jewelLinkStateMatches") && files.callback.indexOf("stateCookie") < files.callback.indexOf("exchangeJewelLinkCode(code)"));
check("callback clears launch state on success and failure", files.callback.includes("clearState(response)") && files.callback.includes("clearState(NextResponse.redirect"));
check("production JewelLink URL requires HTTPS", files.start.includes('protocol !== "https:"') && files.service.includes('protocol !== "https:"'));
check("authorization code exchange uses a server bearer secret", files.service.includes("authorization: `Bearer ${secret}`"));
check("authorization code exchange is no-store", files.service.includes('cache: "no-store"'));
check("callback mints the standard signed JewelHire session", files.callback.includes("setSessionCookie(response, session)"));
check("JewelLink claims require exact password and MFA assurance", files.service.includes("amr: string[]") && files.service.includes("mfaVerifiedAt") && files.service.includes("upstreamSessionId") && files.contract.includes('uniqueMethods.has("pwd")') && files.contract.includes('uniqueMethods.has("mfa")') && files.contract.includes("uniqueMethods.size !== 2"));
check("all auth redirects share strict decoded same-origin path validation", files.start.includes("safeSameOriginPath") && files.service.includes("safeSameOriginPath(body.claims.returnTo)") && files.callback.includes("safeSameOriginPath(returnTo)") && files.googleStart.includes("safeSameOriginPathOrRoot") && files.google.includes("safeSameOriginPathOrRoot") && files.passwordRoute.includes("safeSameOriginPathOrRoot") && files.firebase.includes("safeSameOriginPathOrRoot") && files.safeRedirect.includes("decodeURIComponent") && files.safeRedirect.includes("CONTROL_CHARACTERS"));
check("JewelLink sessions are tagged and capped to upstream assurance", files.auth.includes('authSource: "jewellink_sso"') && files.auth.includes("upstreamAssurance") && files.auth.includes("remainingLifetime"));
check("JewelLink sessions are revalidated on server access", files.access.includes("revalidateJewelLinkSession") && files.auth.includes('company_status === "active"') && files.auth.includes('entitlement_status === "active"'));
check("native sessions rebuild current active-store authorization", files.auth.includes("const refreshed = await findNativeSession") && files.auth.includes("left join stores s on s.id = su.store_id and s.status = 'active'"));
check("native store access is entitled per membership company", files.auth.includes("entitledStandaloneStoreMemberships") && files.auth.includes('c.id as "storeCompanyId"') && files.contract.includes("membership.storeCompanyId") && files.contract.includes("membership.storeCompanyStatus"));
check("SSO provisioning preserves local user/company/entitlement revocations", !files.service.includes("do update set name = excluded.name, status = 'active'") && files.service.includes("on conflict (company_id) do nothing") && files.service.includes("linkedUser.rows[0].status !== \"active\""));
check("JewelLink-linked users default to SSO-only", files.nativePolicyMigration.includes("native_auth_enabled") && files.service.includes("native_auth_enabled = false"));
check("native password, reset, Google, and Firebase paths deny SSO-only identities", files.password.includes("native_auth_enabled") && files.reset.includes("nativeAuthEnabledForUser") && files.google.includes("isJewelLinkSsoOnlyEmail") && files.firebase.includes("jewellink_required"));
check("platform admins are denied every native auth and recovery path", files.contract.includes("input.nativeAuthEnabled && !input.isPlatformAdmin") && files.password.includes("isConfiguredAdminEmail(row.email) || !row.native_auth_enabled") && files.password.includes("!isConfiguredAdminEmail(row.email)") && files.auth.includes("if (isConfiguredAdmin) return undefined") && files.auth.includes("if (isConfiguredAdminEmail(email)) return true") && files.auth.includes('configuredAdmin || session.role === "admin"') && files.resetRequest.includes("findActiveUserByEmail") && files.accountClaim.includes("isConfiguredAdminEmail(claim.email)") && files.claimRoute.includes("isConfiguredAdminEmail(owner.email)"));
check("only MFA-backed JewelLink SSO can mint platform admin", files.auth.includes("export async function findJewelLinkSession") && files.auth.includes("const isConfiguredAdmin = isConfiguredAdminEmail(identity.email)") && files.auth.includes("isPlatformAdmin: isConfiguredAdmin") && files.service.includes("canAdoptAllowlistedAdmin") && files.service.includes("native_auth_enabled = false"));
check("upstream roles use an exact allowlist and SUPER_ADMIN requires the independent JewelHire admin allowlist", files.service.includes("jewelLinkRoleAllowedForIdentity") && ["SUPER_ADMIN", "ADMIN", "DIRECTOR", "MANAGER", "CONSULTANT", "STUDENT"].every((role) => files.contract.includes(`"${role}"`)) && files.contract.includes('input.role !== "SUPER_ADMIN" || input.isPlatformAdmin') && !files.contract.includes("trim().toUpperCase()"));
check("existing native sessions are revoked when an identity becomes SSO-only", files.access.includes("revalidateNativeSession") && files.auth.includes("export async function revalidateNativeSession"));
check("standalone claim conversion revalidates the token's exact non-JewelLink company entitlement", files.password.includes("completeStandaloneAccountClaim") && files.password.includes("token.company_id") && files.password.includes("where c.id = $2") && files.password.includes("authorizing_store.company_id = $2") && files.password.includes("cae.source <> 'jewellink_included'") && files.password.includes("sub.status in ('active', 'trialing')") && files.claimRoute.includes("cae.source <> 'jewellink_included'"));
check("standalone conversion is a durable SSO boundary", files.service.includes("linkedNativeAuthEnabled") && files.service.includes("native_auth_enabled = false or $6::boolean") && files.auth.includes("identity.native_auth_enabled && !isConfiguredAdmin"));
check("standalone conversion changes ownership only inside the claim company", files.password.includes("update store_users membership") && files.password.includes("update store_user_location_scopes scope") && files.password.includes("membership_store.company_id = $2") && files.password.includes("set source = 'manual'"));
check("native-auth backfill fails closed without timestamp inference", files.nativePolicyMigration.includes("set native_auth_enabled = false") && files.nativePolicyMigration.includes("explicit, audited post-migration action") && !files.nativePolicyMigration.includes("password_credentials"));
check("account claims carry durable company authority and enforce one outstanding token", files.nativePolicyMigration.includes("add column if not exists company_id") && files.nativePolicyMigration.includes("auth_action_tokens_one_outstanding_uidx") && files.actionTokens.includes("company_id") && files.actionTokens.includes("select id from users where id = $1 for update"));
check("native company users require a current paid or contract entitlement", files.auth.includes("nativeIdentityAccessAllowed") && files.auth.includes("standaloneCompanyAccessAllowed"));
check("account-claim redemption is atomic, audited, revokes password resets, and leaves denied links unconsumed", files.accountClaim.includes("findActionTokenSubject") && !files.accountClaim.includes("consumeActionToken") && files.password.includes("for update of token") && files.password.includes("Claimed retained account access") && files.password.includes("purpose = 'password_reset'") && files.password.includes("update auth_action_tokens") && files.password.indexOf("update auth_action_tokens") < files.password.indexOf('client.query("commit")'));
check("SSO provisioning rejects unrelated email collisions", files.service.includes("jewelLinkIdentityProvisionAction") && !files.service.includes("on conflict (email_normalized)"));
check("Student and Consultant do not receive store membership", files.service.includes('if (role === "MANAGER")') && !files.service.includes('role === "STUDENT"'));
check("Manager maps to manager", files.service.includes('if (role === "MANAGER") return "manager"'));
check("Director mapping is configurable", files.service.includes("JEWELHIRE_JEWELLINK_DIRECTOR_ROLE"));
check("JewelLink entitlement is organization-level and free", files.service.includes("'jewellink_included', 'jewellink_free', 'active', 0"));
check("JewelLink user identity is stable and unique", files.migration.includes("users_jewellink_user_id_uidx"));
check("JewelLink-managed memberships can be revoked on role change", files.migration.includes("source in ('manual', 'jewellink')") && files.service.includes("status = 'inactive'"));
check("Super Admin can send a retained-account claim link", files.claimRoute.includes('requireAdminAccess("admin.company_users.send_claim")') && files.companyPage.includes("Send access link"));
check("Recovery claim issuance is serialized, company-bound, and rolls back only its replacement on failed delivery", files.claimRoute.includes("withReplacingActionToken") && files.claimRoute.includes("companyId: params.id") && !files.claimRoute.includes("invalidateActionTokens") && files.actionTokens.includes('outcome.commit ? "commit" : "rollback"') && files.storeSignup.includes("withReplacingActionToken") && files.storeSignup.includes("companyId"));
check("Recovery email explains retained data and avoids duplicates", files.notifications.includes("data is still safely retained") && files.notifications.includes("does not create a new company or duplicate your data"));
check("SSO store shell uses the provisioned organization and user identity", files.storeLayout.includes("getStoreShellIdentity") && files.topbar.includes("{storeLabel}") && files.topbar.includes("{userInitials}"));
check("PostgreSQL store identity does not fall back to demo branding", files.storeIdentity.includes("from stores s") && files.storeIdentity.includes("from locations") && !files.topbar.includes("Sissy&apos;s Log Cabin"));

process.exitCode = failures ? 1 : 0;
