#!/usr/bin/env node
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const passwordKeyLength = 64;
const passwordParams = { N: 16_384, r: 8, p: 1 };

function sslConfig(rawUrl) {
  const url = new URL(rawUrl);
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode === "disable" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return false;
  return { rejectUnauthorized: true };
}

function parseArgs(argv) {
  const parsed = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--email":
        parsed.email = argv[++index];
        break;
      case "--password-env":
        parsed.passwordEnv = argv[++index];
        break;
      case "--dry-run":
        parsed.dryRun = true;
        break;
      case "--help":
        parsed.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return parsed;
}

function usage() {
  return [
    "Usage:",
    "  DATABASE_URL=<postgres> JEWELHIRE_OPERATOR_PASSWORD=<password> npm run ops:password-credential -- --email owner@example.com",
    "",
    "Options:",
    "  --email <email>            Existing active JewelHire user email.",
    "  --password-env <env var>   Env var containing the new password. Defaults to JEWELHIRE_OPERATOR_PASSWORD.",
    "  --dry-run                  Validate target user without writing.",
    "",
    "A successful write atomically advances the user's native session epoch, revokes older native cookies, and invalidates outstanding reset/claim links.",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const email = normalizeEmail(required(args.email, "--email"));
  const passwordEnv = args.passwordEnv || "JEWELHIRE_OPERATOR_PASSWORD";
  const password = process.env[passwordEnv] || "";
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  if (!databaseUrl) throw new Error("DATABASE_URL or POSTGRES_URL is required.");
  if (!isStrongPassword(password)) {
    throw new Error(`${passwordEnv} must be at least 12 characters and include letters and numbers.`);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    max: 1,
    ssl: sslConfig(databaseUrl),
  });

  try {
    const userResult = await pool.query(
      "select id, email, name, status from users where email_normalized = $1 limit 1",
      [email],
    );
    const user = userResult.rows[0];
    if (!user || user.status !== "active") {
      throw new Error("No active JewelHire user exists for that email.");
    }

    const existing = await pool.query("select id from password_credentials where user_id = $1", [user.id]);
    const action = existing.rows.length ? "rotate" : "create";
    if (args.dryRun) {
      console.log(JSON.stringify({ ok: true, dryRun: true, action, email: user.email, userId: user.id }, null, 2));
      return;
    }

    const passwordHash = await hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query("begin");
      const lockedUser = await client.query(
        `select id, email, native_auth_epoch
         from users
         where id = $1 and email_normalized = $2 and status = 'active'
         for update`,
        [user.id, email],
      );
      if (!lockedUser.rows[0]) {
        throw new Error("The target identity changed before the credential write; no password was changed.");
      }
      const lockedCredential = await client.query(
        "select id from password_credentials where user_id = $1 for update",
        [user.id],
      );
      const lockedAction = lockedCredential.rows.length ? "rotate" : "create";
      const id = lockedCredential.rows[0]?.id || `pwcred_${randomBytes(12).toString("hex")}`;
      await client.query(
        `insert into password_credentials (id, user_id, password_hash)
         values ($1, $2, $3)
         on conflict (user_id)
         do update set password_hash = excluded.password_hash, updated_at = now()`,
        [id, user.id, passwordHash],
      );
      const epoch = await client.query(
        `update users
         set native_auth_epoch = native_auth_epoch + 1, updated_at = now()
         where id = $1
         returning native_auth_epoch`,
        [user.id],
      );
      if (epoch.rows[0]?.native_auth_epoch !== lockedUser.rows[0].native_auth_epoch + 1) {
        throw new Error("Password credential write could not advance the native session epoch.");
      }
      await client.query(
        `update auth_action_tokens
         set used_at = now()
         where user_id = $1
           and purpose in ('password_reset', 'account_claim')
           and used_at is null`,
        [user.id],
      );
      const settlement = await client.query("commit");
      if (settlement.command !== "COMMIT") {
        throw new Error("Password credential transaction did not commit.");
      }
      console.log(JSON.stringify({
        ok: true,
        action: lockedAction,
        email: lockedUser.rows[0].email,
        userId: user.id,
      }, null, 2));
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await scrypt(password, salt, passwordKeyLength, passwordParams);
  return `scrypt$1$${passwordParams.N}$${passwordParams.r}$${passwordParams.p}$${salt}$${hash.toString("base64url")}`;
}

function scrypt(password, salt, keyLength, options) {
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

function isStrongPassword(password) {
  return password.length >= 12 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function required(value, label) {
  if (!value) throw new Error(`${label} is required.\n\n${usage()}`);
  return value;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
