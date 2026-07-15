import { createHash } from "node:crypto";
import type { AuthSession, StoreMembershipRole } from "@/lib/server/auth";
import { findJewelLinkSession, isConfiguredAdminEmail } from "@/lib/server/auth";
import {
  ApplicantProfileOwnershipConflictError,
  ensureApplicantProfileForUser,
} from "@/lib/server/applicant-profile-provisioning";
import { getPostgresPool } from "@/lib/server/postgres";
import { safeSameOriginPath } from "@/lib/server/safe-redirect";
import {
  jewelLinkIdentityProvisionAction,
  jewelLinkRoleAllowedForIdentity,
  validJewelLinkAccessFingerprint,
  validJewelLinkState,
  validateJewelLinkAssurance,
} from "@/lib/server/jewellink-sso-contract";

export class JewelLinkAssuranceError extends Error {
  constructor() {
    super("JewelLink MFA assurance is missing, invalid, or stale.");
    this.name = "JewelLinkAssuranceError";
  }
}

export class JewelLinkIdentityConflictError extends Error {
  constructor() {
    super("That email belongs to a different JewelHire identity.");
    this.name = "JewelLinkIdentityConflictError";
  }
}

export class JewelLinkAccessRevokedError extends Error {
  constructor() {
    super("JewelHire access for this linked identity is inactive.");
    this.name = "JewelLinkAccessRevokedError";
  }
}

export type JewelLinkSsoClaims = {
  issuer: "jewellink";
  userId: string;
  email: string;
  name: string;
  role: string;
  authVersion: number;
  accessFingerprint: string;
  company: { id: string; name: string } | null;
  primaryLocationId?: string | null;
  locations: Array<{ id: string; name: string }>;
  allLocations: boolean;
  returnTo?: string;
  state?: string;
  amr: string[];
  authTime: string;
  mfaVerifiedAt: string;
  upstreamSessionId: string;
  issuedAt: string;
  expiresAt: string;
};

function stableId(prefix: string, externalId: string) {
  return `${prefix}-jl-${createHash("sha256").update(externalId).digest("hex").slice(0, 20)}`;
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "jewellink-store";
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
  const issuedAt = Date.parse(claims.issuedAt || "");
  const expiresAt = Date.parse(claims.expiresAt || "");
  const now = Date.now();
  const companyValid = claims.company === null || (
    claims.company !== undefined &&
    typeof claims.company.id === "string" && Boolean(claims.company.id) &&
    typeof claims.company.name === "string" && Boolean(claims.company.name)
  );
  return claims.issuer === "jewellink" &&
    typeof claims.userId === "string" && Boolean(claims.userId) &&
    typeof claims.email === "string" && claims.email.includes("@") &&
    typeof claims.name === "string" && Boolean(claims.name) &&
    typeof claims.role === "string" &&
    typeof claims.authVersion === "number" && Number.isSafeInteger(claims.authVersion) && claims.authVersion > 0 &&
    validJewelLinkAccessFingerprint(claims.accessFingerprint) &&
    companyValid &&
    Array.isArray(claims.locations) && claims.locations.every((location) =>
      Boolean(location) && typeof location.id === "string" && Boolean(location.id) &&
      typeof location.name === "string" && Boolean(location.name)
    ) &&
    typeof claims.allLocations === "boolean" &&
    Number.isFinite(issuedAt) && issuedAt > now - 5 * 60_000 && issuedAt <= now + 60_000 &&
    Number.isFinite(expiresAt) && expiresAt > now && expiresAt <= issuedAt + 5 * 60_000 &&
    (claims.state === undefined || validJewelLinkState(claims.state)) &&
    validateJewelLinkAssurance(claims).ok;
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
    if (!response.ok) throw new Error("JewelLink authorization code exchange failed.");
    if (!body?.claims) throw new Error("JewelLink authorization code exchange failed.");
    if (!validateJewelLinkAssurance(body?.claims).ok) throw new JewelLinkAssuranceError();
    if (!validClaims(body?.claims)) throw new Error("JewelLink authorization code exchange failed.");
    return { ...body.claims, returnTo: safeSameOriginPath(body.claims.returnTo) };
  } finally {
    clearTimeout(timeout);
  }
}

