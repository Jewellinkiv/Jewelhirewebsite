#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const adminUrlRaw = process.env.JEWELHIRE_TEST_POSTGRES_ADMIN_URL || "postgresql:///postgres?sslmode=disable";
const adminUrl = new URL(adminUrlRaw);
const localHosts = new Set(["", "localhost", "127.0.0.1", "::1"]);
if (!localHosts.has(adminUrl.hostname)) {
  throw new Error("Refusing to create a password-reset test database on a non-local PostgreSQL host.");
}

const databaseName = `jewelhire_password_reset_${process.pid}_${randomBytes(5).toString("hex")}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.set("sslmode", "disable");

const admin = new Client({ connectionString: adminUrl.toString(), ssl: false });
let databaseCreated = false;
let pool;
let teardownStarted = false;
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const deliveries = [];
let postmarkOutcome = "accepted";
let postmarkDelayMs = 0;

function isExpectedTeardownPoolError(error) {
  return error?.code === "57P01" || /terminating connection due to administrator command/i.test(error?.message || "");
}

function attachPoolErrorHandler(currentPool) {
  currentPool.on("error", (error) => {
    if (teardownStarted && isExpectedTeardownPoolError(error)) return;
    throw error;
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function availablePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const address = socket.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error("Could not reserve a Next route-test port.");
  return port;
}

function createNextFixture() {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "jewelhire-reset-after-"));
  fs.cpSync(rootDir, fixtureDir, {
    recursive: true,
    filter(source) {
      const relative = path.relative(rootDir, source);
      if (!relative) return true;
      const firstSegment = relative.split(path.sep)[0];
      return firstSegment !== ".git"
        && firstSegment !== "node_modules"
        && !firstSegment.startsWith(".next")
        && !firstSegment.startsWith(".env");
    },
  });
  fs.symlinkSync(path.join(rootDir, "node_modules"), path.join(fixtureDir, "node_modules"), "dir");
  return fixtureDir;
}

async function waitForNextServer(url, child, output) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Next route-test server exited early (${child.exitCode}).\n${output.join("")}`);
    }
    try {
      const response = await originalFetch(url);
      if (response.ok) return;
    } catch {
      // Next is still compiling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}.\n${output.join("")}`);
}

