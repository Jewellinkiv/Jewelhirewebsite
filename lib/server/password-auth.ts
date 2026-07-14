import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { hashActionToken, isPlausibleActionToken } from "@/lib/server/action-tokens";
import { getPostgresPool } from "@/lib/server/postgres";
import { findSessionForVerifiedNativeCredential, isConfiguredAdminEmail } from "@/lib/server/auth";
import type { AuthSession } from "@/lib/server/auth";

// Re-exported from the shared client/server policy so validation can't drift.
export { isStrongPassword } from "@/lib/password-policy";

const passwordKeyLength = 64;
const passwordParams = {
  N: 16_384,
  r: 8,
  p: 1,
};
// A valid, fixed-cost scrypt record for identities without a credential row.
// Its plaintext is not a credential: the result is always rejected when no
// database row exists. Keeping a real record here makes unknown and known
// mailboxes perform exactly one bounded KDF before the generic response.
const dummyPasswordHash = "scrypt$1$16384$8$1$jewelhire-login-dummy-v1$xUpumjpKfSxF5r735REvV6nxVIDUBPAxU_j1-Bgn2H_DrV4jh4Fa58jRQPnb5emaG2HzziLkwZbq7Fx-zhMJQg";

export type PasswordLoginResult =
  | { ok: true; session: AuthSession }
  | { ok: false; code: "invalid_credentials" | "jewellink_required" | "config" | "error" };

export async function loginWithPassword(input: { email: string; password: string }): Promise<PasswordLoginResult> {
  if (!input.email || !input.password) return { ok: false, code: "invalid_credentials" };

  try {
    const email = normalizeEmail(input.email);
    const result = await getPostgresPool().query<{
      id: string;
      email: string;
      name: string;
      password_hash: string;
      native_auth_enabled: boolean;
      native_auth_epoch: number;
    }>(
      `
        select u.id, u.email, u.name, u.native_auth_enabled, u.native_auth_epoch, pc.password_hash
        from users u
        join password_credentials pc on pc.user_id = u.id
        where u.email_normalized = $1
          and u.status = 'active'
        limit 1
      `,
      [email],
    );
    const row = result.rows[0];
    const storedHashIsSupported = isSupportedPasswordHash(row?.password_hash);
    const passwordMatches = await verifyPassword(
      input.password,
      storedHashIsSupported ? row!.password_hash : dummyPasswordHash,
    );
    if (!row || !storedHashIsSupported || !passwordMatches) {
      return { ok: false, code: "invalid_credentials" };
    }
    // Check this only after validating the password so the branded response
    // cannot be used to enumerate JewelLink-linked email addresses.
    if (isConfiguredAdminEmail(row.email) || !row.native_auth_enabled) {
      return { ok: false, code: "jewellink_required" };
    }

    const session = await findSessionForVerifiedNativeCredential({
      email: row.email,
      name: row.name,
      userId: row.id,
      nativeAuthEpoch: row.native_auth_epoch,
    });
    return session ? { ok: true, session } : { ok: false, code: "invalid_credentials" };
  } catch (error) {
    return { ok: false, code: error instanceof Error && error.message.includes("DATABASE_URL") ? "config" : "error" };
  }
}

