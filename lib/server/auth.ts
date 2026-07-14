import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/server/postgres";
import {
  resolveSessionAccess,
  type AuthRole,
  type StoreLocationScope,
  type StoreMembershipRole,
} from "@/lib/auth-role-model";
import {
  entitledStandaloneStoreMemberships,
  nativeAuthAllowed,
  standaloneCompanyAccessAllowed,
  validJewelLinkAccessFingerprint,
  validateJewelLinkAssurance,
  type JewelLinkUpstreamAssurance,
} from "@/lib/server/jewellink-sso-contract";
import { introspectJewelLinkSession } from "@/lib/server/jewellink-session-introspection";

export const SESSION_COOKIE = "jewelhire_session";
export const OAUTH_STATE_COOKIE = "jewelhire_oauth_state";
export const OAUTH_NEXT_COOKIE = "jewelhire_oauth_next";
export const JEWELLINK_STATE_COOKIE = "jewelhire_jewellink_state";
const JEWELLINK_HOST_STATE_COOKIE = "__Host-jewelhire_jewellink_state";

export function jewelLinkStateCookieName() {
  return process.env.NODE_ENV === "production" ? JEWELLINK_HOST_STATE_COOKIE : JEWELLINK_STATE_COOKIE;
}

export function jewelLinkStateCookieSecure() {
  return process.env.NODE_ENV === "production";
}

export type { AuthRole, StoreLocationScope, StoreMembershipRole } from "@/lib/auth-role-model";

export type AuthSession = {
  version: 3;
  userId: string;
  name: string;
  email: string;
  role: AuthRole;
  storeIds: string[];
  storeRoles: Record<string, StoreMembershipRole>;
  locationScopes: Record<string, StoreLocationScope>;
  activeStoreId: string;
  authSource: "native" | "jewellink_sso";
  // Present only on native sessions. Credential replacement increments the
  // durable users.native_auth_epoch value so older signed cookies fail on the
  // next request even when their cryptographic signature and expiry are valid.
  nativeAuthEpoch?: number;
  upstreamAssurance?: JewelLinkUpstreamAssurance & { userId: string; accessFingerprint: string };
  exp: number;
  guardrails: {
    phase: "phase_1_single_store";
    applicantScope: "store_private";
    marketplace: false;
    candidateReviews: false;
  };
};

