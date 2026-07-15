import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { isConfiguredAdminEmail } from "@/lib/server/auth";
import { getPostgresPool } from "@/lib/server/postgres";
import { withReplacingActionToken } from "@/lib/server/action-tokens";
import { notifyStoreOwnerClaim } from "@/lib/server/notifications";
import {
  createStoreOwnerCheckoutSession,
  expireStoreOwnerCheckoutSession,
  storeOwnerBillingOffer,
  type StoreOwnerBillingInterval,
} from "@/lib/server/store-owner-billing";
import { applyDeferredStandaloneSubscriptionState } from "@/lib/server/standalone-access";

// Store-owner paid signup: a pending row is created at form submit, and the real
// company/store/owner is provisioned ONLY after Stripe confirms payment. Owners
// are linked to their store with role 'store_owner' (NOT 'admin' — that maps to a
// platform admin in auth.ts), then emailed a single-use account-claim link to set
// their password.

const CLAIM_TTL_MINUTES = 60 * 24 * 3; // 3 days to set the initial password
const DEFAULT_PLAN = "growth";
const CHECKOUT_TTL_MS = 23 * 60 * 60 * 1000;

export type PendingStoreSignupInput = {
  companyName: string;
  ownerName?: string | null;
  ownerEmail: string;
  plan?: string | null;
  billingInterval: StoreOwnerBillingInterval;
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

export type CreatePendingStoreSignupCheckoutResult =
  | { ok: true; id: string; sessionId: string; url: string; reused: boolean }
  | { ok: false; reason: "account_exists" | "checkout_payment_processing" | "billing_not_configured" | "stripe_rejected" | "stripe_unavailable" };

/**
 * Serialize signup checkout by normalized email and keep the database request,
 * Stripe idempotency key, and provider session bound as one operation. A changed
 * signup can replace an earlier link only after Stripe confirms the earlier
 * session is expired; completed payment wins the race and is allowed to finish.
 */
export async function createPendingStoreSignupCheckout(
  input: PendingStoreSignupInput,
): Promise<CreatePendingStoreSignupCheckoutResult> {
  const pool = getPostgresPool();
  const client = await pool.connect();
  const email = input.ownerEmail.trim();
  const emailNormalized = normalizeEmail(email);
  const companyName = input.companyName.trim();
  const ownerName = input.ownerName?.trim() || null;
  const plan = input.plan?.trim() || DEFAULT_PLAN;
  const advisoryKey = `jewelhire:store-signup:${emailNormalized}`;
  let advisoryLockHeld = false;
  let transactionStarted = false;
  let discardClient = false;
  try {
    try {
      await client.query("select pg_advisory_lock(hashtextextended($1, 0))", [advisoryKey]);
      advisoryLockHeld = true;
    } catch (error) {
      discardClient = true;
      throw error;
    }
    await client.query("begin");
    transactionStarted = true;
    const existingIdentity = await client.query<{ exists: boolean }>(
      "select exists (select 1 from users where email_normalized = $1) as exists",
      [emailNormalized],
    );
    if (isConfiguredAdminEmail(emailNormalized) || existingIdentity.rows[0]?.exists) {
      await client.query("rollback");
      transactionStarted = false;
      return { ok: false, reason: "account_exists" };
    }
    const pending = await client.query<{
      id: string;
      company_name: string;
      owner_name: string | null;
      plan: string;
      billing_interval: StoreOwnerBillingInterval;
      provider_checkout_session_id: string | null;
      checkout_expires_at: Date | string | null;
    }>(
      `select id, company_name, owner_name, plan, billing_interval,
              provider_checkout_session_id, checkout_expires_at
       from pending_store_signups
       where owner_email_normalized = $1 and status = 'pending'
       order by created_at desc, id desc
       for update`,
      [emailNormalized],
    );
    const reusable = pending.rows.find((row) =>
      row.company_name === companyName
      && (row.owner_name || null) === ownerName
      && row.plan === plan
      && row.billing_interval === input.billingInterval
      && Boolean(row.checkout_expires_at)
      && new Date(row.checkout_expires_at!).getTime() > Date.now() + 30 * 60 * 1000);

    const id = reusable?.id || `psu-${randomBytes(12).toString("base64url")}`;
    const expiresAt = reusable?.checkout_expires_at
      ? new Date(reusable.checkout_expires_at)
      : new Date(Date.now() + CHECKOUT_TTL_MS);
    if (!reusable) {
      for (const prior of pending.rows) {
        if (!prior.provider_checkout_session_id) continue;
        const expired = await expireStoreOwnerCheckoutSession(prior.provider_checkout_session_id);
        if (!expired.ok) {
          await client.query("rollback");
          transactionStarted = false;
          if (expired.reason === "already_completed") {
            return { ok: false, reason: "checkout_payment_processing" };
          }
          return {
            ok: false,
            reason: expired.reason === "stripe_unavailable"
              ? "stripe_unavailable"
              : expired.reason === "not_configured"
                ? "billing_not_configured"
                : "stripe_rejected",
          };
        }
      }
      await client.query(
        `update pending_store_signups
         set status = 'cancelled', cancellation_reason = 'checkout_replaced', updated_at = now()
         where owner_email_normalized = $1 and status = 'pending'`,
        [emailNormalized],
      );
      await client.query(
        `insert into pending_store_signups (
           id, company_name, owner_name, owner_email, owner_email_normalized,
           plan, billing_interval, status, checkout_expires_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
        [id, companyName, ownerName, email, emailNormalized, plan, input.billingInterval, expiresAt],
      );
    }

    const checkout = await createStoreOwnerCheckoutSession({
      referenceId: id,
      customerEmail: email,
      billingInterval: input.billingInterval,
      expiresAt,
      successPath: "/login?signup=payment_received",
      cancelPath: "/signup/store?signup=cancelled",
    });
    if (!checkout.ok) {
      if (checkout.reason === "stripe_rejected" || checkout.reason === "invalid_input") {
        await client.query(
          `update pending_store_signups
           set status = 'cancelled', cancellation_reason = 'checkout_creation_failed', updated_at = now()
           where id = $1 and status = 'pending'`,
          [id],
        );
      }
      await client.query("commit");
      transactionStarted = false;
      return {
        ok: false,
        reason: checkout.reason === "not_configured"
          ? "billing_not_configured"
          : checkout.reason === "stripe_unavailable"
            ? "stripe_unavailable"
            : "stripe_rejected",
      };
    }
    const bound = await client.query(
      `update pending_store_signups
       set provider_checkout_session_id = $2, updated_at = now()
       where id = $1 and status = 'pending'
         and (provider_checkout_session_id is null or provider_checkout_session_id = $2)
       returning id`,
      [id, checkout.id],
    );
    if (!bound.rows[0]) {
      await client.query("rollback");
      transactionStarted = false;
      await expireStoreOwnerCheckoutSession(checkout.id);
      return { ok: false, reason: "stripe_rejected" };
    }
    await client.query("commit");
    transactionStarted = false;
    return { ok: true, id, sessionId: checkout.id, url: checkout.url, reused: Boolean(reusable) };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("rollback");
        transactionStarted = false;
      } catch {
        discardClient = true;
      }
    }
    throw error;
  } finally {
    if (advisoryLockHeld && !discardClient) {
      try {
        const unlocked = await client.query<{ unlocked: boolean }>(
          "select pg_advisory_unlock(hashtextextended($1, 0)) as unlocked",
          [advisoryKey],
        );
        if (unlocked.rows[0]?.unlocked !== true) discardClient = true;
      } catch {
        discardClient = true;
      }
    }
    client.release(discardClient);
  }
}

type PendingRow = {
  id: string;
  company_name: string;
  owner_name: string | null;
  owner_email: string;
  owner_email_normalized: string;
  plan: string;
  billing_interval: StoreOwnerBillingInterval;
  status: string;
};

export type ProvisionResult =
  | { provisioned: false; reason: string }
  | { provisioned: true; companyId: string; storeId: string; userId: string; alreadyDone?: boolean; claimEmailSent?: boolean };

// Idempotently provision a store from a pending signup. The same per-email
// advisory lock used by checkout creation closes the signup/payment race, while
// the company, owner, subscription, entitlement, and pending-row state commit as
// one transaction.
export async function provisionStoreFromPendingSignup(input: {
  pendingId: string;
  stripeReference?: string | null;
  checkoutSessionId: string;
  billingInterval: StoreOwnerBillingInterval;
  amountCents: number;
  customerEmail?: string | null;
}): Promise<ProvisionResult> {
  const pool = getPostgresPool();
  const verifiedOffer = storeOwnerBillingOffer(input.billingInterval);
  if (input.amountCents !== verifiedOffer.amountCents) {
    return { provisioned: false, reason: "billing_offer_mismatch" };
  }
  const client = await pool.connect();
  let advisoryKey = "";
  let advisoryLockHeld = false;
  let transactionStarted = false;
  let discardClient = false;
  let row: PendingRow | undefined;
  let companyId = "";
  let storeId = "";
  let userId = "";
  let deferredSubscriptionStatus: string | null = null;
  try {
    const lookup = await client.query<{ owner_email_normalized: string }>(
      "select owner_email_normalized from pending_store_signups where id = $1 limit 1",
      [input.pendingId],
    );
    const emailNorm = lookup.rows[0]?.owner_email_normalized;
    if (!emailNorm) return { provisioned: false, reason: "pending_signup_not_claimable" };
    advisoryKey = `jewelhire:store-signup:${emailNorm}`;
    try {
      await client.query("select pg_advisory_lock(hashtextextended($1, 0))", [advisoryKey]);
      advisoryLockHeld = true;
    } catch (error) {
      discardClient = true;
      throw error;
    }
    await client.query("begin");
    transactionStarted = true;
    const pending = await client.query<PendingRow & {
      cancellation_reason: string | null;
      provider_checkout_session_id: string | null;
      provisioned_company_id: string | null;
      provisioned_store_id: string | null;
      provisioned_user_id: string | null;
      provisioned_at: Date | string | null;
    }>(
      `select id, company_name, owner_name, owner_email, owner_email_normalized,
              plan, billing_interval, status, cancellation_reason,
              provider_checkout_session_id, provisioned_company_id,
              provisioned_store_id, provisioned_user_id, provisioned_at
       from pending_store_signups
       where id = $1
       for update`,
      [input.pendingId],
    );
    const candidate = pending.rows[0];
    if (
      !candidate
      || candidate.provider_checkout_session_id !== input.checkoutSessionId
      || candidate.billing_interval !== input.billingInterval
    ) {
      await client.query("rollback");
      transactionStarted = false;
      return { provisioned: false, reason: "pending_signup_not_claimable" };
    }
    if (
      candidate.status === "provisioned"
      && candidate.provisioned_company_id
      && candidate.provisioned_store_id
      && candidate.provisioned_user_id
    ) {
      await client.query("commit");
      transactionStarted = false;
      return {
        provisioned: true,
        companyId: candidate.provisioned_company_id,
        storeId: candidate.provisioned_store_id,
        userId: candidate.provisioned_user_id,
        alreadyDone: true,
      };
    }
    const stuckProvision = candidate.status === "provisioned"
      && !candidate.provisioned_company_id
      && Boolean(candidate.provisioned_at)
      && new Date(candidate.provisioned_at!).getTime() < Date.now() - 2 * 60 * 1000;
    const claimable = candidate.status === "pending"
      || (candidate.status === "cancelled" && candidate.cancellation_reason === "checkout_replaced")
      || stuckProvision;
    if (!claimable) {
      await client.query("rollback");
      transactionStarted = false;
      return { provisioned: false, reason: "pending_signup_not_claimable" };
    }
    row = candidate;
    await client.query(
      `update pending_store_signups
       set status = 'provisioned', cancellation_reason = null,
           stripe_reference = coalesce($2, stripe_reference),
           provisioned_at = now(), updated_at = now()
       where id = $1`,
      [row.id, input.stripeReference || null],
    );

    const cancel = async (reason: string): Promise<ProvisionResult> => {
      await client.query(
        `update pending_store_signups
         set status = 'cancelled', cancellation_reason = $2, updated_at = now()
         where id = $1`,
        [row!.id, reason],
      );
      await client.query("commit");
      transactionStarted = false;
      console.warn(`[store-signup] provisioning cancelled for ${row!.id} (${emailNorm}): ${reason}`);
      return { provisioned: false, reason };
    };

    // Platform admins remain MFA-backed JewelLink-only, and payment can never
    // graft a new company onto an existing email identity.
    if (isConfiguredAdminEmail(emailNorm)) return cancel("admin_email_blocked");
    if (input.customerEmail && input.customerEmail.trim().toLowerCase() !== emailNorm) {
      return cancel("customer_email_mismatch");
    }
    const preexisting = await client.query<{ id: string }>(
      "select id from users where email_normalized = $1",
      [emailNorm],
    );
    if (preexisting.rows[0]) return cancel("owner_account_exists");

    const slug = await uniqueCompanySlug(client, row.company_name);
    companyId = `co-${slug}`;
    storeId = `store-${slug}-primary`;
    userId = `user-${slug}-owner`;
    const email = row.owner_email;
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
    // Fresh owner account, linked to the store as 'store_owner' (never 'admin').
    await client.query(
      `insert into users (id, company_id, email, email_normalized, name, status, created_at, updated_at)
       values ($1, $2, $3, $4, $5, 'active', now(), now())`,
      [userId, companyId, email, emailNorm, ownerName],
    );
    await client.query(
      `insert into store_users (id, store_id, user_id, role, status, created_at, updated_at)
       values ($1, $2, $3, 'store_owner', 'active', now(), now())
       on conflict (store_id, user_id) do nothing`,
      [`store-user-${slug}-owner`, storeId, userId],
    );

    // Active subscription — the payment that triggered this is already settled.
    const offerPlanCode = input.billingInterval === "year" ? "store_owner_annual" : "store_owner_monthly";
    const provisionalDays = input.billingInterval === "year" ? 370 : 32;
    await client.query(
      `insert into subscriptions (
         id, company_id, plan_id, status, current_period_start, current_period_end,
         provider, provider_subscription_id, created_at, updated_at
       )
       values (
         $1, $2, $3, 'active', now(), now() + ($5::text || ' days')::interval,
         'stripe', $4, now(), now()
       )
       on conflict (company_id) do update set
         plan_id = excluded.plan_id, status = 'active',
         current_period_start = excluded.current_period_start,
         current_period_end = excluded.current_period_end,
         provider = 'stripe', provider_subscription_id = excluded.provider_subscription_id,
         updated_at = now()`,
      [`sub-${companyId}`, companyId, `plan-${planDb}`, input.stripeReference || null, provisionalDays],
    );
    await client.query(
      `insert into company_access_entitlements (
         company_id, source, plan_code, status, billing_interval, amount_cents,
         provider_subscription_id, starts_at, expires_at, created_at, updated_at
       )
       values (
         $1, 'stripe', $2, 'active', $3, $4, $5,
         now(), now() + ($6::text || ' days')::interval, now(), now()
       )
       on conflict (company_id) do update set
         source = 'stripe', plan_code = excluded.plan_code, status = 'active',
         billing_interval = excluded.billing_interval, amount_cents = excluded.amount_cents,
         provider_subscription_id = excluded.provider_subscription_id,
         starts_at = now(), expires_at = excluded.expires_at, updated_at = now()`,
      [companyId, offerPlanCode, input.billingInterval, input.amountCents, input.stripeReference || null, provisionalDays],
    );

    if (input.stripeReference) {
      deferredSubscriptionStatus = await applyDeferredStandaloneSubscriptionState(client, {
        companyId,
        providerSubscriptionId: input.stripeReference,
        checkoutReferenceId: input.pendingId,
      });
    }

    await client.query(
      `update pending_store_signups
          set provisioned_company_id = $2, provisioned_store_id = $3, provisioned_user_id = $4, updated_at = now()
        where id = $1`,
      [row.id, companyId, storeId, userId],
    );
    await client.query("commit");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("rollback");
        transactionStarted = false;
      } catch {
        discardClient = true;
      }
    }
    throw error;
  } finally {
    if (advisoryLockHeld && !discardClient) {
      try {
        const unlocked = await client.query<{ unlocked: boolean }>(
          "select pg_advisory_unlock(hashtextextended($1, 0)) as unlocked",
          [advisoryKey],
        );
        if (unlocked.rows[0]?.unlocked !== true) discardClient = true;
      } catch {
        discardClient = true;
      }
    }
    client.release(discardClient);
  }

  if (!row || !companyId || !storeId || !userId) {
    throw new Error("Store signup provisioning committed without its required identity projection.");
  }

  // Email the account-claim link so the owner can set their password. Best-effort;
  // a mail failure must not undo the provisioning, but it IS surfaced (logs +
  // claimEmailSent) so a paid-but-unemailed owner can be found and recovered.
  let claimEmailSent = false;
  if (deferredSubscriptionStatus && !["active", "trialing"].includes(deferredSubscriptionStatus)) {
    console.warn(`[store-signup] ${input.stripeReference} was already ${deferredSubscriptionStatus}; provisioned data remains retained but no access claim was sent.`);
    return { provisioned: true, companyId, storeId, userId, claimEmailSent };
  }
  try {
    claimEmailSent = await withReplacingActionToken(
      {
        purpose: "account_claim",
        userId,
        email: row.owner_email,
        companyId,
        ttlMinutes: CLAIM_TTL_MINUTES,
      },
      async ({ token }) => {
        const notification = await notifyStoreOwnerClaim({
          toEmail: row.owner_email,
          name: row.owner_name,
          companyName: row.company_name,
          token,
          existingAccount: false,
        });
        const delivered = notification.status === "sent" || notification.status === "dry_run";
        return { commit: delivered, value: delivered };
      },
    );
    if (!claimEmailSent) {
      console.error(`[store-signup] claim email was not accepted for provisioned owner ${userId} (company ${companyId}).`);
    }
  } catch (error) {
    console.error(`[store-signup] claim email FAILED for provisioned owner ${userId} <${row.owner_email}> (company ${companyId}). They can recover via forgot-password.`, error);
  }

  return { provisioned: true, companyId, storeId, userId, claimEmailSent };
}
