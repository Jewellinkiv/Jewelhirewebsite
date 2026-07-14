// JewelCert quick-claim: let someone who was sent a JewelCert but has no account
// create a password in one step and go straight into the taker.
//
// The claim link carries a deterministic HMAC of both the invite id and current
// normalized recipient (verifiable with AUTH_SECRET, unguessable without it).
// Recipient reassignment therefore invalidates every prior link. Expiry reuses
// the invite's own expires_at; once an account exists we redirect to login
// instead of ever resetting a password through this bearer.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  ApplicantProfileOwnershipConflictError,
  ensureApplicantProfileForUser,
} from "@/lib/server/applicant-profile-provisioning";
import { acceptsCurrentLegalTerms } from "@/lib/legal";
import { authSecret, isConfiguredAdminEmail } from "@/lib/server/auth";
import { recordLegalConsentInTransaction } from "@/lib/server/legal-consent";
import { acquireJewelCertInviteTransactionLock } from "@/lib/server/jewelcert-invite-lock";
import { hashPassword, isStrongPassword } from "@/lib/server/password-auth";
import { getPostgresPool } from "@/lib/server/postgres";

const CLAIMABLE_INVITE_STATUSES = ["sent", "started"] as const;
const MAX_NAME_LENGTH = 160;
const MAX_INVITE_ID_LENGTH = 512;
const INVITE_CLAIM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type PasswordHasher = (password: string) => Promise<string>;

export type JewelCertInviteClaimResult =
  | { ok: true; userId: string; email: string; name: string }
  | {
      ok: false;
      reason:
        | "invalid_link"
        | "invite_unavailable"
        | "invalid_name"
        | "weak_password"
        | "legal_consent_required"
        | "existing_account"
        | "jewellink_required"
        | "profile_conflict";
    };

export function isClaimableInviteStatus(status: string) {
  return (CLAIMABLE_INVITE_STATUSES as readonly string[]).includes(status);
}

function normalizedRecipientEmail(email: string) {
  return email.trim().toLowerCase();
}

function inviteRequiresJewelLink(input: {
  external_user_id?: string | null;
  application_source?: string | null;
}) {
  return Boolean(input.external_user_id?.trim()) || input.application_source === "jewellink_employee";
}

export function isInviteClaimTokenCandidate(token: unknown): token is string {
  return typeof token === "string" && INVITE_CLAIM_TOKEN_PATTERN.test(token);
}

export function isInviteIdCandidate(inviteId: unknown): inviteId is string {
  if (typeof inviteId !== "string") return false;
  const normalized = inviteId.trim();
  return normalized.length > 0 && normalized.length <= MAX_INVITE_ID_LENGTH;
}

