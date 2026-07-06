import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { getPostgresPool } from "@/lib/server/postgres";
import { findSessionForGoogleUser } from "@/lib/server/auth";
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
  | { ok: false; code: "invalid_credentials" | "config" | "error" };

export async function loginWithPassword(input: { email: string; password: string }): Promise<PasswordLoginResult> {
  if (!input.email || !input.password) return { ok: false, code: "invalid_credentials" };

  try {
    const email = normalizeEmail(input.email);
    const result = await getPostgresPool().query<{
      email: string;
      name: string;
      password_hash: string;
    }>(
      `
        select u.email, u.name, pc.password_hash
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
  const result = await getPostgresPool().query<{ id: string; email: string; name: string }>(
    `select id, email, name from users where email_normalized = $1 and status = 'active' limit 1`,
    [normalizeEmail(email)],
  );
  return result.rows[0];
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
