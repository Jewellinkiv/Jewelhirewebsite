import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import { getPostgresPool } from "@/lib/server/postgres";

const MAX_BODY_BYTES = 128 * 1024;
const OPAQUE_SECRET = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

type Role = "store_owner" | "manager";
type ParsedProjection = {
  outboxId: string;
  idempotencyKey: string;
  authorizationVersion: number;
  userId: string;
  companyId: string;
  spokeGrantId: string;
  locations: ReadonlyMap<string, Role>;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximum = 160): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 2_147_483_647 ? value : null;
}

function secret(): string | null {
  const value = process.env.LINKD_UNIFIED_ACCESS_PROJECTION_SECRET?.trim() || "";
  return process.env.LINKD_UNIFIED_ACCESS_ENABLED === "1" && OPAQUE_SECRET.test(value) ? value : null;
}

function verified(body: string, timestamp: string | null, signature: string | null, signingSecret: string): boolean {
  if (!timestamp || !/^[0-9]{10}$/.test(timestamp) || !signature || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
  const issuedAt = Number(timestamp);
  if (!Number.isSafeInteger(issuedAt) || Math.abs(Math.floor(Date.now() / 1_000) - issuedAt) > 300) return false;
  const expected = createHmac("sha256", signingSecret).update(`${timestamp}.${body}`, "utf8").digest("base64url");
  const actualBytes = Buffer.from(signature, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function parse(body: string): ParsedProjection | null {
  let value: unknown;
  try {
    value = JSON.parse(body) as unknown;
  } catch {
    return null;
  }
  if (!record(value) || Object.keys(value).sort().join("|") !== "authorizationVersion|idempotencyKey|outboxId|payload|schemaVersion" || value.schemaVersion !== "1.0") return null;
  const outboxId = text(value.outboxId, 36);
  const idempotencyKey = text(value.idempotencyKey, 160);
  const authorizationVersion = positiveInteger(value.authorizationVersion);
  if (!outboxId || !UUID.test(outboxId) || !idempotencyKey || !/^[A-Za-z0-9._:-]{16,160}$/.test(idempotencyKey) || authorizationVersion === null || !record(value.payload)) return null;
  const payload = value.payload;
  const userId = text(payload.spokePrincipalId, 128);
  const companyId = text(payload.spokeCompanyId, 128);
  const spokeGrantId = text(payload.spokeGrantId, 36);
  if (
    payload.schemaVersion !== "1.0" || payload.eventType !== "grant_changed" || payload.spoke !== "jewelhire"
    || payload.authorizationVersion !== authorizationVersion || !userId || !ID.test(userId) || !companyId || !ID.test(companyId)
    || !spokeGrantId || !UUID.test(spokeGrantId) || !Array.isArray(payload.grantScopes)
    || payload.grantScopes.length < 1 || payload.grantScopes.length > 1_000
  ) return null;
  const locations = new Map<string, Role>();
  for (const rawScope of payload.grantScopes) {
    if (!record(rawScope) || !UUID.test(String(rawScope.scopeId)) || !Array.isArray(rawScope.roles) || rawScope.roles.length !== 1 || (rawScope.roles[0] !== "store_owner" && rawScope.roles[0] !== "manager") || !Array.isArray(rawScope.permissions) || rawScope.permissions.length !== 0 || !Array.isArray(rawScope.spokeLocations) || rawScope.spokeLocations.length < 1 || rawScope.spokeLocations.length > 10_000) return null;
    const role = rawScope.roles[0] as Role;
    for (const rawLocation of rawScope.spokeLocations) {
      const locationId = record(rawLocation) ? text(rawLocation.spokeLocationId, 128) : null;
      if (!record(rawLocation) || rawLocation.spokeCompanyId !== companyId || !locationId || !ID.test(locationId)) return null;
      const prior = locations.get(locationId);
      if (prior && prior !== role) return null;
      locations.set(locationId, role);
    }
  }
  return locations.size > 0 ? { outboxId, idempotencyKey, authorizationVersion, userId, companyId, spokeGrantId, locations } : null;
}

type LocationRow = { location_id: string; store_id: string };
type MembershipRow = { id: string; store_id: string };
type ReceiptRow = { idempotency_key: string; authorization_version: number; projection_hash: string };

export async function applyJewelHireLinkdProjection(input: {
  body: string;
  timestamp: string | null;
  signature: string | null;
}): Promise<{ outboxId: string; idempotencyKey: string; authorizationVersion: number } | null> {
  const signingSecret = secret();
  if (!signingSecret || new TextEncoder().encode(input.body).byteLength > MAX_BODY_BYTES || !verified(input.body, input.timestamp, input.signature, signingSecret)) return null;
  const projection = parse(input.body);
  if (!projection) return null;
  const hash = createHash("sha256").update(input.body, "utf8").digest("hex");
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const receipt = await client.query<ReceiptRow>(
      "select idempotency_key, authorization_version, projection_hash from linkd_access_projection_receipts where outbox_id = $1 for update",
      [projection.outboxId],
    );
    if (receipt.rowCount) {
      await client.query("rollback");
      const existing = receipt.rows[0];
      return existing && existing.idempotency_key === projection.idempotencyKey && existing.authorization_version === projection.authorizationVersion && existing.projection_hash === hash
        ? { outboxId: projection.outboxId, idempotencyKey: projection.idempotencyKey, authorizationVersion: projection.authorizationVersion }
        : null;
    }
    const locationIds = [...projection.locations.keys()].sort();
    const locations = await client.query<LocationRow>(
      `select l.id as location_id, s.id as store_id
         from locations l join stores s on s.id = l.store_id and s.status = 'active'
         join companies c on c.id = s.company_id and c.status = 'active'
        where l.id = any($1::text[]) and c.id = $2`,
      [locationIds, projection.companyId],
    );
    if (locations.rowCount !== locationIds.length) {
      await client.query("rollback");
      return null;
    }
    const byStore = new Map<string, { role: Role; locations: string[] }>();
    for (const location of locations.rows) {
      const role = projection.locations.get(location.location_id);
      if (!role) {
        await client.query("rollback");
        return null;
      }
      const existing = byStore.get(location.store_id);
      if (existing && existing.role !== role) {
        await client.query("rollback");
        return null;
      }
      if (existing) existing.locations.push(location.location_id);
      else byStore.set(location.store_id, { role, locations: [location.location_id] });
    }
    const storeIds = [...byStore.keys()].sort();
    const memberships = await client.query<MembershipRow>(
      "select id, store_id from store_users where user_id = $1 and store_id = any($2::text[]) and status = 'active' for update",
      [projection.userId, storeIds],
    );
    if (memberships.rowCount !== storeIds.length || new Set(memberships.rows.map((row) => row.store_id)).size !== storeIds.length) {
      await client.query("rollback");
      return null;
    }
    const latest = await client.query<{ authorization_version: number }>(
      `select authorization_version from linkd_access_projection_receipts
        where user_id = $1 and company_id = $2 and spoke_grant_id = $3
        order by authorization_version desc limit 1 for update`,
      [projection.userId, projection.companyId, projection.spokeGrantId],
    );
    if ((latest.rows[0]?.authorization_version ?? 0) >= projection.authorizationVersion) {
      await insertReceipt(client, projection, hash);
      await client.query("commit");
      return { outboxId: projection.outboxId, idempotencyKey: projection.idempotencyKey, authorizationVersion: projection.authorizationVersion };
    }
    for (const membership of memberships.rows) {
      const wanted = byStore.get(membership.store_id)!;
      const available = await client.query<{ id: string }>("select id from locations where store_id = $1 order by id", [membership.store_id]);
      const allLocations = available.rows.length === wanted.locations.length && available.rows.every((row) => wanted.locations.includes(row.id));
      await client.query(
        "update store_users set role = $2, all_locations = $3, source = 'linkd', updated_at = now() where id = $1",
        [membership.id, wanted.role, allLocations],
      );
      await client.query("delete from store_user_location_scopes where store_user_id = $1", [membership.id]);
      if (!allLocations) {
        for (const locationId of wanted.locations.sort()) {
          await client.query(
            "insert into store_user_location_scopes (id, store_user_id, location_id, source, created_at, updated_at) values ($1, $2, $3, 'linkd', now(), now())",
            [randomUUID(), membership.id, locationId],
          );
        }
      }
    }
    await insertReceipt(client, projection, hash);
    await client.query("commit");
    return { outboxId: projection.outboxId, idempotencyKey: projection.idempotencyKey, authorizationVersion: projection.authorizationVersion };
  } catch {
    await client.query("rollback").catch(() => undefined);
    return null;
  } finally {
    client.release();
  }
}

async function insertReceipt(
  client: PoolClient,
  projection: ParsedProjection,
  hash: string,
) {
  await client.query(
    `insert into linkd_access_projection_receipts
       (id, outbox_id, idempotency_key, user_id, company_id, spoke_grant_id, authorization_version, projection_hash, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())`,
    [randomUUID(), projection.outboxId, projection.idempotencyKey, projection.userId, projection.companyId, projection.spokeGrantId, projection.authorizationVersion, hash],
  );
}