export function signInviteClaim(inviteId: string, recipientEmail: string): string {
  const normalizedInviteId = inviteId.trim();
  const email = normalizedRecipientEmail(recipientEmail);
  if (!isInviteIdCandidate(normalizedInviteId) || !email.includes("@")) {
    throw new Error("A JewelCert claim signature requires an invite and recipient email.");
  }
  // Same secret as session signing — authSecret() throws if AUTH_SECRET is unset
  // while auth is required, so claim tokens can't silently fall back to a
  // well-known dev key in a live deployment.
  const payload = JSON.stringify(["jewelcert-claim", 2, normalizedInviteId, email]);
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

export function verifyInviteClaim(inviteId: string, recipientEmail: string, token: string): boolean {
  if (!isInviteIdCandidate(inviteId) || !normalizedRecipientEmail(recipientEmail).includes("@") || !isInviteClaimTokenCandidate(token)) {
    return false;
  }
  const expected = signInviteClaim(inviteId, recipientEmail);
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
  requiresJewelLink: boolean;
}

export async function getClaimableInvite(inviteId: string): Promise<ClaimableInvite | undefined> {
  if (!isInviteIdCandidate(inviteId)) return undefined;
  const r = await getPostgresPool().query<{
    id: string;
    sent_to_email: string;
    application_id: string;
    status: string;
    store_id: string;
    expires_at: string | null;
    external_user_id: string | null;
    application_source: string;
  }>(
    `select ji.id, ji.sent_to_email, ji.application_id, ji.status, ji.store_id,
            ji.expires_at, ji.external_user_id, a.source as application_source
     from jewelcert_invites ji
     join applications a on a.id = ji.application_id
     where ji.id = $1
     limit 1`,
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
    requiresJewelLink: inviteRequiresJewelLink(row),
  };
}

export async function userExistsForEmail(email: string): Promise<boolean> {
  const r = await getPostgresPool().query(`select 1 from users where email_normalized = $1 limit 1`, [
    email.trim().toLowerCase(),
  ]);
  return r.rows.length > 0;
}

// Redeem a signed JewelCert invitation into a native applicant account. The
// password is deliberately hashed before the advisory/row locks, then invite
// eligibility, identity creation, profile ownership, credential persistence,
// and legal evidence all settle in one transaction.
export async function completeJewelCertInviteClaim(input: {
  inviteId: string;
  token: string;
  name?: string | null;
  password: string;
  legalConsent?: unknown;
  legalPolicyVersion?: unknown;
}, hashCredential: PasswordHasher = hashPassword): Promise<JewelCertInviteClaimResult> {
  const inviteId = input.inviteId.trim();
  const name = input.name?.trim() || "";
  if (!isInviteIdCandidate(inviteId) || !isInviteClaimTokenCandidate(input.token)) return { ok: false, reason: "invalid_link" };

  const pool = getPostgresPool();
  const preflightResult = await pool.query<{
    sent_to_email: string;
    email_normalized: string;
    external_user_id: string | null;
    application_source: string;
  }>(
    `select ji.sent_to_email, lower(btrim(ji.sent_to_email)) as email_normalized,
            ji.external_user_id, a.source as application_source
     from jewelcert_invites ji
     join applications a on a.id = ji.application_id
     where ji.id = $1
       and ji.status = any($2::text[])
       and (ji.expires_at is null or ji.expires_at > now())
     limit 1`,
    [inviteId, CLAIMABLE_INVITE_STATUSES],
  );
  const preflight = preflightResult.rows[0];
  if (!preflight?.email_normalized) return { ok: false, reason: "invite_unavailable" };
  if (!verifyInviteClaim(inviteId, preflight.email_normalized, input.token)) {
    return { ok: false, reason: "invalid_link" };
  }
  if (inviteRequiresJewelLink(preflight) || isConfiguredAdminEmail(preflight.email_normalized)) {
    return { ok: false, reason: "jewellink_required" };
  }
  if (name.length > MAX_NAME_LENGTH) return { ok: false, reason: "invalid_name" };
  if (!isStrongPassword(input.password)) return { ok: false, reason: "weak_password" };
  if (!acceptsCurrentLegalTerms(input)) return { ok: false, reason: "legal_consent_required" };

  // Scrypt must finish before either the cross-flow email lock or invite-row
  // lock is held. A later transaction re-read closes the preflight/hash race.
  const passwordHash = await hashCredential(input.password);
  const client = await pool.connect();
  let settled = false;
  try {
    await client.query("begin");
    // Integration resends/reassignments take this exact invite-scoped lock
    // before touching either profiles or the invite row.
    await acquireJewelCertInviteTransactionLock(client, inviteId);
    // Verified signup takes this exact lock too. Whichever account-creation path
    // wins causes the other to return an existing-account result, never to graft
    // its password or profile onto a competing identity.
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [preflight.email_normalized]);

    const inviteResult = await client.query<{
      id: string;
      application_id: string;
      store_id: string;
      sent_to_email: string;
      email_normalized: string;
      status: string;
      expired: boolean;
      external_user_id: string | null;
      application_source: string;
    }>(
      `select
         ji.id,
         ji.application_id,
         ji.store_id,
         ji.sent_to_email,
         lower(btrim(ji.sent_to_email)) as email_normalized,
         ji.status,
         ji.external_user_id,
         a.source as application_source,
         (ji.expires_at is not null and ji.expires_at <= now()) as expired
       from jewelcert_invites ji
       join applications a on a.id = ji.application_id
       where ji.id = $1
       for update of ji`,
      [inviteId],
    );
    const invite = inviteResult.rows[0];
    if (
      !invite
      || invite.expired
      || !isClaimableInviteStatus(invite.status)
    ) {
      await client.query("rollback");
      settled = true;
      return { ok: false, reason: "invite_unavailable" };
    }
    if (
      invite.email_normalized !== preflight.email_normalized
      || !verifyInviteClaim(inviteId, invite.email_normalized, input.token)
    ) {
      await client.query("rollback");
      settled = true;
      return { ok: false, reason: "invalid_link" };
    }
    if (inviteRequiresJewelLink(invite) || isConfiguredAdminEmail(invite.email_normalized)) {
      await client.query("rollback");
      settled = true;
      return { ok: false, reason: "jewellink_required" };
    }

    const userId = `user-${randomBytes(12).toString("base64url")}`;
    const insertedUser = await client.query<{ id: string }>(
      `insert into users (
         id, company_id, email, email_normalized, name, status,
         native_auth_enabled, created_at, updated_at
       )
       values ($1, null, $2, $3, $4, 'active', true, now(), now())
       on conflict (email_normalized) do nothing
       returning id`,
      [userId, invite.sent_to_email.trim(), invite.email_normalized, name || invite.sent_to_email.trim()],
    );
    if (!insertedUser.rows[0]) {
      await client.query("rollback");
      settled = true;
      return { ok: false, reason: "existing_account" };
    }

    await ensureApplicantProfileForUser(client, {
      userId,
      email: invite.sent_to_email,
      name,
      profileId: `profile-${randomBytes(12).toString("base64url")}`,
    });
    await client.query(
      `insert into password_credentials (id, user_id, password_hash, created_at, updated_at)
       values ($1, $2, $3, now(), now())`,
      [`pwc-${userId}`, userId, passwordHash],
    );
    await recordLegalConsentInTransaction(client, {
      email: invite.sent_to_email,
      source: "applicant_signup",
      context: {
        verification: "jewelcert_invite",
        inviteId: invite.id,
        applicationId: invite.application_id,
        storeId: invite.store_id,
      },
    });

    const settlement = await client.query("commit");
    settled = settlement.command === "COMMIT" || settlement.command === "ROLLBACK";
    if (settlement.command !== "COMMIT") {
      throw new Error(
        `JewelCert claim expected COMMIT but PostgreSQL returned ${settlement.command || "no command"}.`,
      );
    }
    return {
      ok: true,
      userId,
      email: invite.sent_to_email.trim(),
      name: name || invite.sent_to_email.trim(),
    };
  } catch (error) {
    if (!settled) await client.query("rollback").catch(() => undefined);
    if (error instanceof ApplicantProfileOwnershipConflictError) {
      return { ok: false, reason: "profile_conflict" };
    }
    throw error;
  } finally {
    client.release();
  }
}
