// Single-use, expiring email-action tokens (password reset, account claim).
// The raw token goes in the email; only its SHA-256 hash is persisted, so a DB
// read can't reveal a usable token. Consumption is atomic (conditional update)
// so a token can't be redeemed twice, even under a race.

import { createHash, randomBytes } from "node:crypto";
import { getPostgresPool } from "@/lib/server/postgres";

export type ActionPurpose = "password_reset" | "account_claim";

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("base64url");
}

export async function createActionToken(input: {
  purpose: ActionPurpose;
  userId: string;
  email: string;
  ttlMinutes: number;
}): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  const id = `atk-${randomBytes(9).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000).toISOString();
  await getPostgresPool().query(
    `insert into auth_action_tokens (id, purpose, user_id, email_normalized, token_hash, expires_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, input.purpose, input.userId, input.email.trim().toLowerCase(), hashToken(raw), expiresAt],
  );
  return raw;
}

// Returns the token's subject and marks it used, or undefined if invalid /
// expired / already used.
export async function consumeActionToken(input: {
  purpose: ActionPurpose;
  token: string;
}): Promise<{ userId: string; email: string } | undefined> {
  if (!input.token) return undefined;
  const pool = getPostgresPool();
  const found = await pool.query<{ id: string; user_id: string; email_normalized: string }>(
    `select id, user_id, email_normalized from auth_action_tokens
     where purpose = $1 and token_hash = $2 and used_at is null and expires_at > now()
     limit 1`,
    [input.purpose, hashToken(input.token)],
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
  return { userId: row.user_id, email: row.email_normalized };
}

// Non-consuming validity check — used by claim/reset pages to decide whether to
// show the set-password form without burning the single use.
export async function isActionTokenValid(input: { purpose: ActionPurpose; token: string }): Promise<boolean> {
  if (!input.token) return false;
  const found = await getPostgresPool().query<{ id: string }>(
    `select id from auth_action_tokens
     where purpose = $1 and token_hash = $2 and used_at is null and expires_at > now()
     limit 1`,
    [input.purpose, hashToken(input.token)],
  );
  return Boolean(found.rows[0]);
}

// Invalidate any outstanding tokens of a purpose for a user (e.g. when a new
// reset is requested, or after a successful password change).
export async function invalidateActionTokens(purpose: ActionPurpose, userId: string): Promise<void> {
  await getPostgresPool().query(
    `update auth_action_tokens set used_at = now() where purpose = $1 and user_id = $2 and used_at is null`,
    [purpose, userId],
  );
}
