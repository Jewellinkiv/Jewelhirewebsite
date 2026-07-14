// Single-use, expiring email-action tokens (password reset, account claim).
// The raw token goes in the email; only its SHA-256 hash is persisted, so a DB
// read can't reveal a usable token. Consumption is atomic (conditional update)
// so a token can't be redeemed twice, even under a race.

import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { getPostgresPool } from "@/lib/server/postgres";

export type ActionPurpose = "password_reset" | "account_claim";

export function hashActionToken(raw: string) {
  return createHash("sha256").update(raw).digest("base64url");
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
  const raw = randomBytes(32).toString("base64url");
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

// Atomic replacement for call sites that do not need to keep issuance open
// through an external delivery attempt.
export async function createActionToken(input: CreateActionTokenInput): Promise<string> {
  return withReplacingActionToken(input, async ({ token }) => ({ commit: true, value: token }));
}

// Returns the token's subject and marks it used, or undefined if invalid /
// expired / already used.
export async function consumeActionToken(input: {
  purpose: ActionPurpose;
  token: string;
}): Promise<{ userId: string; email: string; companyId?: string } | undefined> {
  if (!input.token) return undefined;
  const pool = getPostgresPool();
  const found = await pool.query<{ id: string; user_id: string; email_normalized: string; company_id: string | null }>(
    `select id, user_id, email_normalized, company_id from auth_action_tokens
     where purpose = $1 and token_hash = $2 and used_at is null and expires_at > now()
       and ($1 <> 'account_claim' or company_id is not null)
     limit 1`,
    [input.purpose, hashActionToken(input.token)],
  );
  const row = found.rows[0];
  if (!row) return undefined;
  // Re-check expiry in the same atomic claim so a token that lapses between the
  // SELECT and the UPDATE can't still be consumed.
  const claimed = await pool.query(
    `update auth_action_tokens set used_at = now() where id = $1 and used_at is null and expires_at > now()`,
    [row.id],
  );
  if (!claimed.rowCount) return undefined; // lost a race, or just expired
  return { userId: row.user_id, email: row.email_normalized, companyId: row.company_id || undefined };
}

// Non-consuming validity check — used by claim/reset pages to decide whether to
// show the set-password form without burning the single use.
export async function isActionTokenValid(input: { purpose: ActionPurpose; token: string }): Promise<boolean> {
  if (!input.token) return false;
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
  if (!input.token) return undefined;
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
