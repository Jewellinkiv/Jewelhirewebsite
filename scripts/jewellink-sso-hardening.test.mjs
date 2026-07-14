import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  entitledStandaloneStoreMemberships,
  JEWELLINK_SSO_MAX_AGE_SECONDS,
  jewelLinkIdentityProvisionAction,
  jewelLinkRoleAllowedForIdentity,
  jewelLinkStateMatches,
  nativeAuthAllowed,
  standaloneClaimEntitlementAllowed,
  standaloneCompanyAccessAllowed,
  validJewelLinkState,
  validateJewelLinkAssurance,
} from "../lib/server/jewellink-sso-contract.ts";
import { safeSameOriginPath, safeSameOriginPathOrRoot } from "../lib/server/safe-redirect.ts";

const now = Date.parse("2026-07-13T18:00:00.000Z");
const state = "launch_state-7K~browser.bound";
const assurance = {
  amr: ["pwd", "mfa"],
  authTime: "2026-07-13T17:00:00.000Z",
  mfaVerifiedAt: "2026-07-13T17:01:00.000Z",
  upstreamSessionId: "jl-session-opaque-123",
};

test("JewelLink callback accepts only URL-safe state bound across URL, claims, and browser cookie", () => {
  assert.equal(validJewelLinkState(state), true);
  assert.equal(jewelLinkStateMatches({ urlState: state, cookieState: state, claimState: state }), true);
  assert.equal(validJewelLinkState("state with spaces"), false);
});

test("cross-browser callback is rejected before code exchange", () => {
  assert.equal(jewelLinkStateMatches({ urlState: state, cookieState: "other-browser-state", claimState: state }), false);
});

test("callback replay is rejected after the state cookie is cleared", () => {
  assert.equal(jewelLinkStateMatches({ urlState: state, cookieState: undefined, claimState: state }), false);
});

test("development launch uses a localhost-compatible cookie and rejects cross-browser/replay callbacks before exchange", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousJewelLinkUrl = process.env.JEWELLINK_URL;
  const previousFetch = globalThis.fetch;
  process.env.NODE_ENV = "development";
  process.env.JEWELLINK_URL = "https://app.jewellink.example";
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("exchange must not run for an unbound callback");
  };

  try {
    const [{ GET: start }, { GET: callback }, auth] = await Promise.all([
      import("../app/api/auth/jewellink/start/route.ts"),
      import("../app/api/auth/jewellink/callback/route.ts"),
      import("../lib/server/auth.ts"),
    ]);
    assert.equal(auth.jewelLinkStateCookieName(), "jewelhire_jewellink_state");
    assert.equal(auth.jewelLinkStateCookieSecure(), false);
    process.env.NODE_ENV = "production";
    assert.equal(auth.jewelLinkStateCookieName(), "__Host-jewelhire_jewellink_state");
    assert.equal(auth.jewelLinkStateCookieSecure(), true);
    process.env.NODE_ENV = "development";
    const launch = start(new Request("http://localhost:3000/api/auth/jewellink/start?next=%2Fjobs"));
    const location = new URL(launch.headers.get("location"));
    const setCookie = launch.headers.get("set-cookie") || "";
    const launchState = location.searchParams.get("state");
    assert.equal(location.pathname, "/integrations/jewelhire/launch");
    assert.equal(location.searchParams.get("returnTo"), "/jobs");
    assert.ok(launchState);
    assert.match(setCookie, /jewelhire_jewellink_state=/);
    assert.doesNotMatch(setCookie, /__Host-/);
    assert.doesNotMatch(setCookie, /; Secure/i);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);

    const encodedBackslashLaunch = start(new Request(
      "http://localhost:3000/api/auth/jewellink/start?next=%2F%255cevil.example",
    ));
    assert.equal(
      new URL(encodedBackslashLaunch.headers.get("location")).searchParams.has("returnTo"),
      false,
    );

    const malformedEncodingLaunch = start(new Request(
      "http://localhost:3000/api/auth/jewellink/start?next=%2Fjobs%25E0%25A4%25A",
    ));
    assert.equal(
      new URL(malformedEncodingLaunch.headers.get("location")).searchParams.has("returnTo"),
      false,
    );

    const crossBrowser = await callback(new Request(
      `http://localhost:3000/api/auth/jewellink/callback?code=one-time&state=${encodeURIComponent(launchState)}`,
      { headers: { cookie: "jewelhire_jewellink_state=another-browser" } },
    ));
    assert.equal(new URL(crossBrowser.headers.get("location")).searchParams.get("error"), "jewellink_state");
    assert.match(crossBrowser.headers.get("set-cookie") || "", /Max-Age=0/);

    const replay = await callback(new Request(
      `http://localhost:3000/api/auth/jewellink/callback?code=one-time&state=${encodeURIComponent(launchState)}`,
    ));
    assert.equal(new URL(replay.headers.get("location")).searchParams.get("error"), "jewellink_state");
    assert.equal(fetchCalls, 0);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousJewelLinkUrl === undefined) delete process.env.JEWELLINK_URL;
    else process.env.JEWELLINK_URL = previousJewelLinkUrl;
    globalThis.fetch = previousFetch;
  }
});

