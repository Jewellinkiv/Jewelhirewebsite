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

export const SESSION_COOKIE = "jewelhire_session";
export const OAUTH_STATE_COOKIE = "jewelhire_oauth_state";
export const OAUTH_NEXT_COOKIE = "jewelhire_oauth_next";

export type { AuthRole, StoreLocationScope, StoreMembershipRole } from "@/lib/auth-role-model";

export type AuthSession = {
  version: 2;
  userId: string;
  name: string;
  email: string;
  role: AuthRole;
  storeIds: string[];
  storeRoles: Record<string, StoreMembershipRole>;
  locationScopes: Record<string, StoreLocationScope>;
  activeStoreId: string;
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
  return randomBytes(24).toString("base64url");
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
  response.cookies.set(SESSION_COOKIE, createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
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
  const session = decode<AuthSession>(payload);
  // Version 2 separates platform administrators from store-level roles and
  // carries a role per store. Reject older cookies so a pre-deploy session
  // cannot retain the previous, over-broad owner/admin interpretation.
  if (session.version !== 2 || !session.storeRoles || !session.locationScopes) return undefined;
  if (!session.exp || session.exp * 1000 < Date.now()) return undefined;
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

// A configured platform-admin email resolves to role='admin' in
// findSessionForGoogleUser purely from the env allowlist — even with no users
// row. Self-service password flows (signup / claim) must refuse these emails so
// they can't be used to mint an admin session; admins authenticate via SSO.
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
  const result = await getPostgresPool().query<{ id: string }>("select id from stores where status <> 'inactive' order by id");
  return result.rows.map((row) => row.id);
}

export async function findSessionForGoogleUser(input: { email: string; name?: string | null }): Promise<AuthSession | undefined> {
  const email = input.email.trim().toLowerCase();
  if (!email) return undefined;
  const admins = adminEmailSet();
  const isConfiguredAdmin = admins.has(email);
  const result = await getPostgresPool().query<{
    id: string;
    email: string;
    name: string;
    store_id: string | null;
    store_role: string | null;
    all_locations: boolean | null;
    location_ids: string[] | null;
  }>(
    `
      select
        u.id,
        u.email,
        u.name,
        su.store_id,
        su.role as store_role,
        su.all_locations,
        coalesce(
          array_agg(suls.location_id) filter (where suls.location_id is not null),
          array[]::text[]
        ) as location_ids
      from users u
      left join store_users su on su.user_id = u.id and su.status = 'active'
      left join store_user_location_scopes suls on suls.store_user_id = su.id
      where u.email_normalized = $1 and u.status = 'active'
      group by u.id, u.email, u.name, su.store_id, su.role, su.all_locations, su.created_at
      order by su.created_at asc
    `,
    [email],
  );

  if (!result.rows.length && !isConfiguredAdmin) return undefined;

  const first = result.rows[0];
  const storeIds = isConfiguredAdmin ? await allStoreIds() : result.rows.map((row) => row.store_id).filter((id): id is string => Boolean(id));
  // `store_users.role = admin` is an organization/store administrator, never a
  // JewelHire platform administrator. Only the explicit server-side allowlist
  // can mint the platform `admin` role.
  const access = resolveSessionAccess({
    isPlatformAdmin: isConfiguredAdmin,
    storeIds,
    memberships: result.rows
      .filter((row): row is typeof row & { store_id: string } => Boolean(row.store_id))
      .map((row) => ({
        storeId: row.store_id,
        storeRole: row.store_role,
        allLocations: row.all_locations,
        locationIds: row.location_ids,
      })),
  });
  return {
    version: 2,
    userId: first?.id || `admin-${email}`,
    name: first?.name || input.name || email,
    email: first?.email || email,
    role: access.role,
    storeIds,
    storeRoles: access.storeRoles,
    locationScopes: access.locationScopes,
    activeStoreId: storeIds[0] || "",
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    guardrails: guardrails(),
  };
}