function isApplicantRole(role: string) {
  return role === "STUDENT" || role === "CONSULTANT";
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
  const assurance = validateJewelLinkAssurance(claims);
  if (!assurance.ok) throw new JewelLinkAssuranceError();
  const membershipRole = membershipForRole(claims.role);
  const applicantRole = isApplicantRole(claims.role);
  const email = claims.email.trim().toLowerCase();
  const isPlatformAdmin = isConfiguredAdminEmail(email);
  if (!jewelLinkRoleAllowedForIdentity({
    role: claims.role,
    isPlatformAdmin,
    company: claims.company,
  })) {
    throw new JewelLinkAccessRevokedError();
  }
  const client = await getPostgresPool().connect();
  const advisoryLockKey = `jewelhire:jewellink-sso:${claims.userId}`;
  let advisoryLockHeld = false;
  let transactionStarted = false;
  let discardClient = false;
  let sessionIdentity: { localUserId: string; upstreamUserId: string } | undefined;
  try {
    // Serialize all role observations for one upstream subject across the
    // durable demotion barrier and the subsequent provisioning transaction.
    // This is a session-level lock because a transaction-level lock would be
    // released by the barrier's autocommit boundary. The finally block either
    // unlocks it explicitly or destroys the pooled connection so it cannot leak.
    try {
      await client.query("select pg_advisory_lock(hashtextextended($1, 0))", [advisoryLockKey]);
      advisoryLockHeld = true;
    } catch (error) {
      discardClient = true;
      throw error;
    }

    if (applicantRole) {
      // Role demotion is a fail-closed authorization boundary, not part of the
      // profile/company unit of work. Commit it before any riskier provisioning
      // so a later rollback can never restore manager or owner authority. This
      // single autocommit statement also resolves the stable linked identity.
      await client.query(
        `
          with linked_applicant as materialized (
            select id
            from users
            where jewellink_user_id = $1
            limit 1
          ), revoked_memberships as (
            update store_users membership
            set status = 'inactive', updated_at = now()
            from linked_applicant
            where membership.user_id = linked_applicant.id
              and membership.source = 'jewellink'
              and membership.status <> 'inactive'
            returning membership.id
          )
          select linked_applicant.id,
                 (select count(*) from revoked_memberships) as revoked_membership_count
          from linked_applicant
        `,
        [claims.userId],
      );
    }

    await client.query("begin");
    transactionStarted = true;
    let companyId: string | null = null;
    let storeId: string | null = null;

    if (claims.company) {
      const desiredCompanyId = stableId("company", claims.company.id);
      const companyResult = await client.query<{ id: string; status: string }>(
        `
          insert into companies (id, name, plan_tier, status, jewellink_company_id)
          values ($1, $2, 'jewellink_included', 'active', $3)
          on conflict (jewellink_company_id) where jewellink_company_id is not null
          do update set name = excluded.name, updated_at = now()
          returning id, status
        `,
        [desiredCompanyId, claims.company.name, claims.company.id],
      );
      companyId = companyResult.rows[0]?.id || desiredCompanyId;
      if (companyResult.rows[0]?.status !== "active") throw new JewelLinkAccessRevokedError();

      const existingStore = await client.query<{ id: string; status: string }>(
        "select id, status from stores where company_id = $1 and status <> 'archived' order by created_at asc limit 1",
        [companyId],
      );
      storeId = existingStore.rows[0]?.id || stableId("store", claims.company.id);
      if (membershipRole && existingStore.rows[0] && existingStore.rows[0].status !== "active") {
        throw new JewelLinkAccessRevokedError();
      }
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
          select $1, 'jewellink_included', 'jewellink_free', 'active', 0
          where not exists (
            select 1
            from subscriptions paid_subscription
            where paid_subscription.company_id = $1
              and paid_subscription.status in ('active', 'trialing')
              and (paid_subscription.current_period_end is null or paid_subscription.current_period_end > now())
          )
          on conflict (company_id) do nothing
        `,
        [companyId],
      );
      const entitlement = await client.query<{ entitled: boolean }>(
        `
          select (
            exists (
              select 1
              from company_access_entitlements cae
              where cae.company_id = $1
                and cae.status = 'active'
                and (cae.expires_at is null or cae.expires_at > now())
            )
            or exists (
              select 1
              from subscriptions sub
              where sub.company_id = $1
                and sub.status in ('active', 'trialing')
                and (sub.current_period_end is null or sub.current_period_end > now())
            )
          ) as entitled
        `,
        [companyId],
      );
      if (!entitlement.rows[0]?.entitled) throw new JewelLinkAccessRevokedError();

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

    const linkedUser = await client.query<{ id: string; status: string; native_auth_enabled: boolean }>(
      "select id, status, native_auth_enabled from users where jewellink_user_id = $1 limit 1 for update",
      [claims.userId],
    );
    const emailUser = await client.query<{ id: string; jewellink_user_id: string | null; status: string }>(
      "select id, jewellink_user_id, status from users where email_normalized = $1 limit 1 for update",
      [email],
    );
    // Allowlisted platform admins are a narrow migration exception to the
    // normal email-collision rule: MFA-backed SSO may adopt an unlinked local
    // row with the exact allowlisted email and permanently disable native auth.
    // A row already linked to another upstream subject still fails closed.
    const canAdoptAllowlistedAdmin = isPlatformAdmin
      && !linkedUser.rows[0]
      && Boolean(emailUser.rows[0])
      && emailUser.rows[0]?.status === "active"
      && !emailUser.rows[0]?.jewellink_user_id;
    const identityAction = canAdoptAllowlistedAdmin
      ? "adopt"
      : jewelLinkIdentityProvisionAction({
          linkedUserId: linkedUser.rows[0]?.id,
          emailUserId: emailUser.rows[0]?.id,
          linkedNativeAuthEnabled: isPlatformAdmin ? false : linkedUser.rows[0]?.native_auth_enabled,
        });
    if (identityAction === "conflict") throw new JewelLinkIdentityConflictError();
    if (linkedUser.rows[0] && linkedUser.rows[0].status !== "active") throw new JewelLinkAccessRevokedError();

    const localUserId = linkedUser.rows[0]?.id || (identityAction === "adopt" ? emailUser.rows[0]!.id : stableId("user", claims.userId));
    if (identityAction === "update") {
      const updated = await client.query(
        `update users
         set company_id = $2, email = $3, email_normalized = $3, name = $4,
             native_auth_enabled = false, updated_at = now()
         where id = $1 and jewellink_user_id = $5
           and (native_auth_enabled = false or $6::boolean)
         returning id`,
        [localUserId, companyId, email, claims.name, claims.userId, isPlatformAdmin],
      );
      if (!updated.rows[0]) throw new JewelLinkIdentityConflictError();
    } else if (identityAction === "adopt") {
      const adopted = await client.query(
        `update users
         set company_id = $2, email = $3, email_normalized = $3, name = $4,
             jewellink_user_id = $5, native_auth_enabled = false, updated_at = now()
         where id = $1 and email_normalized = $3 and jewellink_user_id is null
         returning id`,
        [localUserId, companyId, email, claims.name, claims.userId],
      );
      if (!adopted.rows[0]) throw new JewelLinkIdentityConflictError();
    } else {
      await client.query(
        `insert into users (id, company_id, email, email_normalized, name, status, jewellink_user_id, native_auth_enabled)
         values ($1, $2, $3, $3, $4, 'active', $5, false)`,
        [localUserId, companyId, email, claims.name, claims.userId],
      );
    }
    if (applicantRole) {
      await ensureApplicantProfileForUser(client, {
        userId: localUserId,
        email,
        name: claims.name,
        profileId: stableId("profile", claims.userId),
      });
    }
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
    transactionStarted = false;

    // JewelLink roles never grant platform administration by themselves. This
    // dedicated resolver deliberately accepts the SSO-only identity while the
    // native Google/password resolver rejects it.
    sessionIdentity = { localUserId, upstreamUserId: claims.userId };
  } catch (error) {
    const identityConflict = error instanceof JewelLinkIdentityConflictError
      || error instanceof ApplicantProfileOwnershipConflictError
      || (error && typeof error === "object" && "code" in error && error.code === "23505");
    let rollbackFailure: unknown;
    if (transactionStarted) {
      try {
        await client.query("rollback");
        transactionStarted = false;
      } catch (rollbackError) {
        // A connection with an uncertain transaction state must never return to
        // the pool, especially while it may still own a session advisory lock.
        rollbackFailure = rollbackError;
        discardClient = true;
      }
    }
    if (identityConflict) {
      const conflictError = new JewelLinkIdentityConflictError();
      if (rollbackFailure !== undefined) conflictError.cause = rollbackFailure;
      throw conflictError;
    }
    if (rollbackFailure !== undefined && error instanceof Error && error.cause === undefined) {
      error.cause = rollbackFailure;
    }
    throw error;
  } finally {
    if (advisoryLockHeld && !discardClient) {
      try {
        const unlocked = await client.query<{ unlocked: boolean }>(
          "select pg_advisory_unlock(hashtextextended($1, 0)) as unlocked",
          [advisoryLockKey],
        );
        if (unlocked.rows[0]?.unlocked !== true) discardClient = true;
      } catch {
        discardClient = true;
      }
    }
    client.release(discardClient);
  }

  if (!sessionIdentity) return undefined;
  return findJewelLinkSession({
    ...sessionIdentity,
    accessFingerprint: claims.accessFingerprint,
    assurance: assurance.assurance,
    expiresAt: assurance.sessionExpiresAt,
  });
}