test("Google callback rejects malformed redirect-cookie encoding without throwing", async () => {
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  const previousClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;

  try {
    const [{ GET: callback }, auth] = await Promise.all([
      import("../app/api/auth/google/callback/route.ts"),
      import("../lib/server/auth.ts"),
    ]);
    const response = await callback(new Request(
      "http://localhost:3000/api/auth/google/callback?code=one-time&state=browser-state",
      {
        headers: {
          cookie: `${auth.OAUTH_STATE_COOKIE}=browser-state; ${auth.OAUTH_NEXT_COOKIE}=%E0%A4%A`,
        },
      },
    ));
    assert.equal(new URL(response.headers.get("location")).searchParams.get("error"), "config");
  } finally {
    if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousClientId;
    if (previousClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = previousClientSecret;
  }
});

test("MFA assurance is mandatory and cannot be stale or future-dated", () => {
  assert.equal(validateJewelLinkAssurance(assurance, now).ok, true);
  assert.equal(validateJewelLinkAssurance({ ...assurance, amr: ["pwd"] }, now).ok, false);
  assert.equal(validateJewelLinkAssurance({ ...assurance, amr: ["mfa"] }, now).ok, false);
  assert.equal(validateJewelLinkAssurance({ ...assurance, amr: ["PWD", "MFA"] }, now).ok, true);
  assert.equal(validateJewelLinkAssurance({ ...assurance, amr: ["pwd", "mfa", "mfa"] }, now).ok, false);
  assert.equal(validateJewelLinkAssurance({ ...assurance, amr: ["pwd", "mfa", "otp"] }, now).ok, false);
  assert.equal(validateJewelLinkAssurance({
    ...assurance,
    authTime: "2026-07-13T09:59:59.000Z",
    mfaVerifiedAt: "2026-07-13T10:00:00.000Z",
  }, now).ok, false);
  assert.equal(validateJewelLinkAssurance({ ...assurance, authTime: "2026-07-13T18:02:00.000Z" }, now).ok, false);
});

test("SSO session lifetime is capped at eight hours from upstream authentication", () => {
  const result = validateJewelLinkAssurance(assurance, now);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.sessionExpiresAt, Math.floor(Date.parse(assurance.authTime) / 1000) + JEWELLINK_SSO_MAX_AGE_SECONDS);
  assert.ok(result.sessionExpiresAt <= Math.floor(now / 1000) + JEWELLINK_SSO_MAX_AGE_SECONDS);
});

