import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { hashActionToken } from "@/lib/server/action-tokens";
import { getPostgresPool } from "@/lib/server/postgres";
import { findSessionForGoogleUser, isConfiguredAdminEmail } from "@/lib/server/auth";
import type { AuthSession } from "@/lib/server/auth";

// Re-exported from the shared client/server policy so validation can't drift.
export { isStrongPassword } from "@/lib/password-policy";

const passwordKeyLength = 64;
const passwordParams = {
  N: 16_384,
  r: 8,
  p: 1,
};

export type PasswordLoginResult =
  | { ok: true; session: AuthSession }
  | { ok: false; code: "invalid_credentials" | "jewellink_required" | "config" | "error" };

export async function loginWithPassword(input: { email: string; password: string }): Promise<PasswordLoginResult> {
  if (!input.email || !input.password) return { ok: false, code: "invalid_credentials" };

  try {
    const email = normalizeEmail(input.email);
    const result = await getPostgresPool().query<{
      email: string;
      name: string;
      password_hash: string;
      native_auth_enabled: boolean;
    }>(
      `
        select u.email, u.name, u.native_auth_enabled, pc.password_hash
        from users u
        join password_credentials pc on pc.user_id = u.id
        where u.email_normalized = $1
          and u.status = 'active'
        limit 1
      `,
      [email],
    );
    const row = result.rows[0];
    if (!row || !(await verifyPassword(input.password, row.password_hash))) {
      return { ok: false, code: "invalid_credentials" };
    }
    // Check this only after validating the password so the branded response
    // cannot be used to enumerate JewelLink-linked email addresses.
    if (isConfiguredAdminEmail(row.email) || !row.native_auth_enabled) {
      return { ok: false, code: "jewellink_required" };
    }

    const session = await findSessionForGoogleUser({ email: row.email, name: row.name });
    return session ? { ok: true, session } : { ok: false, code: "invalid_credentials" };
  } catch (error) {
    return { ok: false, code: error instanceof Error && error.message.includes("DATABASE_URL") ? "config" : "error" };
  }
}

// Create or replace a user's password (used by reset + signup/claim flows).
export async function setPassword(userId: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  await getPostgresPool().query(
    `insert into password_credentials (id, user_id, password_hash, created_at, updated_at)
     values ($1, $2, $3, now(), now())
     on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`,
    [`pwc-${userId}`, userId, hash],
  );
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

export async function nativeAuthEnabledForUser(userId: string) {
  const result = await getPostgresPool().query<{ email: string; native_auth_enabled: boolean }>(
    `select email, native_auth_enabled from users where id = $1 and status = 'active' limit 1`,
    [userId],
  );
  const row = result.rows[0];
  return row?.native_auth_enabled === true && !isConfiguredAdminEmail(row.email);
}

export type StandaloneAccountClaimResult =
  | { ok: true; userId: string; email: string; companyId: string }
  | { ok: false; reason: "invalid_token" | "jewellink_required" | "standalone_entitlement_required" };

// Token consumption, entitlement verification, password replacement, and
// membership-ownership conversion are one transaction. A failed eligibility or
// identity check rolls everything back, leaving the single-use link available
// when retrying is safe.
export async function completeStandaloneAccountClaim(input: {
  token: string;
  password: string;
}): Promise<StandaloneAccountClaimResult> {
  const hash = await hashPassword(input.password);
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    const candidateResult = await client.query<{
      id: string;
      user_id: string;
    }>(
      `select token.id, token.user_id
       from auth_action_tokens token
       where token.purpose = 'account_claim'
         and token.token_hash = $1
         and token.company_id is not null
         and token.used_at is null
         and token.expires_at > now()
       limit 1`,
      [hashActionToken(input.token)],
    );
    const candidate = candidateResult.rows[0];
    if (!candidate) {
      await client.query("rollback");
      return { ok: false, reason: "invalid_token" };
    }

    // Match issuance's lock order (user first, then token) so a send and a
    // redemption for the same identity cannot deadlock. Re-read the token after
    // acquiring the user lock in case a newer issuance invalidated it while this
    // transaction was waiting.
    const userResult = await client.query<{
      id: string;
      email: string;
      email_normalized: string;
    }>(
      `select id, email, email_normalized
       from users
       where id = $1
       for update`,
      [candidate.user_id],
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
      [candidate.id, candidate.user_id, hashActionToken(input.token)],
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
      currentUser.email_normalized !== claim.token_email
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

    const converted = await client.query<{ id: string }>(
      `
        update users u
        set native_auth_enabled = true, updated_at = now()
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
        returning u.id
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
    return { ok: true, userId: claim.user_id, email: currentUser.email, companyId: claim.company_id };
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
  const [algorithm, version, n, r, p, salt, expectedHash] = stored.split("$");
  if (algorithm !== "scrypt" || version !== "1" || !salt || !expectedHash) return false;
  const actual = await scrypt(password, salt, passwordKeyLength, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  const expected = Buffer.from(expectedHash, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
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
