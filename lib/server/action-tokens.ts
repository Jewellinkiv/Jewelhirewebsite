// Single-use, expiring email-action tokens (password reset, account claim).
// The raw token goes in the email; only its SHA-256 hash is persisted, so a DB
// read can't reveal a usable token. Each redemption service owns the complete
// policy, credential, audit, and token transaction for its purpose.

import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { getPostgresPool } from "@/lib/server/postgres";

export type ActionPurpose = "password_reset" | "account_claim";

export function hashActionToken(raw: string) {
  return createHash("sha256").update(raw).digest("base64url");
}

export function isPlausibleActionToken(purpose: ActionPurpose, raw: string) {
  if (purpose === "password_reset") return /^pr2_[A-Za-z0-9_-]{43}$/.test(raw);
  return /^ac2_[A-Za-z0-9_-]{43}$/.test(raw);
}

type ActionTokenInputBase = {
  userId: string;
  email: string;
  ttlMinutes: number;
};

export type CreateActionTokenInput =
  | (ActionTokenInputBase & { purpose: "password_reset"; companyId?: never })
  | (ActionTokenInputBase & { purpose: "account_claim"; companyId: string });

type ReplacingTokenOperation<T> = (input: {
  client: PoolClient;
  token: string;
  tokenId: string;
}) => Promise<{ commit: boolean; value: T }>;

export async function attemptBestEffortTransactionOperation<T>(
  client: PoolClient,
  operation: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  // PostgreSQL marks the whole transaction aborted after any statement error.
  // Keep non-critical work behind a savepoint so callers can recover without
  // silently turning a later COMMIT into a ROLLBACK.
  await client.query("savepoint best_effort_transaction_operation");
  try {
    const value = await operation();
    await client.query("release savepoint best_effort_transaction_operation");
    return { ok: true, value };
  } catch (error) {
    await client.query("rollback to savepoint best_effort_transaction_operation");
    await client.query("release savepoint best_effort_transaction_operation");
    return { ok: false, error };
  }
}

function tokenValues(input: CreateActionTokenInput) {
  const entropy = randomBytes(32).toString("base64url");
  // Password-reset v2 is fragment-only. Version the raw bearer so a legacy
  // token that was sent in a query string (and may exist in access logs) can
  // never be redeemed by the hardened completion endpoint after cutover.
  const raw = input.purpose === "password_reset" ? `pr2_${entropy}` : `ac2_${entropy}`;
  const id = `atk-${randomBytes(9).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000).toISOString();
  const companyId = input.purpose === "account_claim" ? input.companyId.trim() : null;
  if (input.purpose === "account_claim" && !companyId) {
    throw new Error("Account-claim tokens require an authorizing company.");
  }
  return { raw, id, expiresAt, companyId };
}

async function replaceActionTokenInTransaction(client: PoolClient, input: CreateActionTokenInput) {
  const values = tokenValues(input);
  // Every issuer uses the same user-row lock and keeps it until its surrounding
  // transaction commits or rolls back. This serializes issuance across app
  // instances without relying on process-local mutexes.
  const locked = await client.query<{ id: string }>(
    "select id from users where id = $1 for update",
    [input.userId],
  );
  if (!locked.rows[0]) throw new Error("Action-token user does not exist.");
  await client.query(
    `update auth_action_tokens
     set used_at = now()
     where purpose = $1 and user_id = $2 and used_at is null`,
    [input.purpose, input.userId],
  );
  await client.query(
    `insert into auth_action_tokens (
       id, purpose, user_id, email_normalized, token_hash, expires_at, company_id
     )
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      values.id,
      input.purpose,
      input.userId,
      input.email.trim().toLowerCase(),
      hashActionToken(values.raw),
      values.expiresAt,
      values.companyId,
    ],
  );
  return { token: values.raw, tokenId: values.id };
}