test("signed SSO cookie lifetime follows the upstream assurance expiry", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-only-jewelhire-session-secret";
  try {
    const [{ NextResponse }, auth] = await Promise.all([
      import("next/server"),
      import("../lib/server/auth.ts"),
    ]);
    const issuedAt = Date.now();
    const authTime = new Date(issuedAt - 60_000).toISOString();
    const mfaVerifiedAt = new Date(issuedAt - 30_000).toISOString();
    const validated = validateJewelLinkAssurance({ ...assurance, authTime, mfaVerifiedAt }, issuedAt);
    assert.equal(validated.ok, true);
    if (!validated.ok) return;
    const session = {
      version: 3,
      userId: "user-linked",
      name: "Linked User",
      email: "linked@example.com",
      role: "associate",
      storeIds: [],
      storeRoles: {},
      locationScopes: {},
      activeStoreId: "",
      authSource: "jewellink_sso",
      upstreamAssurance: { ...validated.assurance, userId: "jl-user-1" },
      exp: validated.sessionExpiresAt,
      guardrails: {
        phase: "phase_1_single_store",
        applicantScope: "store_private",
        marketplace: false,
        candidateReviews: false,
      },
    };
    const response = NextResponse.json({ ok: true });
    auth.setSessionCookie(response, session);
    const setCookie = response.headers.get("set-cookie") || "";
    const maxAge = Number(setCookie.match(/Max-Age=(\d+)/i)?.[1]);
    assert.ok(maxAge > 0 && maxAge <= JEWELLINK_SSO_MAX_AGE_SECONDS);
    const token = setCookie.match(/jewelhire_session=([^;]+)/)?.[1];
    assert.equal(auth.readSessionToken(token)?.authSource, "jewellink_sso");
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("linked identities and platform admins deny native login while standalone users remain accepted", () => {
  assert.equal(nativeAuthAllowed({ nativeAuthEnabled: false, isPlatformAdmin: false }), false);
  assert.equal(nativeAuthAllowed({ nativeAuthEnabled: true, isPlatformAdmin: false }), true);
  assert.equal(nativeAuthAllowed({ nativeAuthEnabled: false, isPlatformAdmin: true }), false);
  assert.equal(nativeAuthAllowed({ nativeAuthEnabled: true, isPlatformAdmin: true }), false);
});

test("JewelLink SSO accepts only the exact role contract and independently allowlists SUPER_ADMIN", () => {
  assert.equal(jewelLinkRoleAllowedForIdentity({ role: "SUPER_ADMIN", isPlatformAdmin: false }), false);
  assert.equal(jewelLinkRoleAllowedForIdentity({ role: "SUPER_ADMIN", isPlatformAdmin: true }), true);
  for (const role of ["ADMIN", "DIRECTOR", "MANAGER", "CONSULTANT", "STUDENT"]) {
    assert.equal(jewelLinkRoleAllowedForIdentity({ role, isPlatformAdmin: false }), true);
  }
  for (const role of ["TEACHER", "VENDOR", "", "manager", " DIRECTOR"] ) {
    assert.equal(jewelLinkRoleAllowedForIdentity({ role, isPlatformAdmin: true }), false);
  }
});

test("all auth entry points share strict same-origin redirect validation", () => {
  assert.equal(safeSameOriginPath("/jobs?query=bench%20jeweler"), "/jobs?query=bench%20jeweler");
  assert.equal(safeSameOriginPath("//evil.example"), undefined);
  assert.equal(safeSameOriginPath("/\\evil.example"), undefined);
  assert.equal(safeSameOriginPath("/%5cevil.example"), undefined);
  assert.equal(safeSameOriginPath("/%2f%2fevil.example"), undefined);
  assert.equal(safeSameOriginPath("/jobs%0d%0aX-Test:yes"), undefined);
  assert.equal(safeSameOriginPath("/jobs%E0%A4%A"), undefined);
  assert.equal(safeSameOriginPathOrRoot("https://evil.example"), "/");
});

test("SSO provisioning rejects unrelated email collisions and only updates its stable upstream subject", () => {
  assert.equal(jewelLinkIdentityProvisionAction({}), "insert");
  assert.equal(jewelLinkIdentityProvisionAction({ linkedUserId: "linked-1", emailUserId: "linked-1" }), "update");
  assert.equal(jewelLinkIdentityProvisionAction({
    linkedUserId: "linked-1",
    emailUserId: "linked-1",
    linkedNativeAuthEnabled: true,
  }), "conflict");
  assert.equal(jewelLinkIdentityProvisionAction({ emailUserId: "standalone-1" }), "conflict");
  assert.equal(jewelLinkIdentityProvisionAction({ linkedUserId: "linked-1", emailUserId: "standalone-2" }), "conflict");
});

test("claim conversion requires a current non-JewelLink entitlement", () => {
  assert.equal(standaloneClaimEntitlementAllowed({ source: "stripe", status: "active" }, now), true);
  assert.equal(standaloneClaimEntitlementAllowed({ source: "contract", status: "active", expiresAt: "2026-07-14T00:00:00.000Z" }, now), true);
  assert.equal(standaloneClaimEntitlementAllowed({ source: "jewellink_included", status: "active" }, now), false);
  assert.equal(standaloneClaimEntitlementAllowed({ source: "stripe", status: "cancelled" }, now), false);
  assert.equal(standaloneClaimEntitlementAllowed({ source: "contract", status: "active", expiresAt: "2026-07-13T17:59:59.000Z" }, now), false);
});

test("company native access accepts live paid subscriptions, preserves applicants, and rejects paused or expired access", () => {
  assert.equal(standaloneCompanyAccessAllowed({ companyId: null, companyStatus: null }, now), true);
  assert.equal(standaloneCompanyAccessAllowed({
    companyId: "company-1",
    companyStatus: "active",
    subscriptionStatus: "active",
    subscriptionExpiresAt: "2026-08-01T00:00:00.000Z",
  }, now), true);
  assert.equal(standaloneCompanyAccessAllowed({
    companyId: "company-1",
    companyStatus: "paused",
    subscriptionStatus: "active",
  }, now), false);
  assert.equal(standaloneCompanyAccessAllowed({
    companyId: "company-1",
    companyStatus: "active",
    subscriptionStatus: "active",
    subscriptionExpiresAt: "2026-07-13T17:59:59.000Z",
  }, now), false);
  assert.equal(standaloneCompanyAccessAllowed({
    companyId: "company-1",
    companyStatus: "active",
    entitlementSource: "jewellink_included",
    entitlementStatus: "active",
  }, now), false);
});

test("native store access is filtered by each membership company rather than the user's primary company", () => {
  const memberships = [
    {
      storeId: "store-cancelled-primary",
      storeCompanyId: "company-cancelled-primary",
      storeCompanyStatus: "cancelled",
      storeSubscriptionStatus: "active",
    },
    {
      storeId: "store-active-secondary",
      storeCompanyId: "company-active-secondary",
      storeCompanyStatus: "active",
      storeSubscriptionStatus: "active",
      storeSubscriptionExpiresAt: "2026-08-01T00:00:00.000Z",
    },
    {
      storeId: "store-jewellink-only",
      storeCompanyId: "company-jewellink-only",
      storeCompanyStatus: "active",
      storeEntitlementSource: "jewellink_included",
      storeEntitlementStatus: "active",
    },
  ];
  assert.deepEqual(
    entitledStandaloneStoreMemberships(memberships, now).map((membership) => membership.storeId),
    ["store-active-secondary"],
  );
});

test("native session mint and revalidation rebuild authorization from active stores and memberships", () => {
  const auth = fs.readFileSync(new URL("../lib/server/auth.ts", import.meta.url), "utf8");
  const revalidation = auth.slice(
    auth.indexOf("export async function revalidateNativeSession"),
    auth.indexOf("async function nativeIdentityAccessAllowed"),
  );
  assert.match(auth, /left join store_users su on su\.user_id = u\.id and su\.status = 'active'/);
  assert.match(auth, /left join stores s on s\.id = su\.store_id and s\.status = 'active'/);
  assert.match(revalidation, /const refreshed = await findNativeSession/);
  assert.doesNotMatch(revalidation, /return allowed \? session/);
});

test("standalone conversion retains audit identity but blocks SSO and converts active membership ownership", () => {
  const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const auth = read("lib/server/auth.ts");
  const service = read("lib/server/jewellink-sso.ts");
  const password = read("lib/server/password-auth.ts");

  assert.match(service, /linkedNativeAuthEnabled: isPlatformAdmin \? false : linkedUser\.rows\[0\]\?\.native_auth_enabled/);
  assert.match(service, /jewellink_user_id = \$5\s+and \(native_auth_enabled = false or \$6::boolean\)/);
  assert.match(service, /jewellink_user_id = \$5, native_auth_enabled = false/);
  assert.match(auth, /identity\.native_auth_enabled && !isConfiguredAdmin/);
  assert.match(password, /update store_users membership\s+set source = 'manual'/);
  assert.match(password, /update store_user_location_scopes scope\s+set source = 'manual'/);
  assert.match(password, /membership_store\.company_id = \$2/);
  assert.match(password, /token\.company_id/);
  assert.match(password, /Claimed retained account access/);
  assert.doesNotMatch(password, /set jewellink_user_id = null/);
});

test("native-auth migration fails closed for every preexisting JewelLink identity", () => {
  const migration = fs.readFileSync(new URL("../db/migrations/0019_jewellink_native_auth_policy.sql", import.meta.url), "utf8");
  assert.match(migration, /set native_auth_enabled = false/);
  assert.match(migration, /explicit, audited post-migration action/);
  assert.match(migration, /add column if not exists company_id/);
  assert.match(migration, /auth_action_tokens_one_outstanding_uidx/);
  assert.match(migration, /purpose <> 'account_claim' or company_id is not null or used_at is not null/);
  assert.doesNotMatch(migration, /password_credentials|interval '5 minutes'/);
});

test("routes enforce linked-account denial, callback ordering, cookie clearing, and request-time revocation", () => {
  const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const callback = read("app/api/auth/jewellink/callback/route.ts");
  const password = read("lib/server/password-auth.ts");
  const reset = read("app/api/auth/password/reset/route.ts");
  const resetRequest = read("app/api/auth/password/reset-request/route.ts");
  const accountClaim = read("app/api/auth/account-claim/route.ts");
  const claimLinks = read("app/api/admin/companies/[id]/claim-links/route.ts");
  const google = read("app/api/auth/google/callback/route.ts");
  const firebase = read("app/api/auth/firebase/session/route.ts");
  const jewelLinkStart = read("app/api/auth/jewellink/start/route.ts");
  const googleStart = read("app/api/auth/google/start/route.ts");
  const passwordRoute = read("app/api/auth/password/session/route.ts");
  const service = read("lib/server/jewellink-sso.ts");
  const access = read("lib/server/access-control.ts");
  const auth = read("lib/server/auth.ts");
  const actionTokens = read("lib/server/action-tokens.ts");
  const storeSignup = read("lib/server/store-signup.ts");

  assert.ok(callback.indexOf("stateCookie") < callback.indexOf("exchangeJewelLinkCode(code)"));
  assert.match(callback, /return clearState\(response\)/);
  assert.match(password, /native_auth_enabled/);
  assert.match(password, /sub\.status in \('active', 'trialing'\)/);
  assert.match(reset, /nativeAuthEnabledForUser/);
  assert.match(resetRequest, /findActiveUserByEmail/);
  assert.match(accountClaim, /isConfiguredAdminEmail\(claim\.email\)/);
  assert.match(accountClaim, /findActionTokenSubject/);
  assert.doesNotMatch(accountClaim, /consumeActionToken/);
  assert.match(claimLinks, /isConfiguredAdminEmail\(owner\.email\)/);
  assert.match(claimLinks, /withReplacingActionToken/);
  assert.match(claimLinks, /attemptBestEffortTransactionOperation/);
  assert.match(claimLinks, /companyId: params\.id/);
  assert.doesNotMatch(claimLinks, /invalidateActionTokens/);
  assert.match(actionTokens, /select id from users where id = \$1 for update/);
  assert.match(actionTokens, /savepoint best_effort_transaction_operation/);
  assert.match(actionTokens, /outcome\.commit \? "commit" : "rollback"/);
  assert.match(actionTokens, /settlement\.command !== expectedCommand/);
  assert.match(actionTokens, /company_id/);
  assert.match(storeSignup, /withReplacingActionToken/);
  assert.match(storeSignup, /companyId/);
  assert.match(google, /isJewelLinkSsoOnlyEmail/);
  assert.match(firebase, /jewellink_required/);
  assert.match(auth, /if \(isConfiguredAdmin\) return undefined/);
  assert.match(auth, /if \(isConfiguredAdminEmail\(email\)\) return true/);
  assert.match(auth, /if \(configuredAdmin \|\| session\.role === "admin"\) return undefined/);
  assert.match(service, /canAdoptAllowlistedAdmin/);
  assert.match(jewelLinkStart, /safeSameOriginPath/);
  assert.match(googleStart, /safeSameOriginPathOrRoot/);
  assert.match(google, /safeSameOriginPathOrRoot/);
  assert.match(passwordRoute, /safeSameOriginPathOrRoot/);
  assert.match(firebase, /safeSameOriginPathOrRoot/);
  assert.match(service, /safeSameOriginPath\(body\.claims\.returnTo\)/);
  assert.match(access, /revalidateJewelLinkSession/);
  assert.match(access, /revalidateNativeSession/);
  assert.match(auth, /company_status === "active"/);
  assert.match(auth, /entitlement_status === "active"/);
  assert.match(auth, /nativeIdentityAccessAllowed/);
  assert.match(auth, /__Host-jewelhire_jewellink_state/);
  assert.match(auth, /process\.env\.NODE_ENV === "production" \? JEWELLINK_HOST_STATE_COOKIE/);
  assert.match(auth, /Math\.min\(SESSION_MAX_AGE_SECONDS, remainingLifetime\)/);
  assert.doesNotMatch(service, /do update set name = excluded\.name, status = 'active'/);
  assert.match(service, /on conflict \(company_id\) do nothing/);
  assert.match(service, /jewelLinkRoleAllowedForIdentity/);

  const atomicClaim = password.slice(
    password.indexOf("export async function completeStandaloneAccountClaim"),
    password.indexOf("export async function hashPassword"),
  );
  assert.ok(atomicClaim.indexOf('client.query("begin")') < atomicClaim.indexOf("from users"));
  assert.ok(atomicClaim.indexOf("from users") < atomicClaim.indexOf("for update of token"));
  assert.ok(atomicClaim.indexOf("for update of token") < atomicClaim.indexOf("set native_auth_enabled = true"));
  assert.ok(atomicClaim.indexOf("set native_auth_enabled = true") < atomicClaim.indexOf("insert into password_credentials"));
  assert.ok(atomicClaim.indexOf("insert into password_credentials") < atomicClaim.indexOf("insert into admin_audit_entries"));
  assert.ok(atomicClaim.indexOf("insert into admin_audit_entries") < atomicClaim.indexOf("update auth_action_tokens"));
  assert.match(atomicClaim, /purpose = 'password_reset'/);
  assert.ok(atomicClaim.indexOf("update auth_action_tokens") < atomicClaim.indexOf('client.query("commit")'));
});
