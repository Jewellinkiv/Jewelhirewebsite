import { createHash } from "node:crypto";
import type { AuthSession, StoreMembershipRole } from "@/lib/server/auth";
import { findSessionForGoogleUser } from "@/lib/server/auth";
import { getPostgresPool } from "@/lib/server/postgres";

export type JewelLinkSsoClaims = {
  issuer: "jewellink";
  userId: string;
  email: string;
  name: string;
  role: string;
  company: { id: string; name: string } | null;
  primaryLocationId?: string | null;
  locations: Array<{ id: string; name: string }>;
  allLocations: boolean;
  returnTo?: string;
  issuedAt: string;
  expiresAt: string;
};

function stableId(prefix: string, externalId: string) {
  return `${prefix}-jl-${createHash("sha256").update(externalId).digest("hex").slice(0, 20)}`;
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "jewellink-store";
}

function localReturnTo(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : undefined;
}

function configuredJewelLinkUrl() {
  const raw = process.env.JEWELLINK_URL?.trim();
  if (!raw) throw new Error("JEWELLINK_URL is not configured.");
  const url = new URL(raw);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("JEWELLINK_URL must use HTTPS in production.");
  }
  return url;
}

function validClaims(value: unknown): value is JewelLinkSsoClaims {
  if (!value || typeof value !== "object") return false;
  const claims = value as Partial<JewelLinkSsoClaims>;
  const expiresAt = Date.parse(claims.expiresAt || "");
  return claims.issuer === "jewellink" &&
    typeof claims.userId === "string" && Boolean(claims.userId) &&
    typeof claims.email === "string" && claims.email.includes("@") &&
    typeof claims.name === "string" && Boolean(claims.name) &&
    typeof claims.role === "string" &&
    Array.isArray(claims.locations) &&
    Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export async function exchangeJewelLinkCode(code: string) {
  const secret = process.env.JEWELLINK_SSO_SHARED_SECRET || process.env.JEWELHIRE_SSO_SHARED_SECRET || "";
  if (!secret) throw new Error("JEWELLINK_SSO_SHARED_SECRET is not configured.");
  const endpoint = new URL("/api/integrations/jewelhire/sso/exchange", configuredJewelLinkUrl());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ code }),
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null) as { claims?: unknown } | null;
    if (!response.ok || !validClaims(body?.claims)) throw new Error("JewelLink authorization code exchange failed.");
    return { ...body.claims, returnTo: localReturnTo(body.claims.returnTo) };
  } finally {
    clearTimeout(timeout);
  }
}

function membershipForRole(role: string): StoreMembershipRole | undefined {
  if (role === "MANAGER") return "manager";
  if (role === "DIRECTOR") {
    return process.env.JEWELHIRE_JEWELLINK_DIRECTOR_ROLE === "manager" ? "manager" : "store_owner";
  }
  if (role === "ADMIN") return "store_owner";
  return undefined;
}

export async function provisionJewelLinkSession(claims: JewelLinkSsoClaims): Promise<AuthSession | undefined> {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    let companyId: string | null = null;
    let storeId: string | null = null;
    const email = claims.email.trim().toLowerCase();

    if (claims.company) {
      const desiredCompanyId = stableId("company", claims.company.id);
      const companyResult = await client.query<{ id: string }>(
        `
          insert into companies (id, name, plan_tier, status, jewellink_company_id)
          values ($1, $2, 'jewellink_included', 'active', $3)
          on conflict (jewellink_company_id) where jewellink_company_id is not null
          do update set name = excluded.name, status = 'active', updated_at = now()
          returning id
        `,
        [desiredCompanyId, claims.company.name, claims.company.id],
      );
      companyId = companyResult.rows[0]?.id || desiredCompanyId;

      const existingStore = await client.query<{ id: string }>(
        "select id from stores where company_id = $1 and status <> 'archived' order by created_at asc limit 1",
        [companyId],
      );
      storeId = existingStore.rows[0]?.id || stableId("store", claims.company.id);
      if (!existingStore.rows[0]) {
        await client.query(
          `
            insert into stores (id, company_id, name, slug, location_label, status)
            values ($1, $2, $3, $4, $5, 'active')
          `,
          [storeId, companyId, claims.company.name, `${slug(claims.company.name)}-${createHash("sha256").update(claims.company.id).digest("hex").slice(0, 8)}`, "JewelLink"],
        );
      }

      await client.query(
        `
          insert into company_access_entitlements (company_id, source, plan_code, status, amount_cents)
          values ($1, 'jewellink_included', 'jewellink_free', 'active', 0)
          on conflict (company_id) do update
          set source = 'jewellink_included', plan_code = 'jewellink_free', status = 'active',
              amount_cents = 0, expires_at = null, updated_at = now()
        `,
        [companyId],
      );

      for (const location of claims.locations) {
        await client.query(
          `
            insert into locations (id, store_id, name, jewellink_location_id)
            values ($1, $2, $3, $4)
            on conflict (jewellink_location_id) where jewellink_location_id is not null
            do update set name = excluded.name, updated_at = now()
          `,
          [stableId("location", location.id), storeId, location.name, location.id],
        );
      }
    }

    const userId = stableId("user", claims.userId);
    const userResult = await client.query<{ id: string }>(
      `
        insert into users (id, company_id, email, email_normalized, name, status, jewellink_user_id)
        values ($1, $2, $3, $3, $4, 'active', $5)
        on conflict (email_normalized) do update
        set company_id = excluded.company_id, email = excluded.email, name = excluded.name,
            status = 'active', jewellink_user_id = excluded.jewellink_user_id, updated_at = now()
        returning id
      `,
      [userId, companyId, email, claims.name, claims.userId],
    );
    const localUserId = userResult.rows[0]?.id || userId;
    const membershipRole = membershipForRole(claims.role);
    await client.query(
      "update store_users set status = 'inactive', updated_at = now() where user_id = $1 and source = 'jewellink'",
      [localUserId],
    );
    if (membershipRole && storeId) {
      const allLocations = membershipRole === "store_owner" || claims.allLocations || process.env.JEWELHIRE_JEWELLINK_MANAGER_ALL_LOCATIONS === "1";
      const storeUserId = stableId("store-user", `${storeId}:${localUserId}`);
      await client.query(
        `
          insert into store_users (id, store_id, user_id, role, status, all_locations, source)
          values ($1, $2, $3, $4, 'active', $5, 'jewellink')
          on conflict (store_id, user_id) do update
          set role = excluded.role, status = 'active', all_locations = excluded.all_locations,
              source = 'jewellink', updated_at = now()
        `,
        [storeUserId, storeId, localUserId, membershipRole, allLocations],
      );
      await client.query("delete from store_user_location_scopes where store_user_id = $1 and source = 'jewellink'", [storeUserId]);
      if (!allLocations) {
        const locations = await client.query<{ id: string }>(
          "select id from locations where store_id = $1 and jewellink_location_id = any($2::text[])",
          [storeId, claims.locations.map((location) => location.id)],
        );
        for (const location of locations.rows) {
          await client.query(
            `
              insert into store_user_location_scopes (id, store_user_id, location_id, source)
              values ($1, $2, $3, 'jewellink')
              on conflict (store_user_id, location_id) do update set source = 'jewellink', updated_at = now()
            `,
            [stableId("scope", `${storeUserId}:${location.id}`), storeUserId, location.id],
          );
        }
      }
    }
    await client.query("commit");

    // JewelLink roles never grant platform administration by themselves.
    // findSessionForGoogleUser applies JewelHire's own explicit admin allowlist.
    return findSessionForGoogleUser({ email, name: claims.name });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