// Low-level operator/test credential write. Production reset and claim flows
// own larger token transactions below; this standalone path still advances the
// native epoch in the same transaction so it can never leave older cookies
// valid after a credential write.
export async function setPassword(userId: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const locked = await client.query<{ id: string; native_auth_epoch: number }>(
      "select id, native_auth_epoch from users where id = $1 for update",
      [userId],
    );
    if (!locked.rows[0]) throw new Error("Password user does not exist.");
    await client.query(
      `insert into password_credentials (id, user_id, password_hash, created_at, updated_at)
       values ($1, $2, $3, now(), now())
       on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`,
      [`pwc-${userId}`, userId, hash],
    );
    const epoch = await client.query<{ native_auth_epoch: number }>(
      `update users
       set native_auth_epoch = native_auth_epoch + 1, updated_at = now()
       where id = $1
       returning native_auth_epoch`,
      [userId],
    );
    if (epoch.rows[0]?.native_auth_epoch !== locked.rows[0].native_auth_epoch + 1) {
      throw new Error("Password credential write could not advance the native session epoch.");
    }
    await client.query(
      `update auth_action_tokens
       set used_at = now()
       where user_id = $1
         and purpose in ('password_reset', 'account_claim')
         and used_at is null`,
      [userId],
    );
    const settlement = await client.query("commit");
    if (settlement.command !== "COMMIT") {
      throw new Error("Password credential transaction did not commit.");
    }
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// Look up an active user by email (for reset requests). Returns undefined
// silently for unknown emails so callers don't leak account existence.
export async function findActiveUserByEmail(
  email: string,
): Promise<{ id: string; email: string; name: string } | undefined> {
  const result = await getPostgresPool().query<{ id: string; email: string; name: string; native_auth_enabled: boolean }>(
    `select id, email, name, native_auth_enabled
     from users
     where email_normalized = $1 and status = 'active'
     limit 1`,
    [normalizeEmail(email)],
  );
  const row = result.rows[0];
  return row && row.native_auth_enabled && !isConfiguredAdminEmail(row.email) ? row : undefined;
}

export type PasswordResetCompletionResult =
  | { ok: true; userId: string; email: string; nativeAuthEpoch: number }
  | { ok: false; reason: "invalid_token" | "jewellink_required" };

// Complete the credential write and single-use token consumption atomically.
// The preflight is deliberately cheap so an invalid bearer cannot trigger
// scrypt. The password is then hashed before any transaction lock is acquired,
// while every mutable identity and token policy is repeated under locks before
// the password or token is changed.
export async function completePasswordReset(input: {
  token: string;
  password: string;
}): Promise<PasswordResetCompletionResult> {
  if (!isPlausibleActionToken("password_reset", input.token)) return { ok: false, reason: "invalid_token" };

  const tokenHash = hashActionToken(input.token);
  const preflightResult = await getPostgresPool().query<{
    id: string;
    user_id: string;
    token_email: string;
    current_email: string;
    current_email_normalized: string;
    status: string;
    native_auth_enabled: boolean;
  }>(
    `select
       token.id,
       token.user_id,
       token.email_normalized as token_email,
       users.email as current_email,
       users.email_normalized as current_email_normalized,
       users.status,
       users.native_auth_enabled
     from auth_action_tokens token
     join users on users.id = token.user_id
     where token.purpose = 'password_reset'
       and token.token_hash = $1
       and token.used_at is null
       and token.expires_at > now()
     limit 1`,
    [tokenHash],
  );
  const preflight = preflightResult.rows[0];
  if (!preflight) return { ok: false, reason: "invalid_token" };
  if (
    isConfiguredAdminEmail(preflight.token_email)
    || isConfiguredAdminEmail(preflight.current_email)
    || !preflight.native_auth_enabled
  ) {
    return { ok: false, reason: "jewellink_required" };
  }
  if (
    preflight.status !== "active"
    || preflight.current_email_normalized !== preflight.token_email
    || normalizeEmail(preflight.current_email) !== preflight.token_email
  ) {
    return { ok: false, reason: "invalid_token" };
  }

  // Never hold a user or token lock while running the intentionally expensive
  // password KDF. Policy is revalidated after this hash under both row locks.
  const passwordHash = await hashPassword(input.password);
  const client = await getPostgresPool().connect();
  let settled = false;
  try {
    await client.query("begin");

    // Token issuance locks the user before invalidating/inserting action-token
    // rows. Match that order here to avoid issuer/redemption deadlocks.
    const userResult = await client.query<{
      id: string;
      email: string;
      email_normalized: string;
      status: string;
      native_auth_enabled: boolean;
      native_auth_epoch: number;
    }>(
      `select id, email, email_normalized, status, native_auth_enabled, native_auth_epoch
       from users
       where id = $1
       for update`,
      [preflight.user_id],
    );
    const currentUser = userResult.rows[0];
    if (!currentUser) {
      await client.query("rollback");
      settled = true;
      return { ok: false, reason: "invalid_token" };
    }

    const tokenResult = await client.query<{
      id: string;
      user_id: string;
      token_email: string;
    }>(
      `select
         token.id,
         token.user_id,
         token.email_normalized as token_email
       from auth_action_tokens token
       where token.id = $1
         and token.user_id = $2
         and token.purpose = 'password_reset'
         and token.token_hash = $3
         and token.used_at is null
         and token.expires_at > now()
       for update of token`,
      [preflight.id, preflight.user_id, tokenHash],
    );
    const reset = tokenResult.rows[0];
    if (!reset) {
      await client.query("rollback");
      settled = true;
      return { ok: false, reason: "invalid_token" };
    }

    // These checks intentionally live after both locks. A user becoming a
    // platform admin, SSO-only, inactive, or changing email while hashing must
    // leave the one-time link unconsumed and the credential unchanged.
    if (
      isConfiguredAdminEmail(reset.token_email)
      || isConfiguredAdminEmail(currentUser.email)
      || !currentUser.native_auth_enabled
    ) {
      await client.query("rollback");
      settled = true;
      return { ok: false, reason: "jewellink_required" };
    }
    if (
      currentUser.status !== "active"
      || currentUser.email_normalized !== reset.token_email
      || normalizeEmail(currentUser.email) !== reset.token_email
    ) {
      await client.query("rollback");
      settled = true;
      return { ok: false, reason: "invalid_token" };
    }

    await client.query(
      `insert into password_credentials (id, user_id, password_hash, created_at, updated_at)
       values ($1, $2, $3, now(), now())
       on conflict (user_id) do update
       set password_hash = excluded.password_hash, updated_at = now()`,
      [`pwc-${currentUser.id}`, currentUser.id, passwordHash],
    );
    const epoch = await client.query<{ native_auth_epoch: number }>(
      `update users
       set native_auth_epoch = native_auth_epoch + 1, updated_at = now()
       where id = $1 and native_auth_epoch = $2
       returning native_auth_epoch`,
      [currentUser.id, currentUser.native_auth_epoch],
    );
    const committedNativeAuthEpoch = epoch.rows[0]?.native_auth_epoch;
    if (committedNativeAuthEpoch !== currentUser.native_auth_epoch + 1) {
      throw new Error("Password reset could not advance the native session epoch.");
    }
    const consumed = await client.query<{ id: string }>(
      `update auth_action_tokens
       set used_at = now()
       where purpose = 'password_reset'
         and user_id = $1
         and used_at is null
       returning id`,
      [currentUser.id],
    );
    if (!consumed.rows.some((row) => row.id === reset.id)) {
      throw new Error("Password-reset token lost its single-use lock.");
    }

    await client.query("commit");
    settled = true;
    return {
      ok: true,
      userId: currentUser.id,
      email: currentUser.email,
      nativeAuthEpoch: committedNativeAuthEpoch,
    };
  } catch (error) {
    if (!settled) {
      try {
        await client.query("rollback");
      } catch {
        // Preserve the credential/token transaction failure.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export type StandaloneAccountClaimResult =
  | { ok: true; userId: string; email: string; companyId: string; nativeAuthEpoch: number }
  | { ok: false; reason: "invalid_token" | "jewellink_required" | "standalone_entitlement_required" };

// Token consumption, entitlement verification, password replacement, and
// membership-ownership conversion are one transaction. A failed eligibility or
// identity check rolls everything back, leaving the single-use link available
// when retrying is safe.
export async function completeStandaloneAccountClaim(input: {
  token: string;
  password: string;
}): Promise<StandaloneAccountClaimResult> {
  // Only fragment-transport v2 bearers are redeemable. Reject malformed and
  // legacy query-string tokens before a database lookup or expensive scrypt.
  if (!isPlausibleActionToken("account_claim", input.token)) {
    return { ok: false, reason: "invalid_token" };
  }
  const tokenHash = hashActionToken(input.token);
  const preflightResult = await getPostgresPool().query<{
    id: string;
    user_id: string;
    token_email: string;
    current_email: string;
    current_email_normalized: string;
    status: string;
  }>(
    `select
       token.id,
       token.user_id,
       token.email_normalized as token_email,
       users.email as current_email,
       users.email_normalized as current_email_normalized,
       users.status
     from auth_action_tokens token
     join users on users.id = token.user_id
     where token.purpose = 'account_claim'
       and token.token_hash = $1
       and token.company_id is not null
       and token.used_at is null
       and token.expires_at > now()
     limit 1`,
    [tokenHash],
  );
  const preflight = preflightResult.rows[0];
  if (!preflight) return { ok: false, reason: "invalid_token" };
  if (isConfiguredAdminEmail(preflight.token_email) || isConfiguredAdminEmail(preflight.current_email)) {
    return { ok: false, reason: "jewellink_required" };
  }
  if (
    preflight.status !== "active"
    || preflight.current_email_normalized !== preflight.token_email
    || normalizeEmail(preflight.current_email) !== preflight.token_email
  ) {
    return { ok: false, reason: "invalid_token" };
  }

  // Run the KDF only for a plausible, live bearer, and never while holding a
  // database lock. All mutable token and identity policy is repeated below.
  const hash = await hashPassword(input.password);
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    // Match issuance's lock order (user first, then token) so a send and a
    // redemption for the same identity cannot deadlock. Re-read the token after
    // acquiring the user lock in case a newer issuance invalidated it while this
    // transaction was waiting.
    const userResult = await client.query<{
      id: string;
      email: string;
      email_normalized: string;
      status: string;
    }>(
      `select id, email, email_normalized, status
       from users
       where id = $1
       for update`,
      [preflight.user_id],
    );
    const currentUser = userResult.rows[0];
    if (!currentUser) {
      await client.query("rollback");
      return { ok: false, reason: "invalid_token" };
    }
    const tokenResult = await client.query<{
      id: string;
      user_id: string;
      token_email: string;
      company_id: string;
    }>(
      `select
         token.id,
         token.user_id,
         token.email_normalized as token_email,
         token.company_id
       from auth_action_tokens token
       where token.id = $1
         and token.user_id = $2
         and token.purpose = 'account_claim'
         and token.token_hash = $3
         and token.company_id is not null
         and token.used_at is null
         and token.expires_at > now()
       for update of token`,
      [preflight.id, preflight.user_id, tokenHash],
    );
    const claim = tokenResult.rows[0];
    if (!claim) {
      await client.query("rollback");
      return { ok: false, reason: "invalid_token" };
    }
    // The token was delivered to one exact address. An email change invalidates
    // the claim, and either the old or current address entering the platform-admin
    // allowlist must fail without consuming it.
    if (
      currentUser.status !== "active"
      || currentUser.email_normalized !== claim.token_email
      || normalizeEmail(currentUser.email) !== claim.token_email
      || isConfiguredAdminEmail(claim.token_email)
      || isConfiguredAdminEmail(currentUser.email)
    ) {
      await client.query("rollback");
      return {
        ok: false,
        reason: isConfiguredAdminEmail(claim.token_email) || isConfiguredAdminEmail(currentUser.email)
          ? "jewellink_required"
          : "invalid_token",
      };
    }

    const converted = await client.query<{ id: string; native_auth_epoch: number }>(
      `
        update users u
        set native_auth_enabled = true,
            native_auth_epoch = u.native_auth_epoch + 1,
            updated_at = now()
        where u.id = $1
          and u.status = 'active'
          and exists (
            select 1
            from store_users authorizing_membership
            join stores authorizing_store on authorizing_store.id = authorizing_membership.store_id
            where authorizing_membership.user_id = u.id
              and authorizing_membership.status = 'active'
              and authorizing_membership.role in ('store_owner', 'admin')
              and authorizing_store.company_id = $2
              and authorizing_store.status = 'active'
          )
          and exists (
            select 1
            from companies c
            where c.id = $2
              and c.status in ('active', 'trialing')
              and (
                exists (
                  select 1
                  from company_access_entitlements cae
                  where cae.company_id = c.id
                    and cae.source <> 'jewellink_included'
                    and cae.status = 'active'
                    and (cae.expires_at is null or cae.expires_at > now())
                )
                or exists (
                  select 1
                  from subscriptions sub
                  where sub.company_id = c.id
                    and sub.status in ('active', 'trialing')
                    and (sub.current_period_end is null or sub.current_period_end > now())
                )
              )
          )
        returning u.id, u.native_auth_epoch
      `,
      [claim.user_id, claim.company_id],
    );
    if (!converted.rows[0]) {
      await client.query("rollback");
      return { ok: false, reason: "standalone_entitlement_required" };
    }

    // Convert ownership only inside the company that authorized this claim.
    // Other companies remain independently managed and are still filtered by
    // their own entitlement whenever a native session is built.
    await client.query(
      `update store_user_location_scopes scope
       set source = 'manual', updated_at = now()
       from store_users membership
       join stores membership_store on membership_store.id = membership.store_id
       where scope.store_user_id = membership.id
         and scope.source = 'jewellink'
         and membership.user_id = $1
         and membership.source = 'jewellink'
         and membership.status = 'active'
         and membership_store.company_id = $2
         and membership_store.status = 'active'`,
      [claim.user_id, claim.company_id],
    );
    await client.query(
      `update store_users membership
       set source = 'manual', updated_at = now()
       from stores membership_store
       where membership_store.id = membership.store_id
         and membership.user_id = $1
         and membership.source = 'jewellink'
         and membership.status = 'active'
         and membership_store.company_id = $2
         and membership_store.status = 'active'`,
      [claim.user_id, claim.company_id],
    );

    await client.query(
      `insert into password_credentials (id, user_id, password_hash, created_at, updated_at)
       values ($1, $2, $3, now(), now())
       on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`,
      [`pwc-${claim.user_id}`, claim.user_id, hash],
    );
    await client.query(
      `insert into admin_audit_entries (
         id, actor_user_id, actor_label, action, target_type, target_id, target_label, metadata
       )
       values (
         $1, $2, $3, 'Claimed retained account access', 'user', $2, $3,
         jsonb_build_object(
           'authentication', 'native_password',
           'membershipOwnership', 'manual',
           'source', 'account_claim',
           'companyId', $4::text
         )
       )`,
      [`admin-audit-${randomBytes(12).toString("hex")}`, claim.user_id, currentUser.email, claim.company_id],
    );
    const consumed = await client.query<{ id: string }>(
      `update auth_action_tokens
       set used_at = now()
       where purpose = 'account_claim'
         and user_id = $1
         and company_id = $2
         and used_at is null
       returning id`,
      [claim.user_id, claim.company_id],
    );
    if (!consumed.rows.some((row) => row.id === claim.id)) {
      throw new Error("Account-claim token lost its single-use lock.");
    }
    await client.query(
      `update auth_action_tokens
       set used_at = now()
       where purpose = 'password_reset'
         and user_id = $1
         and used_at is null`,
      [claim.user_id],
    );
    await client.query("commit");
    return {
      ok: true,
      userId: claim.user_id,
      email: currentUser.email,
      companyId: claim.company_id,
      nativeAuthEpoch: converted.rows[0].native_auth_epoch,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const hash = await scrypt(password, salt, passwordKeyLength, passwordParams);
  return `scrypt$1$${passwordParams.N}$${passwordParams.r}$${passwordParams.p}$${salt}$${hash.toString("base64url")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, , n, r, p, salt, expectedHash] = stored.split("$");
  if (!isSupportedPasswordHash(stored) || !salt || !expectedHash) return false;
  const actual = await scrypt(password, salt, passwordKeyLength, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  const expected = Buffer.from(expectedHash, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function isSupportedPasswordHash(stored: string | undefined): stored is string {
  if (!stored || stored.length > 256) return false;
  const [algorithm, version, n, r, p, salt, expectedHash, extra] = stored.split("$");
  if (
    algorithm !== "scrypt"
    || version !== "1"
    || n !== String(passwordParams.N)
    || r !== String(passwordParams.r)
    || p !== String(passwordParams.p)
    || !/^[A-Za-z0-9_-]{16,64}$/.test(salt || "")
    || !/^[A-Za-z0-9_-]{86}$/.test(expectedHash || "")
    || extra !== undefined
  ) {
    return false;
  }
  return Buffer.from(expectedHash, "base64url").length === passwordKeyLength;
}

function scrypt(password: string, salt: string, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
