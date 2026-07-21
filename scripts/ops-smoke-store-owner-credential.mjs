#!/usr/bin/env node
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import pg from "pg";

const { Pool } = pg;

const DEFAULT_PROJECT = "jewelhire-prod-20260626";
const DEFAULT_DATABASE_SECRET = "jewelhire-database-url";
const DEFAULT_SMOKE_SECRET = "jewelhire-smoke-test-credentials";
const DEFAULT_COMPANY_ID = "co-jewelhire-pilot-smoke";
const DEFAULT_STORE_ID = "store-jewelhire-pilot-smoke-primary";
const DEFAULT_USER_ID = "user-jewelhire-pilot-smoke-store-owner";
const DEFAULT_STORE_USER_ID = "store-user-jewelhire-pilot-smoke-owner";
const DEFAULT_STORE_SLUG = "jewelhire-pilot-smoke-careers";
const DEFAULT_TTL_DAYS = 21;

function usage() {
  return [
    "Usage:",
    "  npm run ops:smoke-store-owner -- [options]",
    "",
    "Creates or refreshes a dedicated JewelHire store-owner smoke account, rotates",
    "its password, grants a short comped entitlement, and updates the smoke",
    "credential Secret Manager version. Output is masked and never includes raw",
    "emails, passwords, database URLs, cookies, or secret values.",
    "",
    "Options:",
    "  --project=<id>              GCP project. Defaults to jewelhire-prod-20260626.",
    "  --database-secret=<name>    Secret containing DATABASE_URL.",
    "  --smoke-secret=<name>       Smoke credential JSON secret.",
    "  --credentials-file=<path>   Read smoke credentials from a local JSON file for dry-run tests.",
    "  --email=<email>             Target smoke email. Defaults to a plus alias derived from the current store_owner secret.",
    "  --ttl-days=<days>           Entitlement lifetime. Defaults to 21.",
    "  --dry-run                   Show the masked plan without writing database or Secret Manager.",
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (arg === "--help") parsed.help = true;
    else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg.startsWith("--")) {
      const [key, ...valueParts] = arg.slice(2).split("=");
      if (!key || valueParts.length === 0) throw new Error(`Option ${arg} must use --name=value form.`);
      parsed[key] = valueParts.join("=");
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function gcloud(commandArgs, input) {
  const gcloudBin = process.env.GCLOUD_BIN || "gcloud";
  return execFileSync(gcloudBin, commandArgs, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function parseJson(text, label) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("top-level value must be an object");
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is not valid JSON: ${message}`);
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function maskEmail(email) {
  const value = normalizeEmail(email);
  const [local, domain] = value.split("@");
  if (!local || !domain) return "";
  return `${local.slice(0, 1)}***@${domain}`;
}

function validEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function credentialFor(credentials, role) {
  return credentials.find((credential) => credential?.role === role) || null;
}

function deriveSmokeEmail(email) {
  const value = normalizeEmail(email);
  const [local, domain] = value.split("@");
  if (!local || !domain) return "";
  const base = local.split("+")[0].replace(/[^a-z0-9._-]/g, "") || "store-owner";
  return `${base}+jewelhire-pilot-smoke@${domain}`;
}

function loadSmokeSecret(input) {
  if (input.credentialsFile) {
    return parseJson(fsRead(input.credentialsFile), "smoke credentials file");
  }
  const raw = gcloud([
    "secrets",
    "versions",
    "access",
    "latest",
    `--secret=${input.smokeSecret}`,
    `--project=${input.project}`,
  ]);
  return parseJson(raw, "smoke credential secret");
}

function fsRead(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function sslConfig(rawUrl) {
  const url = new URL(rawUrl);
  const sslmode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");
  return {
    connectionString: url.toString(),
    ssl: sslmode === "disable" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
      ? false
      : { rejectUnauthorized: true },
  };
}

function generatedPassword() {
  return `Jh-${randomBytes(24).toString("base64url")}-9`;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await scrypt(password, salt, 64, { N: 16_384, r: 8, p: 1 });
  return `scrypt$1$16384$8$1$${salt}$${hash.toString("base64url")}`;
}

function scrypt(password, salt, keyLength, options) {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function updatedSmokeSecret(secret, input) {
  const credentials = Array.isArray(secret.credentials) ? [...secret.credentials] : [];
  const withoutStoreOwner = credentials.filter((credential) => credential?.role !== "store_owner");
  const admin = credentialFor(withoutStoreOwner, "admin");
  const normalized = admin
    ? withoutStoreOwner
    : [
        ...withoutStoreOwner,
        {
          role: "admin",
          authMethod: "jewellink_sso",
          expectedAccess: "Platform admin smoke uses the allowlisted JewelLink admin SSO persona; no native admin password is stored here.",
        },
      ];
  return {
    ...secret,
    credentials: [
      ...normalized,
      {
        role: "store_owner",
        email: input.email,
        password: input.password,
        companyId: input.companyId,
        storeId: input.storeId,
        authMethod: "native",
        expectedAccess: "Dedicated JewelHire pilot smoke store-owner account.",
        rotatedAt: input.rotatedAt,
      },
    ],
  };
}

async function refreshSmokeStoreOwner(input) {
  const passwordHash = await hashPassword(input.password);
  const { connectionString, ssl } = sslConfig(input.databaseUrl);
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    max: 1,
    ssl,
  });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const existingEmail = await client.query(
      "select id from users where email_normalized = $1 and id <> $2 limit 1",
      [input.email, input.userId],
    );
    if (existingEmail.rows[0]) {
      throw new Error("Target smoke email already belongs to a different JewelHire user.");
    }

    const slugConflict = await client.query(
      "select id from stores where slug = $1 and id <> $2 limit 1",
      [input.storeSlug, input.storeId],
    );
    if (slugConflict.rows[0]) {
      throw new Error("Target smoke store slug already belongs to a different JewelHire store.");
    }

    const existingCompany = await client.query(
      "select id, name from companies where id = $1 for update",
      [input.companyId],
    );
    if (existingCompany.rows[0] && !/smoke/i.test(existingCompany.rows[0].name || "")) {
      throw new Error("Target company id exists but is not labeled as a smoke company.");
    }

    const extraNativeUsers = await client.query(
      `
        select u.id
        from users u
        join password_credentials pc on pc.user_id = u.id
        join store_users su on su.user_id = u.id and su.status = 'active'
        join stores s on s.id = su.store_id and s.status = 'active'
        where s.company_id = $1
          and u.status = 'active'
          and u.native_auth_enabled
          and u.id <> $2
        limit 1
      `,
      [input.companyId, input.userId],
    );
    if (extraNativeUsers.rows[0]) {
      throw new Error("Dedicated smoke company has an unexpected active native password user.");
    }

    await client.query(
      `
        insert into companies (id, name, owner_name, plan_tier, status, created_at, updated_at)
        values ($1, 'JewelHire Pilot Smoke', 'JewelHire QA', 'growth', 'active', now(), now())
        on conflict (id) do update set
          name = excluded.name,
          owner_name = excluded.owner_name,
          plan_tier = 'growth',
          status = 'active',
          updated_at = now()
      `,
      [input.companyId],
    );
    await client.query(
      `
        insert into stores (id, company_id, name, slug, location_label, timezone, status, created_at, updated_at)
        values ($1, $2, 'JewelHire Pilot Smoke - Primary', $3, 'Pilot Smoke', 'America/Chicago', 'active', now(), now())
        on conflict (id) do update set
          company_id = excluded.company_id,
          name = excluded.name,
          slug = excluded.slug,
          location_label = excluded.location_label,
          timezone = excluded.timezone,
          status = 'active',
          updated_at = now()
      `,
      [input.storeId, input.companyId, input.storeSlug],
    );
    await client.query(
      `
        insert into users (
          id, company_id, email, email_normalized, name, status,
          native_auth_enabled, created_at, updated_at
        )
        values ($1, $2, $3, $4, 'JewelHire Pilot Smoke Store Owner', 'active', true, now(), now())
        on conflict (id) do update set
          company_id = excluded.company_id,
          email = excluded.email,
          email_normalized = excluded.email_normalized,
          name = excluded.name,
          status = 'active',
          native_auth_enabled = true,
          updated_at = now()
      `,
      [input.userId, input.companyId, input.email, input.email],
    );
    await client.query(
      `
        insert into store_users (id, store_id, user_id, role, status, created_at, updated_at)
        values ($1, $2, $3, 'store_owner', 'active', now(), now())
        on conflict (store_id, user_id) do update set
          role = 'store_owner',
          status = 'active',
          updated_at = now()
      `,
      [input.storeUserId, input.storeId, input.userId],
    );
    await client.query(
      `
        insert into company_access_entitlements (
          company_id, source, plan_code, status, amount_cents,
          starts_at, expires_at, created_at, updated_at
        )
        values ($1, 'comped', 'pilot_smoke', 'active', 0, now(), $2::timestamptz, now(), now())
        on conflict (company_id) do update set
          source = 'comped',
          plan_code = 'pilot_smoke',
          status = 'active',
          amount_cents = 0,
          provider_customer_id = null,
          provider_subscription_id = null,
          starts_at = now(),
          expires_at = excluded.expires_at,
          updated_at = now()
      `,
      [input.companyId, input.expiresAt],
    );
    await client.query(
      `
        insert into password_credentials (id, user_id, password_hash, created_at, updated_at)
        values ($1, $2, $3, now(), now())
        on conflict (user_id) do update set
          password_hash = excluded.password_hash,
          updated_at = now()
      `,
      [`pwc-${input.userId}`, input.userId, passwordHash],
    );
    const epoch = await client.query(
      `
        update users
        set native_auth_epoch = native_auth_epoch + 1,
            updated_at = now()
        where id = $1
        returning native_auth_epoch
      `,
      [input.userId],
    );
    if (!epoch.rows[0]) throw new Error("Smoke user native auth epoch was not advanced.");
    await client.query(
      `
        update auth_action_tokens
        set used_at = now()
        where user_id = $1
          and purpose in ('password_reset', 'account_claim')
          and used_at is null
      `,
      [input.userId],
    );
    await client.query(
      `
        insert into admin_audit_entries (
          id, actor_label, action, target_type, target_id, target_label, metadata, created_at
        )
        values ($1, 'platform', 'Refreshed pilot smoke store-owner credential', 'company', $2, 'JewelHire Pilot Smoke', $3::jsonb, now())
      `,
      [
        `admin-audit-${randomBytes(12).toString("hex")}`,
        input.companyId,
        JSON.stringify({
          companyId: input.companyId,
          storeId: input.storeId,
          userId: input.userId,
          entitlementSource: "comped",
          expiresAt: input.expiresAt,
          valuesPrinted: false,
        }),
      ],
    );
    await client.query("commit");
    return { nativeAuthEpoch: epoch.rows[0].native_auth_epoch };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const project = args.project || process.env.JEWELHIRE_GCP_PROJECT || DEFAULT_PROJECT;
  const databaseSecret = args["database-secret"] || process.env.JEWELHIRE_DATABASE_SECRET || DEFAULT_DATABASE_SECRET;
  const smokeSecret = args["smoke-secret"] || process.env.JEWELHIRE_SMOKE_CREDENTIAL_SECRET || DEFAULT_SMOKE_SECRET;
  const credentialsFile = args["credentials-file"] || "";
  const companyId = args["company-id"] || DEFAULT_COMPANY_ID;
  const storeId = args["store-id"] || DEFAULT_STORE_ID;
  const storeSlug = args["store-slug"] || DEFAULT_STORE_SLUG;
  const userId = args["user-id"] || DEFAULT_USER_ID;
  const storeUserId = args["store-user-id"] || DEFAULT_STORE_USER_ID;
  const ttlDays = Number(args["ttl-days"] || process.env.JEWELHIRE_SMOKE_ENTITLEMENT_TTL_DAYS || DEFAULT_TTL_DAYS);
  if (!Number.isSafeInteger(ttlDays) || ttlDays < 1 || ttlDays > 90) {
    throw new Error("--ttl-days must be an integer from 1 to 90.");
  }

  const smoke = loadSmokeSecret({ project, smokeSecret, credentialsFile });
  const credentials = Array.isArray(smoke.credentials) ? smoke.credentials : [];
  const currentStoreOwner = credentialFor(credentials, "store_owner");
  const email = normalizeEmail(
    args.email ||
      process.env.JEWELHIRE_SMOKE_STORE_OWNER_EMAIL ||
      deriveSmokeEmail(currentStoreOwner?.email),
  );
  if (!validEmail(email)) {
    throw new Error("A valid smoke store-owner email is required via --email or an existing store_owner smoke credential.");
  }
  const password = generatedPassword();
  const rotatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  if (args.dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      wouldWriteDatabase: false,
      wouldAddSecretVersion: false,
      companyId,
      storeId,
      userId,
      emailAlias: maskEmail(email),
      entitlement: { source: "comped", status: "active", expiresAt },
      valuesPrinted: false,
    }, null, 2));
    return;
  }

  const databaseUrl = process.env.DATABASE_URL || gcloud([
    "secrets",
    "versions",
    "access",
    "latest",
    `--secret=${databaseSecret}`,
    `--project=${project}`,
  ]);
  const result = await refreshSmokeStoreOwner({
    databaseUrl,
    companyId,
    storeId,
    storeSlug,
    userId,
    storeUserId,
    email,
    password,
    expiresAt,
  });
  const nextSecret = updatedSmokeSecret(smoke, {
    email,
    password,
    companyId,
    storeId,
    rotatedAt,
  });
  const secretVersion = gcloud([
    "secrets",
    "versions",
    "add",
    smokeSecret,
    `--project=${project}`,
    "--data-file=-",
    "--format=value(name)",
  ], `${JSON.stringify(nextSecret, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    dryRun: false,
    companyId,
    storeId,
    userId,
    emailAlias: maskEmail(email),
    passwordRotated: true,
    nativeAuthEpoch: result.nativeAuthEpoch,
    entitlement: { source: "comped", status: "active", expiresAt },
    secretVersionAdded: Boolean(secretVersion),
    secretVersion,
    valuesPrinted: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
