import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { getPostgresPool } from "@/lib/server/postgres";
import { createActionToken } from "@/lib/server/action-tokens";
import { notifyStoreOwnerClaim } from "@/lib/server/notifications";

// Store-owner paid signup: a pending row is created at form submit, and the real
// company/store/owner is provisioned ONLY after Stripe confirms payment. Owners
// are linked to their store with role 'store_owner' (NOT 'admin' — that maps to a
// platform admin in auth.ts), then emailed a single-use account-claim link to set
// their password.

const CLAIM_TTL_MINUTES = 60 * 24 * 3; // 3 days to set the initial password
const DEFAULT_PLAN = "starter";

export type PendingStoreSignupInput = {
  companyName: string;
  ownerName?: string | null;
  ownerEmail: string;
  promoCode?: string | null;
  plan?: string | null;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function uniqueCompanySlug(client: PoolClient, value: string) {
  const base = slugify(value) || "store";
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const result = await client.query<{ exists: boolean }>(
      `select exists(
         select 1 from stores where slug = $1
         union all select 1 from companies where id = $2
       ) as exists`,
      [`${slug}-careers`, `co-${slug}`],
    );
    if (!result.rows[0]?.exists) return slug;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

// Create the pending signup and return its id. The caller threads this id through
// Stripe as client_reference_id (prefixed "psu-") so the webhook can correlate.
export async function createPendingStoreSignup(input: PendingStoreSignupInput): Promise<{ id: string }> {
  const id = `psu-${randomBytes(12).toString("base64url")}`;
  const email = input.ownerEmail.trim();
  await getPostgresPool().query(
    `insert into pending_store_signups
       (id, company_name, owner_name, owner_email, owner_email_normalized, plan, promo_code, status)
     values ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
    [
      id,
      input.companyName.trim(),
      input.ownerName?.trim() || null,
      email,
      normalizeEmail(email),
      (input.plan?.trim() || DEFAULT_PLAN),
      input.promoCode?.trim() || null,
    ],
  );
  return { id };
}

type PendingRow = {
  id: string;
  company_name: string;
  owner_name: string | null;
  owner_email: string;
  owner_email_normalized: string;
  plan: string;
  status: string;
};

export type ProvisionResult =
  | { provisioned: false; reason: string }
  | { provisioned: true; companyId: string; storeId: string; userId: string; alreadyDone?: boolean };

// Idempotently provision a store from a pending signup. Safe to call repeatedly
// (Stripe retries webhooks): the pending row is flipped pending -> provisioned in
// a single atomic step, and a second caller short-circuits.
export async function provisionStoreFromPendingSignup(input: {
  pendingId: string;
  stripeReference?: string | null;
}): Promise<ProvisionResult> {
  const pool = getPostgresPool();

  // Atomically claim the pending row so concurrent webhook deliveries don't
  // double-provision. Only the winner sees status='pending'.
  const claim = await pool.query<PendingRow>(
    `update pending_store_signups
        set status = 'provisioned', stripe_reference = coalesce($2, stripe_reference), provisioned_at = now(), updated_at = now()
      where id = $1 and status = 'pending'
      returning id, company_name, owner_name, owner_email, owner_email_normalized, plan, status`,
    [input.pendingId, input.stripeReference || null],
  );

  const row = claim.rows[0];
  if (!row) {
    // Either unknown id, or already provisioned by a prior delivery.
    const existing = await pool.query<{ status: string; provisioned_company_id: string | null; provisioned_store_id: string | null; provisioned_user_id: string | null }>(
      `select status, provisioned_company_id, provisioned_store_id, provisioned_user_id
         from pending_store_signups where id = $1`,
      [input.pendingId],
    );
    const e = existing.rows[0];
    if (e?.status === "provisioned" && e.provisioned_company_id && e.provisioned_store_id && e.provisioned_user_id) {
      return { provisioned: true, companyId: e.provisioned_company_id, storeId: e.provisioned_store_id, userId: e.provisioned_user_id, alreadyDone: true };
    }
    return { provisioned: false, reason: "pending_signup_not_claimable" };
  }

  const client = await pool.connect();
  let companyId = "";
  let storeId = "";
  let userId = "";
  let existingUser = false;
  try {
    await client.query("begin");
    const slug = await uniqueCompanySlug(client, row.company_name);
    companyId = `co-${slug}`;
    storeId = `store-${slug}-primary`;
    const email = row.owner_email;
    const emailNorm = row.owner_email_normalized;
    const ownerName = row.owner_name?.trim() || email;
    const planDb = ["starter", "growth", "pro"].includes(row.plan) ? row.plan : DEFAULT_PLAN;

    await client.query(
      `insert into companies (id, name, owner_name, plan_tier, status, created_at, updated_at)
       values ($1, $2, $3, $4, 'active', now(), now())`,
      [companyId, row.company_name, ownerName, planDb],
    );
    await client.query(
      `insert into stores (id, company_id, name, slug, location_label, timezone, status, created_at, updated_at)
       values ($1, $2, $3, $4, null, 'America/New_York', 'active', now(), now())`,
      [storeId, companyId, `${row.company_name} — Primary`, `${slug}-careers`],
    );

    // Reuse an existing user with this email if one was created in the meantime
    // (e.g. a free applicant signup between form submit and payment). Otherwise
    // create the owner. Either way, link them to the store as 'store_owner'.
    const found = await client.query<{ id: string }>(
      `select id from users where email_normalized = $1`,
      [emailNorm],
    );
    if (found.rows[0]) {
      userId = found.rows[0].id;
      existingUser = true;
      await client.query(`update users set company_id = coalesce(company_id, $2), updated_at = now() where id = $1`, [userId, companyId]);
    } else {
      userId = `user-${slug}-owner`;
      await client.query(
        `insert into users (id, company_id, email, email_normalized, name, status, created_at, updated_at)
         values ($1, $2, $3, $4, $5, 'active', now(), now())`,
        [userId, companyId, email, emailNorm, ownerName],
      );
    }
    await client.query(
      `insert into store_users (id, store_id, user_id, role, status, created_at, updated_at)
       values ($1, $2, $3, 'store_owner', 'active', now(), now())
       on conflict (store_id, user_id) do nothing`,
      [`store-user-${slug}-owner`, storeId, userId],
    );

    // Active subscription — the payment that triggered this is already settled.
    await client.query(
      `insert into subscriptions (id, company_id, plan_id, status, provider, provider_subscription_id, created_at, updated_at)
       values ($1, $2, $3, 'active', 'stripe', $4, now(), now())
       on conflict (company_id) do update set status = 'active', provider = 'stripe',
         provider_subscription_id = excluded.provider_subscription_id, updated_at = now()`,
      [`sub-${companyId}`, companyId, `plan-${planDb}`, input.stripeReference || null],
    );

    await client.query(
      `update pending_store_signups
          set provisioned_company_id = $2, provisioned_store_id = $3, provisioned_user_id = $4, updated_at = now()
        where id = $1`,
      [row.id, companyId, storeId, userId],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    // Re-open the pending row so a retry can try again.
    await pool.query(`update pending_store_signups set status = 'pending', updated_at = now() where id = $1`, [input.pendingId]);
    throw error;
  } finally {
    client.release();
  }

  // Email the account-claim link so the owner can set their password. Best-effort;
  // a mail failure must not undo the provisioning.
  try {
    const token = await createActionToken({ purpose: "account_claim", userId, email: row.owner_email, ttlMinutes: CLAIM_TTL_MINUTES });
    await notifyStoreOwnerClaim({
      toEmail: row.owner_email,
      name: row.owner_name,
      companyName: row.company_name,
      token,
      existingAccount: existingUser,
    });
  } catch {
    // swallow — provisioning succeeded; the owner can use "forgot password" to recover.
  }

  return { provisioned: true, companyId, storeId, userId };
}