export class UnauthenticatedError extends Error {
  constructor(message = "Sign in required.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export function authRequired() {
  if (process.env.JEWELHIRE_REQUIRE_AUTH === "0") return false;
  return process.env.JEWELHIRE_REQUIRE_AUTH === "1" || process.env.AUTH_MODE === "google";
}

export function googleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function randomState() {
  return randomBytes(32).toString("base64url");
}

export function authSecret() {
  const value = process.env.AUTH_SECRET || "";
  if (!value && authRequired()) throw new Error("AUTH_SECRET is not configured.");
  return value || "dev-only-jewelhire-auth-secret";
}

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// Single place that decides session-cookie flags, so lifetime/SameSite/secure
// can't drift across the many auth routes that log a user in.
export function setSessionCookie(response: NextResponse, session: AuthSession) {
  const remainingLifetime = Math.max(0, session.exp - Math.floor(Date.now() / 1000));
  response.cookies.set(SESSION_COOKIE, createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.min(SESSION_MAX_AGE_SECONDS, remainingLifetime),
  });
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function sign(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("base64url");
}

export function createSessionToken(session: AuthSession) {
  const payload = encode(session);
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token?: string | null): AuthSession | undefined {
  if (!token) return undefined;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return undefined;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
  let session: AuthSession;
  try {
    session = decode<AuthSession>(payload);
  } catch {
    return undefined;
  }
  // Version 3 records the authentication source and invalidates older cookies
  // that cannot distinguish a native login from MFA-backed JewelLink SSO.
  if (session.version !== 3 || !session.storeRoles || !session.locationScopes) return undefined;
  if (session.authSource !== "native" && session.authSource !== "jewellink_sso") return undefined;
  if (!session.exp || session.exp * 1000 < Date.now()) return undefined;
  if (session.authSource === "jewellink_sso") {
    if (session.nativeAuthEpoch !== undefined) return undefined;
    if (
      !session.upstreamAssurance?.userId
      || !validJewelLinkAccessFingerprint(session.upstreamAssurance.accessFingerprint)
    ) return undefined;
    const assurance = validateJewelLinkAssurance(session.upstreamAssurance);
    if (!assurance.ok || session.exp > assurance.sessionExpiresAt) return undefined;
  } else {
    // Requiring the epoch also invalidates every native cookie minted before
    // migration 0021 without changing JewelLink SSO cookie semantics.
    if (
      typeof session.nativeAuthEpoch !== "number"
      || !Number.isSafeInteger(session.nativeAuthEpoch)
      || session.nativeAuthEpoch < 0
    ) return undefined;
    if (session.upstreamAssurance) return undefined;
  }
  return session;
}

export async function readSessionCookie() {
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

function adminEmailSet() {
  return new Set(
    (process.env.JEWELHIRE_ADMIN_EMAILS || process.env.AUTH_ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

// A configured platform-admin email resolves to role='admin' only inside
// findJewelLinkSession after MFA-backed upstream authentication. Every native
// entry point must refuse these emails even when a legacy row or password exists.
export function isConfiguredAdminEmail(email: string) {
  return adminEmailSet().has(email.trim().toLowerCase());
}

function guardrails(): AuthSession["guardrails"] {
  return {
    phase: "phase_1_single_store",
    applicantScope: "store_private",
    marketplace: false,
    candidateReviews: false,
  };
}

async function allStoreIds() {
  const result = await getPostgresPool().query<{ id: string }>("select id from stores where status = 'active' order by id");
  return result.rows.map((row) => row.id);
}

type NativeSessionInput = {
  email: string;
  name?: string | null;
  expiresAt: number;
  expectedUserId?: string;
  expectedNativeAuthEpoch?: number;
};

async function findNativeSession(input: NativeSessionInput): Promise<AuthSession | undefined> {
  const email = input.email.trim().toLowerCase();
  if (!email || input.expiresAt * 1000 <= Date.now()) return undefined;
  const admins = adminEmailSet();
  const isConfiguredAdmin = admins.has(email);
  if (isConfiguredAdmin) return undefined;
  const result = await getPostgresPool().query<{
    id: string;
    email: string;
    name: string;
    membership_store_id: string | null;
    store_id: string | null;
    store_role: string | null;
    all_locations: boolean | null;
    location_ids: string[] | null;
    native_auth_enabled: boolean;
    native_auth_epoch: number;
    storeCompanyId: string | null;
    storeCompanyStatus: string | null;
    storeEntitlementSource: string | null;
    storeEntitlementStatus: string | null;
    storeEntitlementExpiresAt: Date | string | null;
    storeSubscriptionStatus: string | null;
    storeSubscriptionExpiresAt: Date | string | null;
  }>(
    `
      select
        u.id,
        u.email,
        u.name,
        su.store_id as membership_store_id,
        s.id as store_id,
        su.role as store_role,
        su.all_locations,
        u.native_auth_enabled,
        u.native_auth_epoch,
        c.id as "storeCompanyId",
        c.status as "storeCompanyStatus",
        cae.source as "storeEntitlementSource",
        cae.status as "storeEntitlementStatus",
        cae.expires_at as "storeEntitlementExpiresAt",
        sub.status as "storeSubscriptionStatus",
        sub.current_period_end as "storeSubscriptionExpiresAt",
        coalesce(
          array_agg(suls.location_id) filter (where suls.location_id is not null),
          array[]::text[]
        ) as location_ids
      from users u
      left join store_users su on su.user_id = u.id and su.status = 'active'
      left join stores s on s.id = su.store_id and s.status = 'active'
      left join companies c on c.id = s.company_id
      left join company_access_entitlements cae on cae.company_id = c.id
      left join subscriptions sub on sub.company_id = c.id
      left join store_user_location_scopes suls on suls.store_user_id = su.id
      where u.email_normalized = $1 and u.status = 'active'
      group by
        u.id, u.email, u.name, u.native_auth_enabled, u.native_auth_epoch,
        s.id, su.store_id, su.role, su.all_locations, su.created_at,
        c.id, c.status,
        cae.source, cae.status, cae.expires_at,
        sub.status, sub.current_period_end
      order by su.created_at asc
    `,
    [email],
  );

  if (!result.rows.length) return undefined;

  const first = result.rows[0];
  if (!first) return undefined;
  if (input.expectedUserId && first.id !== input.expectedUserId) return undefined;
  if (!Number.isSafeInteger(first.native_auth_epoch) || first.native_auth_epoch < 0) return undefined;
  if (
    input.expectedNativeAuthEpoch !== undefined
    && first.native_auth_epoch !== input.expectedNativeAuthEpoch
  ) return undefined;
  if (first && !nativeAuthAllowed({ nativeAuthEnabled: first.native_auth_enabled, isPlatformAdmin: isConfiguredAdmin })) {
    return undefined;
  }
  const membershipRows = result.rows.filter((row): row is typeof row & { store_id: string; storeCompanyId: string } =>
    Boolean(row.store_id && row.storeCompanyId));
  const entitledMembershipRows = entitledStandaloneStoreMemberships(
    membershipRows.map((row) => ({ ...row, storeId: row.store_id })),
  );
  // A company user with only canceled/paused memberships cannot fall through to
  // an applicant session. A genuine companyless applicant has no membership and
  // is checked by nativeIdentityAccessAllowed below.
  const hasActiveMembershipRecord = result.rows.some((row) => Boolean(row.membership_store_id));
  if (hasActiveMembershipRecord && entitledMembershipRows.length === 0) return undefined;
  if (!hasActiveMembershipRecord && first && !(await nativeIdentityAccessAllowed(first.id, email))) return undefined;
  const storeIds = entitledMembershipRows.map((row) => row.store_id);
  // `store_users.role = admin` is an organization/store administrator, never a
  // JewelHire platform administrator. Only the explicit server-side allowlist
  // can mint the platform `admin` role.
  const access = resolveSessionAccess({
    isPlatformAdmin: false,
    storeIds,
    memberships: entitledMembershipRows
      .map((row) => ({
        storeId: row.store_id,
        storeRole: row.store_role,
        allLocations: row.all_locations,
        locationIds: row.location_ids,
      })),
  });
  return {
    version: 3,
    userId: first.id,
    name: first.name || input.name || email,
    email: first.email,
    role: access.role,
    storeIds,
    storeRoles: access.storeRoles,
    locationScopes: access.locationScopes,
    activeStoreId: storeIds[0] || "",
    authSource: "native",
    nativeAuthEpoch: first.native_auth_epoch,
    exp: input.expiresAt,
    guardrails: guardrails(),
  };
}

export async function findSessionForGoogleUser(input: { email: string; name?: string | null }): Promise<AuthSession | undefined> {
  return findNativeSession({
    ...input,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  });
}

// Password login binds the second authorization lookup to the exact epoch that
// accompanied the credential it verified. If a reset commits while scrypt is
// running, the old password cannot mint a session carrying the newer epoch.
export async function findSessionForVerifiedNativeCredential(input: {
  email: string;
  name?: string | null;
  userId: string;
  nativeAuthEpoch: number;
}): Promise<AuthSession | undefined> {
  if (!Number.isSafeInteger(input.nativeAuthEpoch) || input.nativeAuthEpoch < 0) return undefined;
  return findNativeSession({
    email: input.email,
    name: input.name,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    expectedUserId: input.userId,
    expectedNativeAuthEpoch: input.nativeAuthEpoch,
  });
}

export async function isJewelLinkSsoOnlyEmail(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  if (!email) return false;
  if (isConfiguredAdminEmail(email)) return true;
  const result = await getPostgresPool().query<{ sso_only: boolean }>(
    `select (jewellink_user_id is not null and native_auth_enabled = false) as sso_only
     from users
     where email_normalized = $1 and status = 'active'
     limit 1`,
    [email],
  );
  return result.rows[0]?.sso_only === true;
}

export async function revalidateNativeSession(session: AuthSession) {
  if (session.authSource !== "native") return undefined;
  if (
    typeof session.nativeAuthEpoch !== "number"
    || !Number.isSafeInteger(session.nativeAuthEpoch)
    || session.nativeAuthEpoch < 0
  ) return undefined;
  const configuredAdmin = isConfiguredAdminEmail(session.email);
  if (configuredAdmin || session.role === "admin") return undefined;

  // Rebuild, rather than merely accepting, the authorization payload. This
  // immediately removes inactive memberships and paused/archived stores from a
  // still-valid native cookie while preserving the explicit admin allowlist.
  const refreshed = await findNativeSession({
    email: session.email,
    name: session.name,
    expiresAt: session.exp,
    expectedUserId: session.userId,
    expectedNativeAuthEpoch: session.nativeAuthEpoch,
  });
  return refreshed;
}

async function nativeIdentityAccessAllowed(userId: string, email: string) {
  const result = await getPostgresPool().query<{
    native_auth_enabled: boolean;
    company_id: string | null;
    company_status: string | null;
    entitlement_source: string | null;
    entitlement_status: string | null;
    entitlement_expires_at: Date | string | null;
    subscription_status: string | null;
    subscription_expires_at: Date | string | null;
  }>(
    `
      select
        u.native_auth_enabled,
        u.company_id,
        c.status as company_status,
        cae.source as entitlement_source,
        cae.status as entitlement_status,
        cae.expires_at as entitlement_expires_at,
        sub.status as subscription_status,
        sub.current_period_end as subscription_expires_at
      from users u
      left join companies c on c.id = u.company_id
      left join company_access_entitlements cae on cae.company_id = u.company_id
      left join subscriptions sub on sub.company_id = u.company_id
      where u.id = $1 and u.email_normalized = $2 and u.status = 'active'
      limit 1
    `,
    [userId, email],
  );
  const identity = result.rows[0];
  return Boolean(identity?.native_auth_enabled && standaloneCompanyAccessAllowed({
    companyId: identity.company_id,
    companyStatus: identity.company_status,
    entitlementSource: identity.entitlement_source,
    entitlementStatus: identity.entitlement_status,
    entitlementExpiresAt: identity.entitlement_expires_at,
    subscriptionStatus: identity.subscription_status,
    subscriptionExpiresAt: identity.subscription_expires_at,
  }));
}

type JewelLinkSessionInput = {
  localUserId: string;
  upstreamUserId: string;
  accessFingerprint: string;
  assurance: JewelLinkUpstreamAssurance;
  expiresAt: number;
};

export async function findJewelLinkSession(input: JewelLinkSessionInput): Promise<AuthSession | undefined> {
  const assurance = validateJewelLinkAssurance(input.assurance);
  if (
    !assurance.ok
    || !validJewelLinkAccessFingerprint(input.accessFingerprint)
    || input.expiresAt > assurance.sessionExpiresAt
    || input.expiresAt * 1000 <= Date.now()
  ) return undefined;
  const pool = getPostgresPool();
  const identityResult = await pool.query<{
    id: string;
    email: string;
    name: string;
    company_id: string | null;
    company_status: string | null;
    entitlement_source: string | null;
    entitlement_status: string | null;
    entitlement_expires_at: Date | string | null;
    subscription_status: string | null;
    subscription_expires_at: Date | string | null;
    native_auth_enabled: boolean;
  }>(
    `
      select
        u.id,
        u.email,
        u.name,
        u.company_id,
        c.status as company_status,
        cae.source as entitlement_source,
        cae.status as entitlement_status,
        cae.expires_at as entitlement_expires_at,
        sub.status as subscription_status,
        sub.current_period_end as subscription_expires_at,
        u.native_auth_enabled
      from users u
      left join companies c on c.id = u.company_id
      left join company_access_entitlements cae on cae.company_id = u.company_id
      left join subscriptions sub on sub.company_id = u.company_id
      where u.id = $1
        and u.jewellink_user_id = $2
        and u.status = 'active'
      limit 1
    `,
    [input.localUserId, input.upstreamUserId],
  );
  const identity = identityResult.rows[0];
  if (!identity) return undefined;

  const isConfiguredAdmin = isConfiguredAdminEmail(identity.email);
  if (identity.native_auth_enabled && !isConfiguredAdmin) return undefined;
  if (!isConfiguredAdmin && identity.company_id) {
    const entitlementExpiry = identity.entitlement_expires_at ? new Date(identity.entitlement_expires_at).getTime() : undefined;
    const subscriptionExpiry = identity.subscription_expires_at ? new Date(identity.subscription_expires_at).getTime() : undefined;
    const directEntitlementActive = identity.entitlement_status === "active" &&
      (entitlementExpiry === undefined || entitlementExpiry > Date.now());
    const subscriptionActive = (identity.subscription_status === "active" || identity.subscription_status === "trialing") &&
      (subscriptionExpiry === undefined || subscriptionExpiry > Date.now());
    const entitled = identity.company_status === "active" &&
      ((Boolean(identity.entitlement_source) && directEntitlementActive) || subscriptionActive);
    if (!entitled) return undefined;
  }

  const memberships = await pool.query<{
    store_id: string | null;
    store_role: string | null;
    all_locations: boolean | null;
    location_ids: string[] | null;
  }>(
    `
      select
        s.id as store_id,
        su.role as store_role,
        su.all_locations,
        coalesce(
          array_agg(suls.location_id) filter (where suls.location_id is not null),
          array[]::text[]
        ) as location_ids
      from users u
      left join store_users su
        on su.user_id = u.id and su.status = 'active' and su.source = 'jewellink'
      left join stores s
        on s.id = su.store_id
       and s.status = 'active'
       and s.company_id = $2
      left join store_user_location_scopes suls
        on suls.store_user_id = su.id
       and suls.source = 'jewellink'
      where u.id = $1
      group by s.id, su.role, su.all_locations, su.created_at
      order by su.created_at asc
    `,
    [identity.id, identity.company_id],
  );

  const storeIds = isConfiguredAdmin
    ? await allStoreIds()
    : memberships.rows.map((row) => row.store_id).filter((id): id is string => Boolean(id));
  const access = resolveSessionAccess({
    isPlatformAdmin: isConfiguredAdmin,
    storeIds,
    memberships: memberships.rows
      .filter((row): row is typeof row & { store_id: string } => Boolean(row.store_id))
      .map((row) => ({
        storeId: row.store_id,
        storeRole: row.store_role,
        allLocations: row.all_locations,
        locationIds: row.location_ids,
      })),
  });

  return {
    version: 3,
    userId: identity.id,
    name: identity.name,
    email: identity.email,
    role: access.role,
    storeIds,
    storeRoles: access.storeRoles,
    locationScopes: access.locationScopes,
    activeStoreId: storeIds[0] || "",
    authSource: "jewellink_sso",
    upstreamAssurance: {
      ...input.assurance,
      userId: input.upstreamUserId,
      accessFingerprint: input.accessFingerprint,
    },
    exp: input.expiresAt,
    guardrails: guardrails(),
  };
}

const SESSION_ROLE_RANK: Record<AuthRole, number> = {
  associate: 0,
  manager: 1,
  store_owner: 2,
  admin: 3,
};

const STORE_ROLE_RANK: Record<StoreMembershipRole, number> = {
  manager: 0,
  store_owner: 1,
};

function stringSetIsSubset(candidate: readonly string[], ceiling: readonly string[]) {
  const allowed = new Set(ceiling);
  return candidate.every((value) => allowed.has(value));
}

/**
 * A current local projection may narrow a signed JewelLink session, but it may
 * never add authority. The upstream fingerprint proves that JewelLink still
 * approves the original role/company/location snapshot; this comparison keeps
 * mutable JewelHire rows from expanding that snapshot between SSO logins.
 */
export function jewelLinkSessionAccessDoesNotExpand(
  signed: AuthSession,
  current: AuthSession,
) {
  if (signed.authSource !== "jewellink_sso" || current.authSource !== "jewellink_sso") return false;
  if (signed.userId !== current.userId) return false;
  if (signed.email.trim().toLowerCase() !== current.email.trim().toLowerCase()) return false;
  if (!signed.upstreamAssurance || !current.upstreamAssurance) return false;
  if (signed.upstreamAssurance.userId !== current.upstreamAssurance.userId) return false;
  if (signed.upstreamAssurance.upstreamSessionId !== current.upstreamAssurance.upstreamSessionId) return false;
  if (signed.upstreamAssurance.accessFingerprint !== current.upstreamAssurance.accessFingerprint) return false;
  if (SESSION_ROLE_RANK[current.role] > SESSION_ROLE_RANK[signed.role]) return false;
  if (!stringSetIsSubset(current.storeIds, signed.storeIds)) return false;

  for (const storeId of current.storeIds) {
    const currentScope = current.locationScopes[storeId];
    const signedScope = signed.locationScopes[storeId];
    if (!currentScope || !signedScope) return false;
    if (!signedScope.allLocations) {
      if (currentScope.allLocations) return false;
      if (!stringSetIsSubset(currentScope.locationIds, signedScope.locationIds)) return false;
    }

    if (current.role !== "admin") {
      const currentStoreRole = current.storeRoles[storeId];
      const signedStoreRole = signed.role === "admin"
        ? "store_owner"
        : signed.storeRoles[storeId];
      if (!currentStoreRole || !signedStoreRole) return false;
      if (STORE_ROLE_RANK[currentStoreRole] > STORE_ROLE_RANK[signedStoreRole]) return false;
    }
  }

  return !current.activeStoreId || current.storeIds.includes(current.activeStoreId);
}

export async function revalidateJewelLinkSession(session: AuthSession) {
  if (session.authSource !== "jewellink_sso" || !session.upstreamAssurance) return undefined;
  const assurance = validateJewelLinkAssurance(session.upstreamAssurance);
  if (!assurance.ok) return undefined;
  const upstreamActive = await introspectJewelLinkSession({
    userId: session.upstreamAssurance.userId,
    upstreamSessionId: session.upstreamAssurance.upstreamSessionId,
    accessFingerprint: session.upstreamAssurance.accessFingerprint,
  });
  if (!upstreamActive) return undefined;
  const refreshed = await findJewelLinkSession({
    localUserId: session.userId,
    upstreamUserId: session.upstreamAssurance.userId,
    accessFingerprint: session.upstreamAssurance.accessFingerprint,
    assurance: session.upstreamAssurance,
    expiresAt: session.exp,
  });
  if (!refreshed) return undefined;
  if (!jewelLinkSessionAccessDoesNotExpand(session, refreshed)) return undefined;
  if ((session.role === "store_owner" || session.role === "manager") && refreshed.storeIds.length === 0) return undefined;
  return refreshed;
}
