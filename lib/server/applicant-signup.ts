import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { ApplicantProfileOwnershipConflictError, ensureApplicantProfileForUser } from "@/lib/server/applicant-profile-provisioning";
import { hashActionToken } from "@/lib/server/action-tokens";
import { isConfiguredAdminEmail } from "@/lib/server/auth";
import { recordLegalConsentInTransaction } from "@/lib/server/legal-consent";
import {
  notificationRuntimeStatus,
  notifyApplicantSignupRequested,
  type NotificationResult,
} from "@/lib/server/notifications";
import { hashPassword, isStrongPassword } from "@/lib/server/password-auth";
import { getPostgresPool } from "@/lib/server/postgres";
import { acceptsCurrentLegalTerms } from "@/lib/legal";

const VERIFICATION_TTL_MINUTES = 60;
const MAX_NAME_LENGTH = 160;
const MAX_TOKEN_LENGTH = 256;
const ACTIVE_EXTERNAL_INVITE_STATUSES = ["sent", "started"] as const;

type SignupNotifier = (input: { toEmail: string; token?: string }) => Promise<NotificationResult>;
type PasswordHasher = (password: string) => Promise<string>;

export type ApplicantSignupRequestResult = {
  notification: NotificationResult;
  pendingCreated: boolean;
};

export type ApplicantSignupCompletionResult =
  | { ok: true; userId: string; email: string; name: string }
  | {
      ok: false;
      reason:
        | "invalid_token"
        | "invalid_name"
        | "weak_password"
        | "legal_consent_required"
        | "profile_conflict"
        | "account_exists"
        | "jewellink_required";
    };

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function randomId(prefix: string) {
  return `${prefix}-${randomBytes(12).toString("base64url")}`;
}

async function hasActiveExternalJewelLinkInvite(
  client: Pick<PoolClient, "query">,
  emailNormalized: string,
) {
  const result = await client.query(
    `select 1
     from jewelcert_invites ji
     join applications a on a.id = ji.application_id
     where lower(btrim(ji.sent_to_email)) = $1
       and (ji.external_user_id is not null or a.source = 'jewellink_employee')
       and ji.status = any($2::text[])
       and (ji.expires_at is null or ji.expires_at > now())
     limit 1`,
    [emailNormalized, ACTIVE_EXTERNAL_INVITE_STATUSES],
  );
  return result.rows.length > 0;
}

export function applicantSignupEmailDeliveryReady() {
  const runtime = notificationRuntimeStatus();
  return runtime.enabled && !runtime.dryRun && runtime.providerConfigured;
}

type PreparedApplicantSignupRequest = {
  email: string;
  emailNormalized: string;
  token?: string;
  pendingId?: string;
};