// The operation callback runs while the user-row lock and replacement token are
// uncommitted. A failed delivery returns commit=false, rolling back both the new
// token and its invalidation of the previously valid link.
export async function withReplacingActionToken<T>(
  input: CreateActionTokenInput,
  operation: ReplacingTokenOperation<T>,
): Promise<T> {
  const client = await getPostgresPool().connect();
  let settled = false;
  try {
    await client.query("begin");
    const issued = await replaceActionTokenInTransaction(client, input);
    const outcome = await operation({ client, ...issued });
    const expectedCommand = outcome.commit ? "COMMIT" : "ROLLBACK";
    const settlement = await client.query(outcome.commit ? "commit" : "rollback");
    if (settlement.command !== expectedCommand) {
      // PostgreSQL returns command=ROLLBACK (without throwing) when COMMIT is
      // issued for an aborted transaction. Never report a delivered token as
      // usable when its database transaction was actually discarded.
      settled = settlement.command === "COMMIT" || settlement.command === "ROLLBACK";
      throw new Error(
        `Action-token transaction expected ${expectedCommand} but PostgreSQL returned ${settlement.command || "no command"}.`,
      );
    }
    settled = true;
    return outcome.value;
  } catch (error) {
    if (!settled) {
      try {
        await client.query("rollback");
      } catch {
        // Preserve the original issuance/delivery failure.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export type PasswordResetDeliveryOutcome = "accepted" | "definite_failure" | "ambiguous";

// Persist a hashed candidate in a short transaction without invalidating the
// prior active reset link. Provider I/O happens only after this client has been
// released. The delivery-state migration intentionally permits independently
// pending password-reset candidates while account claims remain unique.
export async function preparePasswordResetTokenReplacement(input: {
  userId: string;
  email: string;
  ttlMinutes: number;
}): Promise<{ token: string; tokenId: string }> {
  const values = tokenValues({ purpose: "password_reset", ...input });
  const client = await getPostgresPool().connect();
  let settled = false;
  try {
    await client.query("begin");
    const locked = await client.query<{ id: string }>(
      "select id from users where id = $1 for update",
      [input.userId],
    );
    if (!locked.rows[0]) throw new Error("Password-reset user does not exist.");
    await client.query(
      `insert into auth_action_tokens (
         id, purpose, user_id, email_normalized, token_hash, expires_at,
         company_id, delivery_state, created_at
       )
       values (
         $1, 'password_reset', $2, $3, $4, $5, null, 'pending',
         (
           select greatest(
             clock_timestamp(),
             coalesce(max(created_at) + interval '1 microsecond', '-infinity'::timestamptz)
           )
           from auth_action_tokens
           where user_id = $2 and purpose = 'password_reset'
         )
       )`,
      [
        values.id,
        input.userId,
        input.email.trim().toLowerCase(),
        hashActionToken(values.raw),
        values.expiresAt,
      ],
    );
    const settlement = await client.query("commit");
    settled = settlement.command === "COMMIT" || settlement.command === "ROLLBACK";
    if (settlement.command !== "COMMIT") {
      throw new Error("Password-reset candidate transaction did not commit.");
    }
    return { token: values.raw, tokenId: values.id };
  } catch (error) {
    if (!settled) await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// Settle provider delivery without ever holding a pool client during network
// I/O. Definite rejection invalidates only the undelivered candidate. Accepted
// and ambiguous outcomes promote the newest successfully delivered candidate
// and retire all older bearers. Newer pending deliveries settle independently.
// A process exit before this phase leaves the hashed pending bearer redeemable,
// which is safer than rejecting a link Postmark may already have delivered.
export async function finalizePasswordResetTokenReplacement(input: {
  userId: string;
  tokenId: string;
  outcome: PasswordResetDeliveryOutcome;
}): Promise<"settled" | "already_settled" | "missing"> {
  const client = await getPostgresPool().connect();
  let settled = false;
  try {
    await client.query("begin");
    const locked = await client.query<{ id: string }>(
      "select id from users where id = $1 for update",
      [input.userId],
    );
    if (!locked.rows[0]) {
      await client.query("rollback");
      settled = true;
      return "missing";
    }
    const candidateResult = await client.query<{
      id: string;
      used_at: Date | null;
      delivery_state: string;
    }>(
      `select id, used_at, delivery_state
       from auth_action_tokens
       where id = $1 and user_id = $2 and purpose = 'password_reset'
       for update`,
      [input.tokenId, input.userId],
    );
    const candidate = candidateResult.rows[0];
    if (!candidate) {
      await client.query("rollback");
      settled = true;
      return "missing";
    }
    if (candidate.used_at || candidate.delivery_state !== "pending") {
      const settlement = await client.query("commit");
      settled = settlement.command === "COMMIT" || settlement.command === "ROLLBACK";
      if (settlement.command !== "COMMIT") throw new Error("Password-reset settlement did not commit.");
      return "already_settled";
    }

    if (input.outcome === "definite_failure") {
      await client.query(
        `update auth_action_tokens
         set used_at = now(), delivery_state = 'rejected'
         where id = $1 and user_id = $2 and used_at is null and delivery_state = 'pending'`,
        [input.tokenId, input.userId],
      );
    } else {
      const newerActive = await client.query<{ id: string }>(
        `select newer.id
         from auth_action_tokens newer
         join auth_action_tokens candidate
           on candidate.id = $2
          and candidate.user_id = $1
          and candidate.purpose = 'password_reset'
         where newer.purpose = 'password_reset'
           and newer.user_id = $1
           and newer.used_at is null
           and newer.delivery_state = 'active'
           and (newer.created_at, newer.id) > (candidate.created_at, candidate.id)
         limit 1
         for update of newer`,
        [input.userId, candidate.id],
      );
      if (newerActive.rows[0]) {
        await client.query(
          `update auth_action_tokens
           set used_at = now(), delivery_state = 'superseded'
           where id = $1 and user_id = $2 and used_at is null and delivery_state = 'pending'`,
          [input.tokenId, input.userId],
        );
      } else {
        // A successfully delivered candidate retires every older bearer,
        // including a pending delivery whose settlement previously failed.
        // Newer pending sends remain independent until their own outcome is
        // known. This makes the winner depend on issuance order, never provider
        // response order.
        await client.query(
          `update auth_action_tokens older
           set used_at = now(),
               delivery_state = case
                 when older.delivery_state = 'pending' then 'superseded'
                 else older.delivery_state
               end
           from auth_action_tokens candidate
           where candidate.id = $2
             and candidate.user_id = $1
             and candidate.purpose = 'password_reset'
             and older.purpose = 'password_reset'
             and older.user_id = $1
             and older.used_at is null
             and (older.created_at, older.id) < (candidate.created_at, candidate.id)`,
          [input.userId, candidate.id],
        );
        const promoted = await client.query<{ id: string }>(
          `update auth_action_tokens
           set delivery_state = 'active'
           where id = $1
             and user_id = $2
             and used_at is null
             and delivery_state = 'pending'
           returning id`,
          [input.tokenId, input.userId],
        );
        if (!promoted.rows[0]) throw new Error("Password-reset candidate could not be promoted.");
      }
    }

    const settlement = await client.query("commit");
    settled = settlement.command === "COMMIT" || settlement.command === "ROLLBACK";
    if (settlement.command !== "COMMIT") throw new Error("Password-reset settlement did not commit.");
    return "settled";
  } catch (error) {
    if (!settled) await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// Atomic replacement for call sites that do not need to keep issuance open
// through an external delivery attempt.
export async function createActionToken(input: CreateActionTokenInput): Promise<string> {
  return withReplacingActionToken(input, async ({ token }) => ({ commit: true, value: token }));
}

// Non-consuming validity check used by claim previews and focused database
// tests. Redemption must always use its purpose-specific transaction instead.
export async function isActionTokenValid(input: { purpose: ActionPurpose; token: string }): Promise<boolean> {
  if (!isPlausibleActionToken(input.purpose, input.token)) return false;
  const found = await getPostgresPool().query<{ id: string }>(
    `select id from auth_action_tokens
     where purpose = $1 and token_hash = $2 and used_at is null and expires_at > now()
       and ($1 <> 'account_claim' or company_id is not null)
     limit 1`,
    [input.purpose, hashActionToken(input.token)],
  );
  return Boolean(found.rows[0]);
}

// Non-consuming subject lookup lets callers reject identities that can never
// redeem a token (notably the MFA-only platform-admin allowlist) without burning
// the link. The transactional redemption path must still repeat every check
// under a row lock before committing any mutation.
export async function findActionTokenSubject(input: {
  purpose: ActionPurpose;
  token: string;
}): Promise<{ userId: string; email: string; currentEmail?: string; companyId?: string } | undefined> {
  if (!isPlausibleActionToken(input.purpose, input.token)) return undefined;
  const found = await getPostgresPool().query<{
    user_id: string;
    email_normalized: string;
    current_email: string | null;
    company_id: string | null;
  }>(
    `select token.user_id, token.email_normalized, token.company_id, users.email as current_email
     from auth_action_tokens token
     left join users on users.id = token.user_id
     where token.purpose = $1
       and token.token_hash = $2
       and token.used_at is null
       and token.expires_at > now()
       and ($1 <> 'account_claim' or token.company_id is not null)
     limit 1`,
    [input.purpose, hashActionToken(input.token)],
  );
  const row = found.rows[0];
  return row ? {
    userId: row.user_id,
    email: row.email_normalized,
    currentEmail: row.current_email || undefined,
    companyId: row.company_id || undefined,
  } : undefined;
}

// Invalidate any outstanding tokens of a purpose for a user (e.g. when a new
// reset is requested, or after a successful password change).
export async function invalidateActionTokens(purpose: ActionPurpose, userId: string): Promise<void> {
  await getPostgresPool().query(
    `update auth_action_tokens set used_at = now() where purpose = $1 and user_id = $2 and used_at is null`,
    [purpose, userId],
  );
}
