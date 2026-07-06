// JewelCert quick-claim: let someone who was sent a JewelCert but has no account
// create a password in one step and go straight into the taker.
//
// The claim link carries a deterministic HMAC of the invite id (verifiable with
// AUTH_SECRET, unguessable without it) instead of a stored random token — so no
// migration and no raw-token threading through invite creation. Expiry reuses
// the invite's own expires_at; the claim is naturally one-shot because once the
// account exists we redirect to login instead of resetting a password.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { authSecret } from "@/lib/server/auth";
import { getPostgresPool } from "@/lib/server/postgres";

export function signInviteClaim(inviteId: string): string {
  // Same secret as session signing — authSecret() throws if AUTH_SECRET is unset
  // while auth is required, so claim tokens can't silently fall back to a
  // well-known dev key in a live deployment.
  return createHmac("sha256", authSecret()).update(`jewelcert-claim:${inviteId}`).digest("base64url");
}

export function verifyInviteClaim(inviteId: string, token: string): boolean {
  if (!inviteId || !token) return false;
  const expected = signInviteClaim(inviteId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface ClaimableInvite {
  inviteId: string;
  email: string;
  applicationId: string;
  status: string;
  storeId: string;
  expired: boolean;
}

export async function getClaimableInvite(inviteId: string): Promise<ClaimableInvite | undefined> {
  const r = await getPostgresPool().query<{
    id: string;
    sent_to_email: string;
    application_id: string;
    status: string;
    store_id: string;
    expires_at: string | null;
  }>(
    `select id, sent_to_email, application_id, status, store_id, expires_at
     from jewelcert_invites where id = $1 limit 1`,
    [inviteId],
  );
  const row = r.rows[0];
  if (!row) return undefined;
  return {
    inviteId: row.id,
    email: row.sent_to_email,
    applicationId: row.application_id,
    status: row.status,
    storeId: row.store_id,
    expired: Boolean(row.expires_at) && new Date(row.expires_at as string).getTime() < Date.now(),
  };
}

export async function userExistsForEmail(email: string): Promise<boolean> {
  const r = await getPostgresPool().query(`select 1 from users where email_normalized = $1 limit 1`, [
    email.trim().toLowerCase(),
  ]);
  return r.rows.length > 0;
}

// Create the applicant's user (associate — no store link) and adopt any
// applicant_profile(s) already created for that email (e.g. from a public
// application), so they see their applications/invites after signing in.
export async function createAssociateUserAndLinkProfile(input: {
  email: string;
  name?: string | null;
}): Promise<string> {
  const email = input.email.trim();
  const emailNorm = email.toLowerCase();
  const userId = `user-${randomBytes(9).toString("base64url")}`;
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into users (id, email, email_normalized, name, status) values ($1, $2, $3, $4, 'active')`,
      [userId, email, emailNorm, input.name?.trim() || email],
    );
    await client.query(
      `update applicant_profiles set owner_user_id = $1, updated_at = now()
       where email_normalized = $2 and owner_user_id is null`,
      [userId, emailNorm],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return userId;
}