async function smokeNextAfterRoute({ pool, testUrl }) {
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const fixtureDir = createNextFixture();
  const output = [];
  const child = spawn(
    process.execPath,
    [
      path.join(rootDir, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: fixtureDir,
      env: {
        ...process.env,
        AUTH_SECRET: "password-reset-after-test-secret-at-least-32-bytes",
        DATABASE_URL: testUrl.toString(),
        EMAIL_NOTIFICATIONS_ENABLED: "false",
        JEWELHIRE_STORAGE: "postgres",
        JEWELHIRE_TRUSTED_PROXY_HOPS: "0",
        NEXT_DIST_DIR: ".next",
        NEXT_PUBLIC_APP_URL: baseUrl,
        NEXT_TELEMETRY_DISABLED: "1",
        POSTGRES_POOL_MAX: "1",
        POSTMARK_DRY_RUN: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));

  let backgroundBlocker;
  try {
    await waitForNextServer(`${baseUrl}/forgot-password`, child, output);
    const compileResponse = await originalFetch(`${baseUrl}/api/auth/password/reset-request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "127.0.19.0",
      },
      body: JSON.stringify({ email: "invalid" }),
    });
    assert.equal(compileResponse.status, 200, output.join(""));
    await compileResponse.arrayBuffer();

    // Hold the reset subject's row lock. The public response must complete
    // while the after-response candidate transaction is blocked, then the task
    // must settle once the lock is released.
    backgroundBlocker = new Client({ connectionString: testUrl.toString(), ssl: false });
    await backgroundBlocker.connect();
    await backgroundBlocker.query("begin");
    await backgroundBlocker.query("select id from users where id = 'after-route-user' for update");
    const responseStartedAt = Date.now();
    let responseTimeout;
    const response = await Promise.race([
      originalFetch(`${baseUrl}/api/auth/password/reset-request`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "127.0.19.1",
        },
        body: JSON.stringify({ email: "after-route@example.test" }),
      }),
      new Promise((_, reject) => {
        responseTimeout = setTimeout(
          () => reject(new Error("real Next response waited for locked after-response work")),
          3_000,
        );
      }),
    ]).finally(() => clearTimeout(responseTimeout));
    const responseElapsedMs = Date.now() - responseStartedAt;
    assert.equal(response.status, 200, output.join(""));
    assert.deepEqual(await response.json(), { ok: true });
    assert.ok(responseElapsedMs < 3_000, `background work delayed the real Next response (${responseElapsedMs}ms)`);

    const blockedCandidateCount = (
      await pool.query(
        `select count(*)::int as count
         from auth_action_tokens
         where user_id = 'after-route-user' and purpose = 'password_reset'`,
      )
    ).rows[0]?.count;
    assert.equal(blockedCandidateCount, 0, output.join(""));

    await backgroundBlocker.query("commit");
    await backgroundBlocker.end();
    backgroundBlocker = undefined;

    let deliveryRow;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      deliveryRow = (
        await pool.query(
          `select delivery_state, used_at
           from auth_action_tokens
           where user_id = 'after-route-user' and purpose = 'password_reset'
           order by created_at desc, id desc
           limit 1`,
        )
      ).rows[0];
      if (deliveryRow?.delivery_state === "rejected" && deliveryRow.used_at) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(deliveryRow?.delivery_state, "rejected", output.join(""));
    assert.ok(deliveryRow?.used_at, output.join(""));
    assert.equal(output.join("").includes("after` was called outside a request scope"), false);
  } finally {
    if (backgroundBlocker) {
      await backgroundBlocker.query("rollback").catch(() => undefined);
      await backgroundBlocker.end().catch(() => undefined);
    }
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 5_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
}

async function migrateDatabase() {
  const client = new Client({ connectionString: testUrl.toString(), ssl: false });
  await client.connect();
  try {
    await client.query(
      `create table schema_migrations (
         id text primary key,
         filename text not null,
         checksum text not null,
         applied_at timestamptz not null default now()
       )`,
    );
    const files = fs.readdirSync(path.join(rootDir, "db", "migrations"))
      .filter((filename) => /^\d{4}_.+\.sql$/.test(filename))
      .sort();
    for (const filename of files) {
      const sql = fs.readFileSync(path.join(rootDir, "db", "migrations", filename), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into schema_migrations (id, filename, checksum) values ($1, $2, $3)",
          [filename.replace(/\.sql$/, ""), filename, createHash("sha256").update(sql).digest("hex")],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

async function seedUser(id, email) {
  await pool.query(
    `insert into users (
       id, company_id, email, email_normalized, name, status,
       jewellink_user_id, native_auth_enabled
     )
     values ($1, null, $2, $3, $1, 'active', null, true)`,
    [id, email, email.toLowerCase()],
  );
}

async function main() {
  await admin.connect();
  await admin.query(`create database "${databaseName}"`);
  databaseCreated = true;
  await migrateDatabase();

  process.env.DATABASE_URL = testUrl.toString();
  process.env.POSTGRES_POOL_MAX = "1";
  process.env.JEWELHIRE_REQUIRE_AUTH = "1";
  process.env.AUTH_SECRET = "password-reset-test-auth-secret-at-least-32-bytes";
  process.env.JEWELHIRE_ADMIN_EMAILS = "platform-admin@example.test";
  process.env.JEWELHIRE_TRUSTED_PROXY_HOPS = "0";
  process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
  process.env.POSTMARK_DRY_RUN = "false";
  process.env.POSTMARK_SERVER_TOKEN = "test-postmark-token";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.jewelhire.test";

  globalThis.fetch = async (_url, init) => {
    deliveries.push(JSON.parse(String(init?.body || "{}")));
    if (postmarkDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, postmarkDelayMs));
    }
    if (postmarkOutcome === "definite_failure") return new Response("{}", { status: 422 });
    if (postmarkOutcome === "ambiguous") return new Response("{}", { status: 503 });
    if (postmarkOutcome === "network_error") throw new Error("simulated Postmark network failure");
    return new Response("{}", { status: 200 });
  };

  const postgres = await import("../lib/server/postgres.ts");
  const actionTokens = await import("../lib/server/action-tokens.ts");
  const passwordAuth = await import("../lib/server/password-auth.ts");
  const auth = await import("../lib/server/auth.ts");
  const postgresReadiness = await import("../lib/server/postgres-readiness.ts");
  const passwordResetRequest = await import("../lib/server/password-reset-request.ts");
  const resetRoute = await import("../app/api/auth/password/reset/route.ts");
  const passwordSessionRoute = await import("../app/api/auth/password/session/route.ts");
  pool = postgres.getPostgresPool();
  attachPoolErrorHandler(pool);

  const scheduledTasks = [];
  const requestReset = async (email, ip, bodyOverride) => {
    const scheduledBefore = scheduledTasks.length;
    const startedAt = Date.now();
    const response = await passwordResetRequest.handlePasswordResetRequest(new Request(
      "https://app.jewelhire.test/api/auth/password/reset-request",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: bodyOverride ?? JSON.stringify({ email }),
      },
    ), (task) => scheduledTasks.push(task));
    return {
      response,
      body: await response.json(),
      elapsedMs: Date.now() - startedAt,
      scheduledTaskCount: scheduledTasks.length - scheduledBefore,
    };
  };

  const runNextScheduledTask = async () => {
    const task = scheduledTasks.shift();
    assert.ok(task, "expected an after-response task");
    await task();
  };

  const resetTokenFromDelivery = (delivery) => {
    const text = String(delivery?.TextBody || "");
    const match = text.match(/https:\/\/app\.jewelhire\.test\/reset-password#token=([^\s]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  };

  await seedUser("transport-user", "transport@example.test");
  const transport = await requestReset("transport@example.test", "127.0.10.1");
  assert.equal(transport.response.status, 200);
  assert.deepEqual(transport.body, { ok: true });
  assert.equal(transport.response.headers.get("cache-control"), "no-store");
  assert.equal(transport.scheduledTaskCount, 1);
  assert.equal(deliveries.length, 0);
  await runNextScheduledTask();
  assert.equal(deliveries.length, 1);
  const transportBody = String(deliveries[0]?.TextBody || "");
  const transportMatch = transportBody.match(/https:\/\/app\.jewelhire\.test\/reset-password#token=([^\s]+)/);
  assert.ok(transportMatch?.[1]);
  assert.match(decodeURIComponent(transportMatch[1]), /^pr2_[A-Za-z0-9_-]{43}$/);
  assert.equal(transportBody.includes("/reset-password?token="), false);
  assert.equal(transportBody.includes("/reset-password#token="), true);
  console.log("PASS reset email carries its bearer only in a URL fragment");

  await seedUser("definite-rejection-user", "definite-rejection@example.test");
  const priorDefiniteToken = await actionTokens.createActionToken({
    purpose: "password_reset",
    userId: "definite-rejection-user",
    email: "definite-rejection@example.test",
    ttlMinutes: 60,
  });
  postmarkOutcome = "definite_failure";
  const definiteDeliveryIndex = deliveries.length;
  const definiteResponse = await requestReset("DEFINITE-REJECTION@EXAMPLE.TEST", "127.0.11.1");
  assert.equal(definiteResponse.response.status, 200);
  assert.deepEqual(definiteResponse.body, { ok: true });
  assert.equal(definiteResponse.scheduledTaskCount, 1);
  assert.equal(deliveries.length, definiteDeliveryIndex);
  await runNextScheduledTask();
  const rejectedReplacementToken = resetTokenFromDelivery(deliveries[definiteDeliveryIndex]);
  assert.match(rejectedReplacementToken, /^pr2_[A-Za-z0-9_-]{43}$/);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: priorDefiniteToken }), true);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: rejectedReplacementToken }), false);
  console.log("PASS definite provider rejection preserves the prior reset link and exposes only the neutral response");

  await seedUser("ambiguous-delivery-user", "ambiguous-delivery@example.test");
  const priorAmbiguousToken = await actionTokens.createActionToken({
    purpose: "password_reset",
    userId: "ambiguous-delivery-user",
    email: "ambiguous-delivery@example.test",
    ttlMinutes: 60,
  });
  postmarkOutcome = "network_error";
  const ambiguousDeliveryIndex = deliveries.length;
  const ambiguousResponse = await requestReset("ambiguous-delivery@example.test", "127.0.11.2");
  assert.equal(ambiguousResponse.response.status, 200);
  assert.deepEqual(ambiguousResponse.body, { ok: true });
  assert.equal(ambiguousResponse.scheduledTaskCount, 1);
  assert.equal(deliveries.length, ambiguousDeliveryIndex);
  await runNextScheduledTask();
  const ambiguousReplacementToken = resetTokenFromDelivery(deliveries[ambiguousDeliveryIndex]);
  assert.match(ambiguousReplacementToken, /^pr2_[A-Za-z0-9_-]{43}$/);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: priorAmbiguousToken }), false);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: ambiguousReplacementToken }), true);
  console.log("PASS ambiguous provider outcome commits the possibly delivered replacement and invalidates its predecessor");

  postmarkOutcome = "accepted";
  postmarkDelayMs = 1_000;
  await seedUser("timing-user", "timing-user@example.test");
  const timingDeliveryCount = deliveries.length;
  const knownTiming = await requestReset("timing-user@example.test", "127.0.11.3");
  const unknownTiming = await requestReset("unknown-timing@example.test", "127.0.11.4");
  const overlongTiming = await requestReset("ignored@example.test", "127.0.11.5", JSON.stringify({
    email: `${"x".repeat(5_000)}@example.test`,
  }));
  assert.equal(deliveries.length, timingDeliveryCount);
  assert.equal(knownTiming.scheduledTaskCount, 1);
  assert.equal(unknownTiming.scheduledTaskCount, 1);
  assert.equal(overlongTiming.scheduledTaskCount, 0);
  for (const outcome of [knownTiming, unknownTiming, overlongTiming]) {
    assert.equal(outcome.response.status, 200);
    assert.deepEqual(outcome.body, { ok: true });
    assert.ok(outcome.elapsedMs >= 575, `neutral response returned too quickly (${outcome.elapsedMs}ms)`);
  }
  assert.ok(knownTiming.elapsedMs < 850, `provider latency leaked into response (${knownTiming.elapsedMs}ms)`);
  const knownTask = scheduledTasks.shift();
  assert.ok(knownTask);
  const knownTaskPromise = knownTask();
  for (let attempt = 0; attempt < 100 && deliveries.length === timingDeliveryCount; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(deliveries.length, timingDeliveryCount + 1);
  const poolProbeStartedAt = Date.now();
  await pool.query("select 1");
  const poolProbeElapsedMs = Date.now() - poolProbeStartedAt;
  assert.ok(poolProbeElapsedMs < 400, `provider I/O monopolized the one-connection pool (${poolProbeElapsedMs}ms)`);
  await knownTaskPromise;
  await runNextScheduledTask();
  postmarkDelayMs = 0;
  console.log("PASS known, unknown, and oversized reset requests share a neutral response independent of provider latency");
  console.log("PASS provider I/O holds no connection in a one-connection pool");

  const prelimitedIp = "127.0.11.6";
  await pool.query(
    `insert into rate_limit_hits (bucket, window_start, count)
     values ($1, to_timestamp(floor(extract(epoch from now()) / 900) * 900), 8)
     on conflict (bucket, window_start) do update set count = 8`,
    [`reset-request:${prelimitedIp}`],
  );
  let limitedBodyAccesses = 0;
  const limitedRequest = {
    url: "https://app.jewelhire.test/api/auth/password/reset-request",
    headers: new Headers({ "content-type": "application/json", "x-forwarded-for": prelimitedIp }),
    get body() {
      limitedBodyAccesses += 1;
      throw new Error("rate-limited request body must not be touched");
    },
  };
  const limitedScheduledBefore = scheduledTasks.length;
  const limitedResponse = await passwordResetRequest.handlePasswordResetRequest(
    limitedRequest,
    (task) => scheduledTasks.push(task),
  );
  assert.equal(limitedResponse.status, 200);
  assert.equal(limitedBodyAccesses, 0);
  assert.equal(scheduledTasks.length, limitedScheduledBefore);
  console.log("PASS exhausted IP limits are enforced before any request-body byte is read");

  const prelimitedLoginIp = "127.0.11.7";
  await pool.query(
    `insert into rate_limit_hits (bucket, window_start, count)
     values ($1, to_timestamp(floor(extract(epoch from now()) / 900) * 900), 20)
     on conflict (bucket, window_start) do update set count = 20`,
    [`login:${prelimitedLoginIp}`],
  );
  let loginBodyAccesses = 0;
  const prelimitedLoginRequest = {
    url: "https://app.jewelhire.test/api/auth/password/session",
    headers: new Headers({ "content-type": "application/json", "x-forwarded-for": prelimitedLoginIp }),
    get body() {
      loginBodyAccesses += 1;
      throw new Error("rate-limited login body must not be touched");
    },
  };
  const prelimitedLoginResponse = await passwordSessionRoute.POST(prelimitedLoginRequest);
  assert.equal(prelimitedLoginResponse.status, 303);
  assert.equal(loginBodyAccesses, 0);
  assert.match(prelimitedLoginResponse.headers.get("location") || "", /\/login\?next=%2Fdashboard&error=too_many$/);
  const oversizedLoginResponse = await passwordSessionRoute.POST(new Request(
    "https://app.jewelhire.test/api/auth/password/session",
    {
      method: "POST",
      headers: {
        "content-length": "1",
        "content-type": "application/json",
        "x-forwarded-for": "127.0.11.8",
      },
      body: JSON.stringify({ email: "transport@example.test", password: "x".repeat(20_000) }),
    },
  ));
  assert.equal(oversizedLoginResponse.status, 303);
  assert.match(oversizedLoginResponse.headers.get("location") || "", /error=password$/);
  const oversizedCompletionResponse = await resetRoute.POST(new Request(
    "https://app.jewelhire.test/api/auth/password/reset",
    {
      method: "POST",
      headers: {
        "content-length": "1",
        "content-type": "application/json",
        "x-forwarded-for": "127.0.11.9",
      },
      body: JSON.stringify({ token: `pr2_${"a".repeat(43)}`, password: "x".repeat(3_000) }),
    },
  ));
  assert.equal(oversizedCompletionResponse.status, 400);
  assert.equal((await oversizedCompletionResponse.json()).error?.code, "weak_password");
  console.log("PASS login/reset throttling precedes parsing and streamed auth bodies are bounded");

  await seedUser("mailbox-limit-user", "mailbox-limit@example.test");
  const mailboxDeliveriesBefore = deliveries.length;
  const mailboxRequests = [
    "mailbox-limit@example.test",
    " MAILBOX-LIMIT@example.test ",
    "mailbox-limit@EXAMPLE.TEST",
    "mailbox-limit@example.test",
  ];
  for (let index = 0; index < mailboxRequests.length; index += 1) {
    const outcome = await requestReset(mailboxRequests[index], `127.0.12.${index + 1}`);
    assert.equal(outcome.response.status, 200);
    assert.deepEqual(outcome.body, { ok: true });
  }
  assert.equal(scheduledTasks.length, 3);
  while (scheduledTasks.length) await runNextScheduledTask();
  assert.equal(deliveries.length, mailboxDeliveriesBefore + 3);
  const mailboxBuckets = await pool.query(
    `select bucket, count
     from rate_limit_hits
     where bucket like 'reset-request-email:%' and count = 4`,
  );
  assert.equal(mailboxBuckets.rows.length, 1);
  assert.equal(mailboxBuckets.rows[0].bucket.includes("mailbox-limit@example.test"), false);
  assert.equal(
    (await pool.query(
      `select count(*)::int as count
       from auth_action_tokens
       where purpose = 'password_reset'
         and user_id = 'mailbox-limit-user'
         and used_at is null`,
    )).rows[0]?.count,
    1,
  );
  console.log("PASS normalized mailbox throttling is silent, shared, PII-opaque, and leaves one valid link");

  await seedUser("delivery-order-user", "delivery-order@example.test");
  const originalDeliveryToken = await actionTokens.createActionToken({
    purpose: "password_reset",
    userId: "delivery-order-user",
    email: "delivery-order@example.test",
    ttlMinutes: 60,
  });
  const olderCandidate = await actionTokens.preparePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    email: "delivery-order@example.test",
    ttlMinutes: 60,
  });
  const newerCandidate = await actionTokens.preparePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    email: "delivery-order@example.test",
    ttlMinutes: 60,
  });
  await actionTokens.finalizePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    tokenId: newerCandidate.tokenId,
    outcome: "accepted",
  });
  await actionTokens.finalizePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    tokenId: olderCandidate.tokenId,
    outcome: "accepted",
  });
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: originalDeliveryToken }), false);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: olderCandidate.token }), false);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: newerCandidate.token }), true);

  // PostgreSQL retains microseconds while node-postgres Date values do not. Force
  // two issuance timestamps into the same millisecond and settle the older one
  // first. The former Date round-trip then mistook that active older bearer for a
  // newer one and rejected the actual newer candidate.
  await seedUser("microsecond-order-user", "microsecond-order@example.test");
  const microsecondOlderCandidate = await actionTokens.preparePasswordResetTokenReplacement({
    userId: "microsecond-order-user",
    email: "microsecond-order@example.test",
    ttlMinutes: 60,
  });
  const microsecondNewerCandidate = await actionTokens.preparePasswordResetTokenReplacement({
    userId: "microsecond-order-user",
    email: "microsecond-order@example.test",
    ttlMinutes: 60,
  });
  await pool.query(
    `with base as (
       select date_trunc('milliseconds', clock_timestamp()) as value
     )
     update auth_action_tokens token
     set created_at = base.value + case
       when token.id = $1 then interval '1 microsecond'
       else interval '2 microseconds'
     end
     from base
     where token.id in ($1, $2)`,
    [microsecondOlderCandidate.tokenId, microsecondNewerCandidate.tokenId],
  );
  await actionTokens.finalizePasswordResetTokenReplacement({
    userId: "microsecond-order-user",
    tokenId: microsecondOlderCandidate.tokenId,
    outcome: "accepted",
  });
  await actionTokens.finalizePasswordResetTokenReplacement({
    userId: "microsecond-order-user",
    tokenId: microsecondNewerCandidate.tokenId,
    outcome: "accepted",
  });
  assert.equal(
    await actionTokens.isActionTokenValid({ purpose: "password_reset", token: microsecondOlderCandidate.token }),
    false,
  );
  assert.equal(
    await actionTokens.isActionTokenValid({ purpose: "password_reset", token: microsecondNewerCandidate.token }),
    true,
  );

  const latestAcceptedCandidate = await actionTokens.preparePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    email: "delivery-order@example.test",
    ttlMinutes: 60,
  });
  const latestFailedCandidate = await actionTokens.preparePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    email: "delivery-order@example.test",
    ttlMinutes: 60,
  });
  await actionTokens.finalizePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    tokenId: latestFailedCandidate.tokenId,
    outcome: "definite_failure",
  });
  await actionTokens.finalizePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    tokenId: latestAcceptedCandidate.tokenId,
    outcome: "accepted",
  });
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: newerCandidate.token }), false);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: latestAcceptedCandidate.token }), true);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: latestFailedCandidate.token }), false);

  const stalePendingCandidate = await actionTokens.preparePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    email: "delivery-order@example.test",
    ttlMinutes: 60,
  });
  const replacementForStalePending = await actionTokens.preparePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    email: "delivery-order@example.test",
    ttlMinutes: 60,
  });
  await actionTokens.finalizePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    tokenId: replacementForStalePending.tokenId,
    outcome: "ambiguous",
  });
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: stalePendingCandidate.token }), false);
  assert.equal(
    await actionTokens.finalizePasswordResetTokenReplacement({
      userId: "delivery-order-user",
      tokenId: stalePendingCandidate.tokenId,
      outcome: "accepted",
    }),
    "already_settled",
  );
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: replacementForStalePending.token }), true);
  const forwardOlderCandidate = await actionTokens.preparePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    email: "delivery-order@example.test",
    ttlMinutes: 60,
  });
  const forwardNewerCandidate = await actionTokens.preparePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    email: "delivery-order@example.test",
    ttlMinutes: 60,
  });
  await actionTokens.finalizePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    tokenId: forwardOlderCandidate.tokenId,
    outcome: "accepted",
  });
  await actionTokens.finalizePasswordResetTokenReplacement({
    userId: "delivery-order-user",
    tokenId: forwardNewerCandidate.tokenId,
    outcome: "accepted",
  });
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: forwardOlderCandidate.token }), false);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: forwardNewerCandidate.token }), true);
  console.log("PASS reset delivery settlement is issuance-ordered across reversed provider outcomes");
  console.log("PASS a newer successful reset retires older active and unsettled bearers while a newer rejection preserves fallback");

  await pool.query(
    `insert into companies (id, name, status)
     values ('credential-rotation-company', 'Credential Rotation Co', 'active')`,
  );
  await seedUser("set-password-user", "set-password@example.test");
  const setPasswordResetToken = await actionTokens.createActionToken({
    purpose: "password_reset",
    userId: "set-password-user",
    email: "set-password@example.test",
    ttlMinutes: 60,
  });
  const setPasswordClaimToken = await actionTokens.createActionToken({
    purpose: "account_claim",
    userId: "set-password-user",
    email: "set-password@example.test",
    companyId: "credential-rotation-company",
    ttlMinutes: 60,
  });
  await passwordAuth.setPassword("set-password-user", "SetPasswordRotation123!");
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: setPasswordResetToken }), false);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "account_claim", token: setPasswordClaimToken }), false);
  assert.equal(
    (await pool.query("select native_auth_epoch from users where id = 'set-password-user'")).rows[0]?.native_auth_epoch,
    1,
  );

  await seedUser("operator-password-user", "operator-password@example.test");
  const operatorResetToken = await actionTokens.createActionToken({
    purpose: "password_reset",
    userId: "operator-password-user",
    email: "operator-password@example.test",
    ttlMinutes: 60,
  });
  const operatorClaimToken = await actionTokens.createActionToken({
    purpose: "account_claim",
    userId: "operator-password-user",
    email: "operator-password@example.test",
    companyId: "credential-rotation-company",
    ttlMinutes: 60,
  });
  const operatorPassword = "OperatorRotationPassword123!";
  const operatorResult = await runCommand(
    process.execPath,
    [path.join(rootDir, "scripts", "ops-password-credential.mjs"), "--email", "operator-password@example.test"],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        DATABASE_URL: testUrl.toString(),
        JEWELHIRE_OPERATOR_PASSWORD: operatorPassword,
      },
    },
  );
  assert.equal(operatorResult.code, 0, `${operatorResult.stdout}\n${operatorResult.stderr}`);
  assert.equal(`${operatorResult.stdout}${operatorResult.stderr}`.includes(operatorPassword), false);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: operatorResetToken }), false);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "account_claim", token: operatorClaimToken }), false);
  assert.equal(
    (await pool.query("select native_auth_epoch from users where id = 'operator-password-user'")).rows[0]?.native_auth_epoch,
    1,
  );
  assert.equal((await passwordAuth.loginWithPassword({
    email: "operator-password@example.test",
    password: operatorPassword,
  })).ok, true);
  console.log("PASS standalone and operator credential rotations atomically revoke sessions and recovery links");

  const knownLoginDurations = [];
  const unknownLoginDurations = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let startedAt = Date.now();
    assert.deepEqual(
      await passwordAuth.loginWithPassword({
        email: "operator-password@example.test",
        password: "WrongTimingPassword123!",
      }),
      { ok: false, code: "invalid_credentials" },
    );
    knownLoginDurations.push(Date.now() - startedAt);
    startedAt = Date.now();
    assert.deepEqual(
      await passwordAuth.loginWithPassword({
        email: `unknown-login-${attempt}@example.test`,
        password: "WrongTimingPassword123!",
      }),
      { ok: false, code: "invalid_credentials" },
    );
    unknownLoginDurations.push(Date.now() - startedAt);
  }
  const median = (values) => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
  const knownLoginMedian = median(knownLoginDurations);
  const unknownLoginMedian = median(unknownLoginDurations);
  assert.ok(knownLoginMedian >= 10, `known login skipped bounded KDF work (${knownLoginMedian}ms)`);
  assert.ok(unknownLoginMedian >= 10, `unknown login skipped dummy KDF work (${unknownLoginMedian}ms)`);
  assert.ok(
    Math.max(knownLoginMedian, unknownLoginMedian) / Math.max(1, Math.min(knownLoginMedian, unknownLoginMedian)) < 2.5,
    `known/unknown login timing diverged (${knownLoginMedian}ms vs ${unknownLoginMedian}ms)`,
  );
  assert.deepEqual(
    await passwordAuth.loginWithPassword({
      email: "not-present@example.test",
      password: "not-a-real-password",
    }),
    { ok: false, code: "invalid_credentials" },
  );
  await pool.query(
    `update password_credentials
     set password_hash = 'scrypt$1$1073741824$8$1$malformed$AAAA'
     where user_id = 'operator-password-user'`,
  );
  assert.deepEqual(
    await passwordAuth.loginWithPassword({
      email: "operator-password@example.test",
      password: operatorPassword,
    }),
    { ok: false, code: "invalid_credentials" },
  );
  console.log("PASS known, unknown, and malformed-hash logins perform one bounded scrypt verification");

  await seedUser("legacy-query-user", "legacy-query@example.test");
  const legacyQueryToken = "l".repeat(43);
  await pool.query(
    `insert into auth_action_tokens (
       id, purpose, user_id, email_normalized, token_hash, expires_at
     ) values (
       'legacy-query-reset', 'password_reset', 'legacy-query-user',
       'legacy-query@example.test', $1, now() + interval '1 hour'
     )`,
    [actionTokens.hashActionToken(legacyQueryToken)],
  );
  assert.equal(
    await actionTokens.isActionTokenValid({ purpose: "password_reset", token: legacyQueryToken }),
    false,
  );
  assert.deepEqual(
    await passwordAuth.completePasswordReset({
      token: legacyQueryToken,
      password: "LegacyMustNotRedeem123!",
    }),
    { ok: false, reason: "invalid_token" },
  );
  assert.equal(
    (await pool.query("select used_at from auth_action_tokens where id = 'legacy-query-reset'"))
      .rows[0]?.used_at,
    null,
  );
  assert.equal(
    (await pool.query("select count(*)::int as count from password_credentials where user_id = 'legacy-query-user'"))
      .rows[0]?.count,
    0,
  );
  console.log("PASS pre-cutover query-string reset bearers are deliberately unredeemable");

  await seedUser("rollback-user", "rollback@example.test");
  await passwordAuth.setPassword("rollback-user", "OriginalPassword123!");
  const rollbackToken = await actionTokens.createActionToken({
    purpose: "password_reset",
    userId: "rollback-user",
    email: "rollback@example.test",
    ttlMinutes: 60,
  });
  await pool.query(
    `create function reject_password_reset_write() returns trigger language plpgsql as $$
       begin
         raise exception 'simulated credential write failure';
       end;
     $$`,
  );
  await pool.query(
    `create trigger reject_password_reset_write
     before insert or update on password_credentials
     for each row execute function reject_password_reset_write()`,
  );
  await assert.rejects(
    passwordAuth.completePasswordReset({ token: rollbackToken, password: "ReplacementPassword123!" }),
    /simulated credential write failure/,
  );
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: rollbackToken }), true);
  assert.equal((await passwordAuth.loginWithPassword({
    email: "rollback@example.test",
    password: "OriginalPassword123!",
  })).ok, true);
  await pool.query("drop trigger reject_password_reset_write on password_credentials");
  await pool.query("drop function reject_password_reset_write()");
  const rollbackRetry = await passwordAuth.completePasswordReset({
    token: rollbackToken,
    password: "ReplacementPassword123!",
  });
  assert.equal(rollbackRetry.ok, true);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: rollbackToken }), false);
  assert.equal((await passwordAuth.loginWithPassword({
    email: "rollback@example.test",
    password: "ReplacementPassword123!",
  })).ok, true);
  console.log("PASS credential failure rolls back the write and retains the reset token for a safe retry");

  await seedUser("session-epoch-user", "session-epoch@example.test");
  await passwordAuth.setPassword("session-epoch-user", "EpochOriginalPassword123!");
  const oldLogin = await passwordAuth.loginWithPassword({
    email: "session-epoch@example.test",
    password: "EpochOriginalPassword123!",
  });
  assert.equal(oldLogin.ok, true);
  const preResetEpoch = oldLogin.session.nativeAuthEpoch;
  assert.equal(preResetEpoch, 1);
  const oldCookie = auth.createSessionToken(oldLogin.session);
  assert.equal(auth.readSessionToken(oldCookie)?.nativeAuthEpoch, preResetEpoch);
  assert.equal((await auth.revalidateNativeSession(oldLogin.session))?.userId, "session-epoch-user");
  const { nativeAuthEpoch: _legacyEpoch, ...legacyNativeSession } = oldLogin.session;
  assert.equal(_legacyEpoch, preResetEpoch);
  assert.equal(auth.readSessionToken(auth.createSessionToken(legacyNativeSession)), undefined);

  const sessionEpochResetToken = await actionTokens.createActionToken({
    purpose: "password_reset",
    userId: "session-epoch-user",
    email: "session-epoch@example.test",
    ttlMinutes: 60,
  });
  const completedEpochReset = await passwordAuth.completePasswordReset({
    token: sessionEpochResetToken,
    password: "EpochReplacementPassword123!",
  });
  assert.equal(completedEpochReset.ok, true);
  assert.equal(completedEpochReset.nativeAuthEpoch, preResetEpoch + 1);
  assert.equal(
    (await pool.query("select native_auth_epoch from users where id = 'session-epoch-user'"))
      .rows[0]?.native_auth_epoch,
    preResetEpoch + 1,
  );
  // Signature verification alone still recognizes the old cookie, but every
  // native request performs the durable database epoch check and rejects it.
  assert.equal(auth.readSessionToken(oldCookie)?.nativeAuthEpoch, preResetEpoch);
  assert.equal(await auth.revalidateNativeSession(oldLogin.session), undefined);
  assert.equal(await auth.findSessionForVerifiedNativeCredential({
    email: "session-epoch@example.test",
    userId: "session-epoch-user",
    nativeAuthEpoch: preResetEpoch,
  }), undefined);
  assert.equal((await auth.findSessionForVerifiedNativeCredential({
    email: completedEpochReset.email,
    userId: completedEpochReset.userId,
    nativeAuthEpoch: completedEpochReset.nativeAuthEpoch,
  }))?.userId, "session-epoch-user");
  assert.equal((await passwordAuth.loginWithPassword({
    email: "session-epoch@example.test",
    password: "EpochOriginalPassword123!",
  })).ok, false);
  const newLogin = await passwordAuth.loginWithPassword({
    email: "session-epoch@example.test",
    password: "EpochReplacementPassword123!",
  });
  assert.equal(newLogin.ok, true);
  assert.equal(newLogin.session.nativeAuthEpoch, preResetEpoch + 1);
  assert.equal((await auth.revalidateNativeSession(newLogin.session))?.userId, "session-epoch-user");
  await passwordAuth.setPassword("session-epoch-user", "EpochLatestPassword123!");
  assert.equal(await auth.findSessionForVerifiedNativeCredential({
    email: completedEpochReset.email,
    userId: completedEpochReset.userId,
    nativeAuthEpoch: completedEpochReset.nativeAuthEpoch,
  }), undefined);
  console.log("PASS password replacement revokes older cookies and post-reset hydration is bound to its committed epoch");

  await seedUser("concurrent-user", "concurrent@example.test");
  const concurrentToken = await actionTokens.createActionToken({
    purpose: "password_reset",
    userId: "concurrent-user",
    email: "concurrent@example.test",
    ttlMinutes: 60,
  });
  const concurrentResults = await Promise.all([
    passwordAuth.completePasswordReset({ token: concurrentToken, password: "ConcurrentPassword123!" }),
    passwordAuth.completePasswordReset({ token: concurrentToken, password: "ConcurrentPassword123!" }),
  ]);
  assert.equal(concurrentResults.filter((result) => result.ok).length, 1);
  assert.equal(
    concurrentResults.filter((result) => !result.ok && result.reason === "invalid_token").length,
    1,
  );
  const concurrentReplay = await passwordAuth.completePasswordReset({
    token: concurrentToken,
    password: "ConcurrentPassword123!",
  });
  assert.deepEqual(concurrentReplay, { ok: false, reason: "invalid_token" });
  console.log("PASS concurrent redemption has exactly one winner and every replay is rejected");

  await seedUser("locked-policy-user", "locked-policy@example.test");
  const lockedPolicyToken = await actionTokens.createActionToken({
    purpose: "password_reset",
    userId: "locked-policy-user",
    email: "locked-policy@example.test",
    ttlMinutes: 60,
  });
  const blocker = new Client({ connectionString: testUrl.toString(), ssl: false });
  const observer = new Client({ connectionString: testUrl.toString(), ssl: false });
  await blocker.connect();
  await observer.connect();
  await blocker.query("begin");
  await blocker.query("select id from users where id = 'locked-policy-user' for update");
  const lockedCompletion = passwordAuth.completePasswordReset({
    token: lockedPolicyToken,
    password: "LockedPolicyPassword123!",
  });
  let observedBlockedUserLock = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const waiting = await observer.query(
      `select count(*)::int as count
       from pg_stat_activity
       where datname = current_database()
         and wait_event_type = 'Lock'
         and query like '%select id, email, email_normalized, status, native_auth_enabled%'`,
    );
    if (waiting.rows[0]?.count > 0) {
      observedBlockedUserLock = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await blocker.query(
    "update users set native_auth_enabled = false where id = 'locked-policy-user'",
  );
  await blocker.query("commit");
  const lockedPolicyResult = await lockedCompletion;
  await blocker.end();
  await observer.end();
  assert.equal(observedBlockedUserLock, true);
  assert.deepEqual(lockedPolicyResult, { ok: false, reason: "jewellink_required" });
  assert.equal(
    await actionTokens.isActionTokenValid({ purpose: "password_reset", token: lockedPolicyToken }),
    true,
  );
  console.log("PASS policy is re-read after waiting for the user lock and a denied race retains the token");

  await seedUser("policy-user", "policy@example.test");
  const policyToken = await actionTokens.createActionToken({
    purpose: "password_reset",
    userId: "policy-user",
    email: "policy@example.test",
    ttlMinutes: 60,
  });
  await pool.query("update users set native_auth_enabled = false where id = 'policy-user'");
  assert.deepEqual(
    await passwordAuth.completePasswordReset({ token: policyToken, password: "PolicyPassword123!" }),
    { ok: false, reason: "jewellink_required" },
  );
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: policyToken }), true);

  await pool.query(
    `update users
     set native_auth_enabled = true,
         email = 'changed-policy@example.test',
         email_normalized = 'changed-policy@example.test'
     where id = 'policy-user'`,
  );
  assert.deepEqual(
    await passwordAuth.completePasswordReset({ token: policyToken, password: "PolicyPassword123!" }),
    { ok: false, reason: "invalid_token" },
  );
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: policyToken }), true);

  await pool.query(
    `update users
     set email = 'policy@example.test', email_normalized = 'policy@example.test'
     where id = 'policy-user'`,
  );
  process.env.JEWELHIRE_ADMIN_EMAILS = "policy@example.test";
  assert.deepEqual(
    await passwordAuth.completePasswordReset({ token: policyToken, password: "PolicyPassword123!" }),
    { ok: false, reason: "jewellink_required" },
  );
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: policyToken }), true);
  process.env.JEWELHIRE_ADMIN_EMAILS = "platform-admin@example.test";
  assert.equal((await passwordAuth.completePasswordReset({
    token: policyToken,
    password: "PolicyPassword123!",
  })).ok, true);
  console.log("PASS SSO-only, changed-email, and newly-admin identities are denied without burning the link");

  await seedUser("fallback-user", "fallback@example.test");
  const fallbackToken = await actionTokens.createActionToken({
    purpose: "password_reset",
    userId: "fallback-user",
    email: "fallback@example.test",
    ttlMinutes: 60,
  });
  delete process.env.AUTH_SECRET;
  const sessionErrors = [];
  console.error = (...args) => sessionErrors.push(args);
  const fallbackResponse = await resetRoute.POST(new Request(
    "https://app.jewelhire.test/api/auth/password/reset",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "127.0.10.2" },
      body: JSON.stringify({ token: fallbackToken, password: "FallbackPassword123!" }),
    },
  ));
  const fallbackBody = await fallbackResponse.json();
  assert.equal(fallbackResponse.status, 200);
  assert.deepEqual(fallbackBody, { ok: true, role: "associate", next: "/login" });
  assert.equal(fallbackResponse.headers.get("set-cookie"), null);
  assert.equal(await actionTokens.isActionTokenValid({ purpose: "password_reset", token: fallbackToken }), false);
  assert.equal(sessionErrors.length, 1);
  assert.match(String(sessionErrors[0]?.[0]), /Password changed but session hydration failed/);
  process.env.AUTH_SECRET = "password-reset-test-auth-secret-at-least-32-bytes";
  console.error = originalConsoleError;
  assert.equal((await passwordAuth.loginWithPassword({
    email: "fallback@example.test",
    password: "FallbackPassword123!",
  })).ok, true);
  console.log("PASS post-commit session failure reports success and sends the user to login");

  await seedUser("after-route-user", "after-route@example.test");
  await smokeNextAfterRoute({ pool, testUrl });
  console.log("PASS the real Next route schedules and completes reset work inside request-scoped after()");

  const readyReport = await postgresReadiness.checkPostgresReadiness();
  assert.equal(readyReport.ok, true);
  assert.equal(readyReport.configured, true);
  assert.equal(readyReport.schemaInvariants.nativeAuthEpoch.ready, true);
  assert.equal(readyReport.schemaInvariants.passwordResetDeliveryState.ready, true);
  assert.equal(readyReport.migrations.required.includes("0021_native_auth_epoch"), true);
  assert.equal(readyReport.migrations.required.includes("0022_password_reset_delivery_state"), true);
  const deliveryMigrationLedger = (
    await pool.query("select id, filename, checksum, applied_at from schema_migrations where id = '0022_password_reset_delivery_state'")
  ).rows[0];
  await pool.query("alter table auth_action_tokens alter column delivery_state drop default");
  const malformedDeliveryReport = await postgresReadiness.checkPostgresReadiness();
  assert.equal(malformedDeliveryReport.ok, false);
  assert.equal(malformedDeliveryReport.schemaInvariants.passwordResetDeliveryState.defaultActive, false);
  await pool.query("alter table auth_action_tokens alter column delivery_state set default 'active'");
  await pool.query("delete from schema_migrations where id = '0022_password_reset_delivery_state'");
  const missingDeliveryReport = await postgresReadiness.checkPostgresReadiness();
  assert.equal(missingDeliveryReport.ok, false);
  assert.equal(
    missingDeliveryReport.migrations.missingRequired.includes("0022_password_reset_delivery_state"),
    true,
  );
  await pool.query(
    `insert into schema_migrations (id, filename, checksum, applied_at)
     values ($1, $2, $3, $4)`,
    [
      deliveryMigrationLedger.id,
      deliveryMigrationLedger.filename,
      deliveryMigrationLedger.checksum,
      deliveryMigrationLedger.applied_at,
    ],
  );
  console.log("PASS database readiness fails closed on delivery-state schema or migration drift");
  await pool.query("alter table users alter column native_auth_epoch drop default");
  const malformedEpochReport = await postgresReadiness.checkPostgresReadiness();
  assert.equal(malformedEpochReport.ok, false);
  assert.equal(malformedEpochReport.configured, true);
  assert.equal(malformedEpochReport.schemaInvariants.nativeAuthEpoch.defaultZero, false);
  await pool.query("delete from schema_migrations where id = '0021_native_auth_epoch'");
  const missingEpochReport = await postgresReadiness.checkPostgresReadiness();
  assert.equal(missingEpochReport.ok, false);
  assert.equal(missingEpochReport.configured, true);
  assert.equal(missingEpochReport.migrations.missingRequired.includes("0021_native_auth_epoch"), true);
  console.log("PASS database readiness fails closed without the native session epoch migration ledger row");
}

try {
  await main();
} finally {
  teardownStarted = true;
  console.error = originalConsoleError;
  globalThis.fetch = originalFetch;
  if (pool) await pool.end().catch(() => {});
  if (databaseCreated) {
    await admin.query(`drop database if exists "${databaseName}" with (force)`).catch(() => {});
  }
  await admin.end().catch(() => {});
}