async function prepareApplicantSignupRequest(
  email: string,
  emailNormalized: string,
): Promise<PreparedApplicantSignupRequest> {
  const pool = getPostgresPool();
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("begin");
    transactionOpen = true;
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [emailNormalized]);

    const existing = await client.query<{ id: string }>(
      "select id from users where email_normalized = $1 limit 1",
      [emailNormalized],
    );
    const externallyManaged = await hasActiveExternalJewelLinkInvite(client, emailNormalized);
    if (existing.rows[0] || isConfiguredAdminEmail(emailNormalized) || externallyManaged) {
      await client.query("delete from pending_applicant_signups where email_normalized = $1", [emailNormalized]);
      await client.query("commit");
      transactionOpen = false;
      return { email, emailNormalized };
    }

    const token = randomBytes(32).toString("base64url");
    const pendingId = randomId("pending-applicant");
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MINUTES * 60_000).toISOString();
    await client.query(
      `insert into pending_applicant_signups (
         id, email, email_normalized, token_hash, expires_at, created_at, updated_at
       )
       values ($1, $2, $3, $4, $5, now(), now())`,
      [pendingId, email, emailNormalized, hashActionToken(token), expiresAt],
    );
    await client.query("commit");
    transactionOpen = false;
    return { email, emailNormalized, token, pendingId };
  } catch (error) {
    if (transactionOpen) await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// Every resend is committed as an independently usable hashed token before
// Postmark starts. A definite provider rejection removes only that new row;
// network errors and timeouts remain usable because delivery is ambiguous.
// The preparation helper releases its client before this function calls notify.
export async function requestApplicantEmailVerification(
  input: { email: string },
  notify: SignupNotifier = notifyApplicantSignupRequested,
): Promise<ApplicantSignupRequestResult> {
  const email = input.email.trim();
  const emailNormalized = normalizedEmail(email);
  const pool = getPostgresPool();

  await pool.query("delete from pending_applicant_signups where expires_at <= now()");
  const prepared = await prepareApplicantSignupRequest(email, emailNormalized);
  const notification = await notify({ toEmail: prepared.email, token: prepared.token });

  if (prepared.pendingId && prepared.token && notification.delivery === "definite_failure") {
    await pool.query(
      "delete from pending_applicant_signups where id = $1 and token_hash = $2",
      [prepared.pendingId, hashActionToken(prepared.token)],
    );
  }
  return {
    notification,
    pendingCreated: Boolean(prepared.pendingId) && notification.delivery !== "definite_failure",
  };
}

export async function completeApplicantEmailVerification(input: {
  token: string;
  name: string;
  password: string;
  legalConsent?: unknown;
  legalPolicyVersion?: unknown;
}, hashCredential: PasswordHasher = hashPassword): Promise<ApplicantSignupCompletionResult> {
  const token = input.token.trim();
  const name = input.name.trim();
  if (!token || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "invalid_token" };
  if (name.length < 2 || name.length > MAX_NAME_LENGTH) return { ok: false, reason: "invalid_name" };
  if (!isStrongPassword(input.password)) return { ok: false, reason: "weak_password" };
  if (!acceptsCurrentLegalTerms(input)) return { ok: false, reason: "legal_consent_required" };

  const tokenHash = hashActionToken(token);
  const pool = getPostgresPool();

  // Reject arbitrary and expired tokens with a cheap indexed lookup before
  // running scrypt. The token is revalidated under a row lock below because a
  // concurrent completion can still consume it between these two checks.
  const preflight = await pool.query<{ email_normalized: string }>(
    `select email_normalized
     from pending_applicant_signups
     where token_hash = $1 and expires_at > now()
     limit 1`,
    [tokenHash],
  );
  if (!preflight.rows[0]) return { ok: false, reason: "invalid_token" };

  // Scrypt runs before the locking transaction so a valid but adversarial
  // request cannot hold the pending row lock during credential work.
  const passwordHash = await hashCredential(input.password);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      preflight.rows[0].email_normalized,
    ]);
    const pendingResult = await client.query<{
      id: string;
      email: string;
      email_normalized: string;
    }>(
      `select id, email, email_normalized
       from pending_applicant_signups
       where token_hash = $1 and expires_at > now()
       limit 1
       for update`,
      [tokenHash],
    );
    const pending = pendingResult.rows[0];
    if (!pending) {
      await client.query("rollback");
      return { ok: false, reason: "invalid_token" };
    }

    // The allowlist can change after issuance. Never let an outstanding public
    // link create native credentials for an MFA-only platform administrator.
    if (
      isConfiguredAdminEmail(pending.email_normalized)
      || await hasActiveExternalJewelLinkInvite(client, pending.email_normalized)
    ) {
      await client.query("delete from pending_applicant_signups where email_normalized = $1", [pending.email_normalized]);
      await client.query("commit");
      return { ok: false, reason: "jewellink_required" };
    }

    const userId = randomId("user");
    const insertedUser = await client.query<{ id: string }>(
      `insert into users (
         id, company_id, email, email_normalized, name, status,
         native_auth_enabled, created_at, updated_at
       )
       values ($1, null, $2, $3, $4, 'active', true, now(), now())
       on conflict (email_normalized) do nothing
       returning id`,
      [userId, pending.email, pending.email_normalized, name],
    );
    if (!insertedUser.rows[0]) {
      // An SSO, Google, or other verified identity source won after issuance.
      // Consume every setup token, but never graft a password onto that user.
      await client.query("delete from pending_applicant_signups where email_normalized = $1", [pending.email_normalized]);
      await client.query("commit");
      return { ok: false, reason: "account_exists" };
    }

    await ensureApplicantProfileForUser(client, {
      userId,
      email: pending.email,
      name,
      profileId: randomId("profile"),
    });
    await client.query(
      `insert into password_credentials (id, user_id, password_hash, created_at, updated_at)
       values ($1, $2, $3, now(), now())`,
      [`pwc-${userId}`, userId, passwordHash],
    );
    await recordLegalConsentInTransaction(client, {
      email: pending.email,
      source: "applicant_signup",
      context: { pendingSignupId: pending.id, verification: "email_link" },
    });
    const consumed = await client.query<{ token_hash: string }>(
      "delete from pending_applicant_signups where email_normalized = $1 returning token_hash",
      [pending.email_normalized],
    );
    if (!consumed.rows.some((row) => row.token_hash === tokenHash)) {
      throw new Error("Applicant-signup token lost its single-use lock.");
    }

    const settlement = await client.query("commit");
    if (settlement.command !== "COMMIT") {
      throw new Error(`Applicant-signup completion expected COMMIT but PostgreSQL returned ${settlement.command || "no command"}.`);
    }
    return { ok: true, userId, email: pending.email, name };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (error instanceof ApplicantProfileOwnershipConflictError) {
      return { ok: false, reason: "profile_conflict" };
    }
    throw error;
  } finally {
    client.release();
  }
}
