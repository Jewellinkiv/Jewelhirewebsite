#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const adminUrl = new URL(process.env.JEWELHIRE_TEST_POSTGRES_ADMIN_URL || "postgresql:///postgres?sslmode=disable");
if (!["", "localhost", "127.0.0.1", "::1"].includes(adminUrl.hostname)) {
  throw new Error("Refusing to create a hybrid-access test database on a non-local PostgreSQL host.");
}

const databaseName = `jewelhire_hybrid_access_${process.pid}_${randomBytes(5).toString("hex")}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.set("sslmode", "disable");
const admin = new Client({ connectionString: adminUrl.toString(), ssl: false });
let databaseCreated = false;
let pool;

async function migrateDatabase() {
  const client = new Client({ connectionString: testUrl.toString(), ssl: false });
  await client.connect();
  try {
    const files = fs.readdirSync(path.join(rootDir, "db", "migrations"))
      .filter((filename) => /^\d{4}_.+\.sql$/.test(filename))
      .sort();
    for (const filename of files) {
      await client.query(fs.readFileSync(path.join(rootDir, "db", "migrations", filename), "utf8"));
    }
  } finally {
    await client.end();
  }
}

function session(input) {
  return {
    userId: input.userId,
    name: input.name || input.userId,
    email: input.email,
    role: input.role,
    storeIds: input.storeIds || [],
    storeRoles: input.storeRoles || {},
    locationScopes: input.locationScopes || {},
    activeStoreId: input.storeIds?.[0] || "",
    authSource: input.authSource || "native",
    upstreamUserId: input.upstreamUserId,
    guardrails: {
      phase: "phase_1_single_store",
      applicantScope: "store_private",
      marketplace: false,
      candidateReviews: false,
    },
  };
}

async function seedResourceSet(kind, jobId, email = `${kind}@example.test`) {
  const profileId = `profile-${kind}`;
  const applicationId = `application-${kind}`;
  await pool.query(
    `insert into applicant_profiles (
       id, full_name, email, email_normalized, visibility
     ) values ($1, $2, $3, lower($3), 'private_store_application')`,
    [profileId, `Applicant ${kind}`, email],
  );
  await pool.query(
    `insert into applications (
       id, store_id, job_id, applicant_profile_id, source, stage
     ) values ($1, 'store-sissys-little-rock', $2, $3, 'public_store_page', 'applied')`,
    [applicationId, jobId, profileId],
  );
  await pool.query(
    `insert into gemmatch_invites (
       id, application_id, store_id, status
     ) values ($1, $2, 'store-sissys-little-rock', 'started')`,
    [`gem-${kind}`, applicationId],
  );
  await pool.query(
    `insert into interviews (
       id, application_id, store_id, starts_at, location_type, status
     ) values ($1, $2, 'store-sissys-little-rock', now() + interval '1 day', 'in_store', 'scheduled')`,
    [`interview-${kind}`, applicationId],
  );
  await pool.query(
    `insert into course_assignments (
       id, store_id, course_id, recipient_type, recipient_id, application_id, status, source
     ) values ($1, 'store-sissys-little-rock', 'hybrid-course', 'applicant', $2, $3, 'not_started', 'manager')`,
    [`assignment-${kind}`, profileId, applicationId],
  );
  return {
    gem: `gem-${kind}`,
    interview: `interview-${kind}`,
    assignment: `assignment-${kind}`,
  };
}

async function main() {
  await admin.connect();
  await admin.query(`create database "${databaseName}"`);
  databaseCreated = true;
  await migrateDatabase();

  process.env.DATABASE_URL = testUrl.toString();
  process.env.POSTGRES_POOL_MAX = "4";
  process.env.JEWELHIRE_STORAGE = "postgres";

  const postgres = await import("../lib/server/postgres.ts");
  const phase1 = await import("../lib/server/postgres-phase1.ts");
  const access = await import("../lib/server/access-control.ts");
  const { apiErrorResponse } = await import("../lib/server/api-errors.ts");
  pool = postgres.getPostgresPool();

  await pool.query(
    `insert into companies (id, name, status)
       values ('hybrid-company', 'Hybrid Company', 'active');
     insert into stores (id, company_id, name, slug, status)
       values ('store-sissys-little-rock', 'hybrid-company', 'Hybrid Store', 'hybrid-store', 'active');
     insert into locations (id, store_id, name) values
       ('little-rock', 'store-sissys-little-rock', 'Little Rock, AR'),
       ('memphis', 'store-sissys-little-rock', 'Memphis, TN'),
       ('north', 'store-sissys-little-rock', 'North'),
       ('north-mall', 'store-sissys-little-rock', 'North Mall');
     insert into public_jobs (id, store_id, slug, title, location, status) values
       ('job-same', 'store-sissys-little-rock', 'same', 'Same Location', 'Little Rock, AR', 'open'),
       ('job-cross', 'store-sissys-little-rock', 'cross', 'Cross Location', 'Memphis, TN', 'open'),
       ('job-missing', 'store-sissys-little-rock', 'missing', 'Missing Location', 'Remote', 'open'),
       ('job-prefix', 'store-sissys-little-rock', 'prefix', 'Prefix Location', 'North Mall', 'open'),
       ('job-ambiguous', 'store-sissys-little-rock', 'ambiguous', 'Ambiguous Location', 'North Mall District', 'open');
     insert into courses (id, slug, title, status)
       values ('hybrid-course', 'hybrid-course', 'Hybrid Course', 'published')`,
  );

  const fixtures = {
    same: await seedResourceSet("same", "job-same"),
    cross: await seedResourceSet("cross", "job-cross", "maya.chen@email.com"),
    missing: await seedResourceSet("missing", "job-missing"),
    prefix: await seedResourceSet("prefix", "job-prefix"),
    ambiguous: await seedResourceSet("ambiguous", "job-ambiguous"),
  };

  await pool.query(
    `insert into team_members (id, store_id, location_id, name, status) values
       ('team-same', 'store-sissys-little-rock', 'little-rock', 'Same Team Member', 'active'),
       ('team-cross', 'store-sissys-little-rock', 'memphis', 'Cross Team Member', 'active');
     insert into course_assignments (
       id, store_id, course_id, recipient_type, recipient_id, team_member_id, status, source
     ) values
       ('assignment-team-same', 'store-sissys-little-rock', 'hybrid-course', 'team_member', 'team-same', 'team-same', 'not_started', 'manager'),
       ('assignment-team-cross', 'store-sissys-little-rock', 'hybrid-course', 'team_member', 'team-cross', 'team-cross', 'not_started', 'manager')`,
  );

  const manager = session({
    userId: "limited-manager",
    email: "limited-manager@example.test",
    role: "manager",
    storeIds: ["store-sissys-little-rock"],
    storeRoles: { "store-sissys-little-rock": "manager" },
    locationScopes: { "store-sissys-little-rock": { allLocations: false, locationIds: ["little-rock"] } },
  });
  const allLocationManager = session({
    userId: "all-manager",
    email: "all-manager@example.test",
    role: "manager",
    storeIds: ["store-sissys-little-rock"],
    storeRoles: { "store-sissys-little-rock": "manager" },
    locationScopes: { "store-sissys-little-rock": { allLocations: true, locationIds: [] } },
  });
  const owner = session({
    userId: "owner",
    email: "owner@example.test",
    role: "store_owner",
    storeIds: ["store-sissys-little-rock"],
    storeRoles: { "store-sissys-little-rock": "store_owner" },
    locationScopes: { "store-sissys-little-rock": { allLocations: true, locationIds: [] } },
  });
  const prefixCollisionManager = session({
    userId: "north-manager",
    email: "north-manager@example.test",
    role: "manager",
    storeIds: ["store-sissys-little-rock"],
    storeRoles: { "store-sissys-little-rock": "manager" },
    locationScopes: { "store-sissys-little-rock": { allLocations: false, locationIds: ["north"] } },
  });
  const adminSession = session({ userId: "admin", email: "admin@example.test", role: "admin" });
  const recipient = session({ userId: "recipient", email: "maya.chen@email.com", role: "associate" });

  const scopeFor = async (fixture) => ({
    gem: await phase1.getPostgresGemMatchInviteScope(fixture.gem),
    interview: await phase1.getPostgresInterviewRsvpScope(fixture.interview),
    assignment: await phase1.getPostgresCourseAssignment(fixture.assignment),
  });
  const scopes = {
    same: await scopeFor(fixtures.same),
    cross: await scopeFor(fixtures.cross),
    missing: await scopeFor(fixtures.missing),
    prefix: await scopeFor(fixtures.prefix),
    ambiguous: await scopeFor(fixtures.ambiguous),
  };

  assert.equal(scopes.same.gem?.resourceLocation, "little-rock");
  assert.equal(scopes.same.interview?.resourceLocation, "little-rock");
  assert.equal(scopes.same.assignment?.resourceLocation, "little-rock");
  assert.equal(scopes.cross.gem?.resourceLocation, "memphis");
  assert.equal(scopes.cross.interview?.resourceLocation, "memphis");
  assert.equal(scopes.cross.assignment?.resourceLocation, "memphis");
  assert.equal(scopes.missing.gem?.resourceLocation, undefined);
  assert.equal(scopes.prefix.gem?.resourceLocation, "north-mall");
  assert.equal(scopes.ambiguous.gem?.resourceLocation, undefined);
  console.log("PASS PostgreSQL resolves unique persisted job locations and fails missing or ambiguous mappings closed");

  const policyInput = (scope, operation) => ({
    storeId: scope?.storeId,
    recipientEmail: scope?.recipientEmail,
    resourceLocation: scope?.resourceLocation,
    operation,
  });
  const operationByKind = {
    gem: "gemmatch.responses.create",
    interview: "interviews.rsvp",
    assignment: "course_assignments.progress",
  };

  for (const kind of Object.keys(operationByKind)) {
    assert.equal(access.assertRecipientOrStoreAccess(manager, policyInput(scopes.same[kind], operationByKind[kind])), manager);
    for (const fixtureName of ["cross", "missing", "ambiguous"]) {
      let denied;
      try {
        access.assertRecipientOrStoreAccess(manager, policyInput(scopes[fixtureName][kind], operationByKind[kind]));
      } catch (error) {
        denied = error;
      }
      assert.ok(denied instanceof access.AccessDeniedError, `${kind}/${fixtureName} must deny limited manager`);
      assert.equal(apiErrorResponse(denied).status, 403);
    }
    assert.equal(access.assertRecipientOrStoreAccess(recipient, policyInput(scopes.cross[kind], operationByKind[kind])), recipient);
    assert.equal(access.assertRecipientOrStoreAccess(allLocationManager, policyInput(scopes.missing[kind], operationByKind[kind])), allLocationManager);
    assert.equal(access.assertRecipientOrStoreAccess(owner, policyInput(scopes.missing[kind], operationByKind[kind])), owner);
    assert.equal(access.assertRecipientOrStoreAccess(adminSession, policyInput(scopes.missing[kind], operationByKind[kind])), adminSession);
  }
  console.log("PASS API authorization denies cross/unresolved scoped managers and preserves same-location, recipient, owner, and admin access");

  for (const kind of Object.keys(operationByKind)) {
    assert.throws(
      () => access.assertRecipientOrStoreAccess(
        prefixCollisionManager,
        policyInput(scopes.prefix[kind], operationByKind[kind]),
      ),
      access.AccessDeniedError,
      `${kind} must not treat north as authorization for north-mall`,
    );
  }
  console.log("PASS persisted location ids require exact normalized equality and reject prefix collisions");

  const teamSame = await phase1.getPostgresCourseAssignment("assignment-team-same");
  const teamCross = await phase1.getPostgresCourseAssignment("assignment-team-cross");
  assert.equal(teamSame?.resourceLocation, "little-rock");
  assert.equal(teamCross?.resourceLocation, "memphis");
  assert.equal(access.assertRecipientOrStoreAccess(manager, policyInput(teamSame, "course_assignments.progress")), manager);
  assert.throws(
    () => access.assertRecipientOrStoreAccess(manager, policyInput(teamCross, "course_assignments.progress")),
    access.AccessDeniedError,
  );
  console.log("PASS team-member course assignments authorize from persisted team location ids");
}

async function waitForDatabaseSessionsToDrain({ timeoutMs = 10_000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await admin.query(
      "select count(*)::int as sessions from pg_stat_activity where datname = $1",
      [databaseName],
    );
    const sessions = result.rows[0]?.sessions ?? 0;
    if (sessions === 0) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `Disposable database "${databaseName}" still has ${sessions} session(s) after ${timeoutMs}ms; refusing to force-drop.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

try {
  await main();
} finally {
  if (pool) await pool.end().catch(() => undefined);
  if (databaseCreated) {
    await waitForDatabaseSessionsToDrain().catch(() => undefined);
    await admin.query(`drop database if exists "${databaseName}"`).catch(() => undefined);
  }
  await admin.end().catch(() => undefined);
}
