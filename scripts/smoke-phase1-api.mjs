import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

const baseUrl = (args.get("base") || process.env.JEWELHIRE_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const mode = args.get("mode") || process.env.JEWELHIRE_SMOKE_MODE || "local";
const runMutations = args.has("mutations") || process.env.JEWELHIRE_MUTATION_SMOKE === "1";
const rootDir = process.cwd();

const STORE_ID = "store-sissys-little-rock";
const STORE_SLUG = "sissys-log-cabin-careers";
const JOB_ID = "job-luxury-sales-associate";
const MAYA_EMAIL = "maya.chen@email.com";
const ADMIN_COMPANY_ID = "co-sissys";
const SISSYS_SESSION = mode === "postgres" ? { "x-jewelhire-session": "sissys" } : {};
const HARBOR_SESSION = mode === "postgres" ? { "x-jewelhire-session": "harbor" } : {};
const ADMIN_SESSION = mode === "postgres" ? { "x-jewelhire-session": "admin" } : {};

function loadEnvFile(filename) {
  const filePath = path.join(rootDir, filename);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

const readChecks = [
  { name: "session", path: "/api/me", expect: (body) => body?.activeStoreId },
  {
    name: "database health",
    path: "/api/admin/database/health",
    expect: (body) => (mode === "postgres" ? body?.ok === true : body?.status === "missing_env" || body?.ok === true),
  },
  {
    name: "database readiness",
    path: "/api/admin/database/readiness",
    expect: (body) => (mode === "postgres" ? body?.ok === true && body?.status === "schema_ready" : body?.status === "missing_env" || body?.ok === true),
  },
  { name: "public store", path: `/api/public/stores/${STORE_SLUG}`, expect: (body) => (body?.store || body?.page) && Array.isArray(body?.jobs) },
  { name: "public job", path: `/api/public/stores/${STORE_SLUG}/jobs/${JOB_ID}`, expect: (body) => body?.job?.id === JOB_ID },
  { name: "store pipeline", path: `/api/stores/${STORE_ID}/applications?q=maya`, expect: (body) => Array.isArray(body?.items) },
  { name: "application detail", path: `/api/stores/${STORE_ID}/applications/app-maya-chen`, expect: (body) => body?.application?.id === "app-maya-chen" },
  { name: "store applicants", path: `/api/stores/${STORE_ID}/applicants?q=maya`, expect: (body) => Array.isArray(body?.items) && body.items.some((item) => item.applicationId === "app-maya-chen") },
  { name: "applicant detail", path: "/api/applicants/maya-chen", expect: (body) => body?.application?.id === "app-maya-chen" && body?.profile?.email === MAYA_EMAIL },
  { name: "applicant timeline", path: "/api/applicants/maya-chen/timeline", expect: (body) => Array.isArray(body?.items) && body.items.length > 0 },
  { name: "applicant notes", path: "/api/applicants/profile-maya-chen/notes", expect: (body) => Array.isArray(body?.items) },
  { name: "jewelcert invites", path: `/api/stores/${STORE_ID}/jewelcert-invites`, expect: (body) => Array.isArray(body?.items) },
  { name: "gemmatch invites", path: `/api/stores/${STORE_ID}/gemmatch-invites`, expect: (body) => Array.isArray(body?.items) },
  { name: "store interviews", path: `/api/stores/${STORE_ID}/interviews?status=scheduled`, expect: (body) => Array.isArray(body?.items) },
  { name: "applicant interviews", path: `/api/applicant/interviews?email=${encodeURIComponent(MAYA_EMAIL)}`, expect: (body) => Array.isArray(body?.items) },
  { name: "hire preview", path: "/api/applications/app-maya-chen/hire-preview?role=Sales%20Associate", expect: (body) => body?.applicationId === "app-maya-chen" || body?.application?.id === "app-maya-chen" || body?.candidate },
  { name: "hire sync", path: "/api/applications/app-jess-wood/hire-sync", expect: (body) => body?.sync?.applicationId === "app-jess-wood" || body?.applicationId === "app-jess-wood" },
  { name: "applicant home", path: `/api/applicant/home?email=${encodeURIComponent(MAYA_EMAIL)}`, expect: (body) => body?.applicant?.email === MAYA_EMAIL && body?.counts },
  { name: "applicant profile", path: `/api/applicant/profile?email=${encodeURIComponent(MAYA_EMAIL)}`, expect: (body) => body?.profile?.email === MAYA_EMAIL },
  { name: "notification prefs", path: `/api/applicant/notification-prefs?email=${encodeURIComponent(MAYA_EMAIL)}`, expect: (body) => typeof body?.prefs?.invites === "boolean" && typeof body?.prefs?.marketing === "boolean" },
  { name: "applicant applications", path: `/api/applicant/applications?email=${encodeURIComponent(MAYA_EMAIL)}`, expect: (body) => Array.isArray(body?.items) && body.items.some((item) => item?.application?.id === "app-maya-chen") },
  { name: "applicant invites", path: `/api/applicant/invites?email=${encodeURIComponent(MAYA_EMAIL)}`, expect: (body) => Array.isArray(body?.items) && body.items.some((item) => item?.kind === "GemMatch" || item?.kind === "JewelCert") },
  { name: "applicant resume", path: `/api/applicant/resume?email=${encodeURIComponent(MAYA_EMAIL)}`, expect: (body) => body?.email === MAYA_EMAIL || body?.profile?.email === MAYA_EMAIL },
  { name: "resume templates", path: "/api/resume-templates", expect: (body) => Array.isArray(body?.items) && body.items.some((item) => item.id === "classic") },
  { name: "applicant training", path: `/api/applicant/training?email=${encodeURIComponent(MAYA_EMAIL)}`, expect: (body) => Array.isArray(body?.items) || Array.isArray(body?.assignments) },
  { name: "applicant credentials", path: `/api/applicant/credentials?email=${encodeURIComponent(MAYA_EMAIL)}`, expect: (body) => Array.isArray(body?.items) },
  { name: "course catalog", path: "/api/courses", expect: (body) => Array.isArray(body?.items) && body.items.some((item) => item.slug === "four-cs") },
  { name: "course detail", path: "/api/courses/four-cs", expect: (body) => body?.course?.slug === "four-cs" && body?.assignmentSummary },
  { name: "course tests", path: "/api/course-completion-tests", expect: (body) => Array.isArray(body?.items) },
  { name: "course final check", path: "/api/courses/four-cs/completion-test", expect: (body) => body?.courseSlug === "four-cs" },
  { name: "store jobs", path: `/api/stores/${STORE_ID}/jobs`, expect: (body) => Array.isArray(body?.items) },
  { name: "job detail", path: `/api/jobs/${JOB_ID}`, expect: (body) => body?.job?.id === JOB_ID && Array.isArray(body?.applicants) },
  { name: "job applicants", path: `/api/jobs/${JOB_ID}/applicants`, expect: (body) => body?.jobId === JOB_ID && Array.isArray(body?.items) },
  { name: "role templates", path: "/api/role-templates", expect: (body) => Array.isArray(body?.items) && body.items.some((item) => item.role === "sales-associate") },
  { name: "store dashboard", path: `/api/stores/${STORE_ID}/dashboard`, expect: (body) => body?.metrics || body?.summary || body?.floor },
  { name: "store settings", path: `/api/stores/${STORE_ID}/settings`, expect: (body) => body?.organization || body?.settings?.organization },
  { name: "store profile", path: `/api/stores/${STORE_ID}`, expect: (body) => body?.store?.id === STORE_ID && body?.settings?.organization },
  { name: "store theme", path: `/api/stores/${STORE_ID}/theme`, expect: (body) => body?.theme?.primary && Array.isArray(body?.fonts) },
  { name: "store users", path: `/api/stores/${STORE_ID}/users`, expect: (body) => Array.isArray(body?.items) },
  { name: "store team", path: `/api/stores/${STORE_ID}/team`, expect: (body) => Array.isArray(body?.items) || Array.isArray(body?.members) },
  { name: "public-page settings", path: `/api/stores/${STORE_ID}/public-page`, expect: (body) => body?.config || body?.store },
  { name: "admin overview", path: "/api/admin/overview", expect: (body) => body?.metrics },
  { name: "admin companies", path: "/api/admin/companies", expect: (body) => Array.isArray(body?.items) },
  { name: "admin company detail", path: `/api/admin/companies/${ADMIN_COMPANY_ID}`, expect: (body) => body?.company?.id === ADMIN_COMPANY_ID || body?.company?.name },
  { name: "admin billing", path: "/api/admin/billing", expect: (body) => Array.isArray(body?.plans) },
  { name: "admin analytics", path: "/api/admin/analytics", expect: (body) => body?.metrics },
  { name: "admin support", path: "/api/admin/support?q=sissy", expect: (body) => Array.isArray(body?.companies) },
];

const postgresReadChecks = [
  { name: "harbor public store", path: "/api/public/stores/harbor-gold-careers", expect: (body) => (body?.store || body?.page) && Array.isArray(body?.jobs) },
  { name: "harbor public job", path: "/api/public/stores/harbor-gold-careers/jobs/job-harbor-sales-manager", expect: (body) => body?.job?.id === "job-harbor-sales-manager" },
  {
    name: "sissys same-email privacy",
    path: `/api/stores/${STORE_ID}/applications?q=maya`,
    headers: SISSYS_SESSION,
    expect: (body) =>
      Array.isArray(body?.items) &&
      body.items.some((item) => item.id === "app-maya-chen") &&
      body.items.every((item) => item.id !== "app-maya-harbor"),
  },
  {
    name: "harbor session",
    path: "/api/me",
    headers: HARBOR_SESSION,
    expect: (body) => body?.activeStoreId === "store-harbor-memphis" && body?.storeIds?.includes("store-harbor-memphis"),
  },
  {
    name: "harbor pipeline privacy",
    path: "/api/stores/store-harbor-memphis/applications?q=maya",
    headers: HARBOR_SESSION,
    expect: (body) =>
      Array.isArray(body?.items) &&
      body.items.some((item) => item.id === "app-maya-harbor") &&
      body.items.every((item) => item.id !== "app-maya-chen"),
  },
  {
    name: "harbor blocks sissys scope",
    path: `/api/stores/${STORE_ID}/applications?q=maya`,
    headers: HARBOR_SESSION,
    expectStatus: 403,
    expect: (body) => body?.error?.code === "forbidden",
  },
  {
    name: "admin harbor company",
    path: "/api/admin/companies/co-harbor",
    expect: (body) => body?.company?.id === "co-harbor" && body.company.stores?.some((store) => store.id === "store-harbor-memphis"),
  },
  {
    name: "admin company search harbor",
    path: "/api/admin/companies?q=harbor",
    expect: (body) => Array.isArray(body?.items) && body.items.some((company) => company.id === "co-harbor"),
  },
];

function usage() {
  console.log(`Usage:
  npm run smoke:phase1
  npm run smoke:phase1:postgres
  node scripts/smoke-phase1-api.mjs --base=http://localhost:3001 --mode=local
  JEWELHIRE_MUTATION_SMOKE=1 node scripts/smoke-phase1-api.mjs --mutations

Options:
  --base=<url>       Base URL to smoke. Default: http://localhost:3001
  --mode=<local|postgres>
  --mutations        Run opt-in write checks. This creates staging smoke data.

Notes:
  Read checks are safe. Mutation checks are intended for disposable local/staging data only.`);
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await readJson(response);
  return { response, body };
}

async function checkRead({ name, path, headers, expectStatus, expect }) {
  const effectiveHeaders =
    headers ||
    (mode === "postgres" && path.startsWith("/api/admin/")
      ? ADMIN_SESSION
      : undefined);
  const { response, body } = await request(path, { headers: effectiveHeaders });
  const expectedStatus = expectStatus || 200;
  if (response.status !== expectedStatus) {
    throw new Error(`${name}: ${path} returned ${response.status} ${JSON.stringify(body).slice(0, 300)}`);
  }
  if (!expect(body)) {
    throw new Error(`${name}: ${path} returned unexpected shape ${JSON.stringify(body).slice(0, 500)}`);
  }
  console.log(`ok read      ${name.padEnd(24)} ${response.status} ${path}`);
}

async function checkMutation(name, path, init, expect) {
  const { response, body } = await request(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`${name}: ${path} returned ${response.status} ${JSON.stringify(body).slice(0, 300)}`);
  }
  if (!expect(body)) {
    throw new Error(`${name}: ${path} returned unexpected shape ${JSON.stringify(body).slice(0, 500)}`);
  }
  console.log(`ok mutation  ${name.padEnd(24)} ${response.status} ${path}`);
  return body;
}

async function cleanupPostgresSmokeRecords({ suffix, createdJobId }) {
  if (mode !== "postgres") return;
  loadEnvFile(".env.local");
  const url = databaseUrl();
  if (!url) {
    console.log("skip cleanup  Postgres smoke cleanup skipped because DATABASE_URL is not configured.");
    return;
  }

  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    max: 1,
    ssl: { rejectUnauthorized: true },
  });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const emails = [`smoke-applicant-${suffix}@example.com`, `walkin-${suffix}@example.com`];
    const profileResult = await client.query(
      `
        select id
        from applicant_profiles
        where email_normalized = any($1::text[])
          and (
            full_name = $2
            or full_name = $3
          )
      `,
      [emails, `Smoke Applicant ${suffix}`, `Smoke Walk-in ${suffix}`],
    );
    const profileIds = profileResult.rows.map((row) => row.id);
    const applicationResult = profileIds.length
      ? await client.query("select id from applications where applicant_profile_id = any($1::text[])", [profileIds])
      : { rows: [] };
    const applicationIds = applicationResult.rows.map((row) => row.id);

    const courseAssignments = profileIds.length
      ? await client.query("delete from course_assignments where recipient_type = 'applicant' and recipient_id = any($1::text[])", [profileIds])
      : { rowCount: 0 };
    const domainEvents = applicationIds.length
      ? await client.query("delete from domain_events where subject_id = any($1::text[]) or payload::text like $2", [applicationIds, `%${suffix}%`])
      : await client.query("delete from domain_events where payload::text like $1", [`%${suffix}%`]);
    const profiles = profileIds.length
      ? await client.query("delete from applicant_profiles where id = any($1::text[])", [profileIds])
      : { rowCount: 0 };
    const jobs = createdJobId
      ? await client.query("delete from public_jobs where id = $1 and title = $2", [createdJobId, `Smoke Jewelry Consultant ${suffix}`])
      : { rowCount: 0 };
    const adminAudit = await client.query(
      `
        delete from admin_audit_entries
        where target_label like $1
          or target_label like $2
          or metadata::text like $3
      `,
      [`%Smoke Jewelers ${suffix}%`, `%supervisor-${suffix}@example.com%`, `%co-smoke-jewelers-${suffix}%`],
    );

    await client.query("commit");
    console.log(
      `ok cleanup   smoke records            profiles=${profiles.rowCount || 0} applications=${applicationIds.length} courseAssignments=${courseAssignments.rowCount || 0} jobs=${jobs.rowCount || 0} domainEvents=${domainEvents.rowCount || 0} adminAudit=${adminAudit.rowCount || 0}`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function runMutationChecks() {
  const suffix = Date.now().toString(36);
  const applicantEmail = `smoke-applicant-${suffix}@example.com`;
  const originalRoleTemplate = (await request("/api/role-templates/sales-associate")).body?.template;
  const originalStoreProfile = (await request(`/api/stores/${STORE_ID}`)).body;
  const originalTheme = (await request(`/api/stores/${STORE_ID}/theme`)).body?.theme;
  const createdJob = await checkMutation(
    "store job create",
    `/api/stores/${STORE_ID}/jobs`,
    {
      method: "POST",
      body: JSON.stringify({
        title: `Smoke Jewelry Consultant ${suffix}`,
        location: "Little Rock, AR",
        employmentType: "Part-time",
        compensationSummary: "$24 - $32 / hour",
        description: "Generated by guarded staging smoke to verify store job creation.",
        requirements: ["Clienteling experience", "Weekend availability"],
        idealGemMatchMix: ["C", "D"],
        requiredAssessmentIds: ["sales-personality"],
        requiredCourseIds: ["four-cs"],
        status: "draft",
      }),
    },
    (body) => body?.item?.job?.title === `Smoke Jewelry Consultant ${suffix}` && body?.item?.job?.status === "draft",
  );
  const createdJobId = createdJob.item.job.id;
  await checkMutation(
    "job update",
    `/api/jobs/${createdJobId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        compensationSummary: "$25 - $35 / hour",
        description: "Updated by guarded staging smoke to verify job edit.",
        status: "paused",
      }),
    },
    (body) => body?.job?.id === createdJobId && body.job.status === "paused" && body.job.compensationSummary === "$25 - $35 / hour",
  );
  await checkMutation(
    "job open",
    `/api/jobs/${createdJobId}/open`,
    { method: "POST" },
    (body) => body?.job?.id === createdJobId && body.job.status === "open" && body.job.openedAt,
  );
  await checkMutation(
    "job pause",
    `/api/jobs/${createdJobId}/pause`,
    { method: "POST" },
    (body) => body?.job?.id === createdJobId && body.job.status === "paused",
  );
  await checkMutation(
    "job close",
    `/api/jobs/${createdJobId}/close`,
    { method: "POST" },
    (body) => body?.job?.id === createdJobId && body.job.status === "closed" && body.job.closedAt,
  );
  await checkMutation(
    "role template",
    "/api/role-templates/sales-associate",
    {
      method: "PATCH",
      body: JSON.stringify({
        openings: 3,
        priority: `Smoke priority ${suffix}`,
        idealMix: { V: 20, C: 40, F: 25, D: 15 },
      }),
    },
    (body) => body?.template?.role === "sales-associate" && body.template.openings === 3,
  );
  if (originalRoleTemplate) {
    await checkMutation(
      "role template restore",
      "/api/role-templates/sales-associate",
      {
        method: "PATCH",
        body: JSON.stringify({
          title: originalRoleTemplate.title,
          location: originalRoleTemplate.location,
          status: originalRoleTemplate.status,
          openings: originalRoleTemplate.openings,
          pipeline: originalRoleTemplate.pipeline,
          idealMix: originalRoleTemplate.idealMix,
          priority: originalRoleTemplate.priority,
          assessments: originalRoleTemplate.assessments,
          courses: originalRoleTemplate.courses,
          notes: originalRoleTemplate.notes,
        }),
      },
      (body) => body?.template?.role === "sales-associate" && body.template.priority === originalRoleTemplate.priority,
    );
  }
  const applied = await checkMutation(
    "public apply",
    `/api/public/stores/${STORE_SLUG}/applications`,
    {
      method: "POST",
      body: JSON.stringify({
        jobId: JOB_ID,
        profile: {
          name: `Smoke Applicant ${suffix}`,
          email: applicantEmail,
          phone: "555-0100",
          location: "Little Rock, AR",
          headline: "Sales associate candidate",
          summary: "Generated by guarded staging smoke to verify the Phase 1 apply loop.",
          experience: ["Two years of luxury retail clienteling"],
          education: ["GIA fundamentals coursework"],
          skills: ["Clienteling", "POS", "Repair intake"],
        },
      }),
    },
    (body) => body?.application?.id && body?.profile?.id && body?.profile?.email === applicantEmail,
  );
  const applicationId = applied.application.id;
  const applicantProfileId = applied.profile.id;
  await checkMutation(
    "applicant note",
    `/api/applicants/${applicantProfileId}/notes`,
    {
      method: "POST",
      body: JSON.stringify({
        text: "Smoke note: strong clienteling background, verify references.",
        noteType: "screening",
      }),
    },
    (body) => body?.note?.applicationId === applicationId || body?.note?.body,
  );
  await checkMutation(
    "pipeline stage",
    `/api/applications/${applicationId}/stage`,
    {
      method: "POST",
      body: JSON.stringify({
        toStage: "jewelcert",
        reason: "Smoke moved to JewelCert",
      }),
    },
    (body) => body?.application?.id === applicationId && body.application.stage === "jewelcert",
  );
  const jewelcert = await checkMutation(
    "jewelcert invite",
    `/api/stores/${STORE_ID}/jewelcert-invites`,
    {
      method: "POST",
      body: JSON.stringify({
        applicationId,
        componentIds: ["gemmatch", "jewelry-basic-knowledge"],
        courseSlugs: ["four-cs"],
      }),
    },
    (body) => body?.invite?.applicationId === applicationId && body.invite.status === "sent",
  );
  await checkMutation(
    "gemmatch complete",
    "/api/gemmatch/responses",
    {
      method: "POST",
      body: JSON.stringify({
        inviteId: jewelcert.invite.id,
        pickedAdjectiveIds: ["strategic", "analytical", "friendly", "warm", "dependable", "careful", "driven", "closer"],
      }),
    },
    (body) => body?.invite?.applicationId === applicationId && body?.invite?.status === "completed" && body?.result?.primary,
  );
  const interview = await checkMutation(
    "schedule interview",
    `/api/applications/${applicationId}/interviews`,
    {
      method: "POST",
      body: JSON.stringify({
        startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 45,
        type: "phone",
        location: "Phone screen",
        interviewer: "Smoke Manager",
        notes: "Smoke interview scheduling check.",
      }),
    },
    (body) => body?.interview?.id && body.interview.applicationId === applicationId,
  );
  const manualInterview = await checkMutation(
    "new candidate interview",
    `/api/stores/${STORE_ID}/interviews/new-candidate`,
    {
      method: "POST",
      body: JSON.stringify({
        name: `Smoke Walk-in ${suffix}`,
        email: `walkin-${suffix}@example.com`,
        phone: "555-0177",
        role: "Sales Associate",
        jobId: JOB_ID,
        startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 30,
        type: "in_store",
        interviewLocation: "Little Rock showroom",
        interviewer: "Smoke Manager",
        notes: "Smoke new-candidate interview scheduling check.",
      }),
    },
    (body) => body?.interview?.id && body?.application?.id && body?.profile?.email === `walkin-${suffix}@example.com`,
  );
  await checkMutation(
    "delete interview",
    `/api/interviews/${manualInterview.interview.id}`,
    { method: "DELETE" },
    (body) => body?.interview?.id === manualInterview.interview.id && body.interview.status === "cancelled" && body.deleted === false,
  );
  await checkMutation(
    "interview rsvp",
    `/api/interviews/${interview.interview.id}/rsvp`,
    { method: "POST", body: JSON.stringify({ response: "accepted" }) },
    (body) => body?.interview?.id === interview.interview.id,
  );
  await checkMutation(
    "applicant resume save",
    "/api/applicant/resume",
    {
      method: "PUT",
      body: JSON.stringify({
        lookupEmail: applicantEmail,
        email: applicantEmail,
        fullName: `Smoke Applicant ${suffix}`,
        headline: "Smoke-updated sales associate candidate",
        location: "Little Rock, AR",
        summary: "Updated by mutation smoke after public apply.",
        workExperience: ["Luxury retail clienteling", "Jewelry repair intake"],
        education: ["GIA fundamentals coursework"],
        skills: ["Clienteling", "Diamonds", "CRM"],
        portfolioLinks: ["https://example.com/smoke-portfolio"],
        templateId: "classic",
      }),
    },
    (body) => body?.profile?.email === applicantEmail && body?.resume?.summary?.includes("Updated"),
  );
  await checkMutation(
    "applicant profile save",
    "/api/applicant/profile",
    {
      method: "PATCH",
      body: JSON.stringify({
        lookupEmail: applicantEmail,
        email: applicantEmail,
        fullName: `Smoke Applicant ${suffix}`,
        phone: "555-0199",
        headline: "Smoke profile update",
        location: "Little Rock, AR",
      }),
    },
    (body) => body?.profile?.email === applicantEmail && body?.profile?.phone === "555-0199",
  );
  await checkMutation(
    "notification prefs",
    "/api/applicant/notification-prefs",
    {
      method: "PATCH",
      body: JSON.stringify({
        email: applicantEmail,
        invites: true,
        interviews: false,
        status: true,
        marketing: true,
      }),
    },
    (body) => body?.prefs?.interviews === false && body?.prefs?.marketing === true,
  );
  await checkMutation(
    "store profile",
    `/api/stores/${STORE_ID}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        organization: {
          defaultManager: "Smoke Manager",
        },
        publicPage: {
          headline: `Smoke hiring page ${suffix}`,
        },
      }),
    },
    (body) => body?.store?.defaultManager === "Smoke Manager" && body?.store?.publicPage?.headline === `Smoke hiring page ${suffix}`,
  );
  await checkMutation(
    "store theme",
    `/api/stores/${STORE_ID}/theme`,
    {
      method: "PATCH",
      body: JSON.stringify({
        theme: {
          primary: "#123FB9",
          accent: "#2F7DFF",
          bg: "#f7f9ff",
          text: "#08122B",
          fontId: "inter",
        },
      }),
    },
    (body) => body?.theme?.primary === "#123FB9" && body?.theme?.fontId === "inter",
  );
  if (originalStoreProfile?.settings || originalStoreProfile?.publicPage) {
    await checkMutation(
      "store profile restore",
      `/api/stores/${STORE_ID}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          organization: originalStoreProfile.settings?.organization,
          workflow: originalStoreProfile.settings?.workflow,
          notifications: originalStoreProfile.settings?.notifications,
          publicPage: {
            headline: originalStoreProfile.publicPage?.config?.headline || originalStoreProfile.store?.publicPage?.headline,
            about: originalStoreProfile.publicPage?.config?.about || originalStoreProfile.store?.publicPage?.about,
            logoText: originalStoreProfile.publicPage?.config?.logoText || originalStoreProfile.store?.publicPage?.logoText,
          },
        }),
      },
      (body) =>
        body?.settings?.organization?.defaultManager === originalStoreProfile.settings?.organization?.defaultManager &&
        body?.store?.publicPage?.headline === (originalStoreProfile.publicPage?.config?.headline || originalStoreProfile.store?.publicPage?.headline),
    );
  }
  if (originalTheme) {
    await checkMutation(
      "store theme restore",
      `/api/stores/${STORE_ID}/theme`,
      {
        method: "PATCH",
        body: JSON.stringify({ theme: originalTheme }),
      },
      (body) => body?.theme?.primary === originalTheme.primary && body?.theme?.fontId === originalTheme.fontId,
    );
  }
  await checkMutation(
    "resume template",
    "/api/applicant/resume/template",
    {
      method: "PUT",
      body: JSON.stringify({
        lookupEmail: applicantEmail,
        email: applicantEmail,
        templateId: "modern",
      }),
    },
    (body) => body?.templateId === "modern" && body?.profile?.email === applicantEmail,
  );
  await checkMutation(
    "resume export",
    "/api/applicant/resume/export",
    {
      method: "POST",
      body: JSON.stringify({
        email: applicantEmail,
        templateId: "modern",
      }),
    },
    (body) => body?.status === "ready" && body?.filename?.endsWith(".pdf"),
  );
  const assignment = await checkMutation(
    "training assign",
    "/api/course-assignments",
    {
      method: "POST",
      body: JSON.stringify({
        storeId: STORE_ID,
        courseSlug: "four-cs",
        recipientIds: [applicantProfileId],
        packageName: "Smoke onboarding package",
        source: "manager",
      }),
    },
    (body) => body?.count === 1 && body?.assignments?.[0]?.id,
  );
  await checkMutation(
    "training progress",
    `/api/course-assignments/${assignment.assignments[0].id}/progress`,
    { method: "POST", body: JSON.stringify({ progress: 100 }) },
    (body) => body?.assignment?.id === assignment.assignments[0].id && body.assignment.progress === 100,
  );
  await checkMutation(
    "applicant credentials",
    `/api/applicant/credentials?email=${encodeURIComponent(applicantEmail)}`,
    { method: "GET" },
    (body) => Array.isArray(body?.items) && body.items.some((item) => item.assignmentId === assignment.assignments[0].id),
  );
  await checkMutation(
    "hire applicant",
    `/api/applications/${applicationId}/hire`,
    {
      method: "POST",
      body: JSON.stringify({
        role: "Sales Associate",
      }),
    },
    (body) => body?.hireSync?.applicationId === applicationId,
  );

  const company = await checkMutation(
    "admin create company",
    "/api/admin/companies",
    {
      method: "POST",
      body: JSON.stringify({
        name: `Smoke Jewelers ${suffix}`,
        owner: "Smoke Owner",
        ownerEmail: `owner-${suffix}@example.com`,
        plan: "Growth",
      }),
    },
    (body) => body?.company?.id,
  );
  const companyId = company.company.id;
  await checkMutation(
    "admin update company",
    `/api/admin/companies/${companyId}`,
    { method: "PATCH", body: JSON.stringify({ plan: "Pro", status: "Active" }) },
    (body) => body?.company?.plan === "Pro",
  );
  const invite = await checkMutation(
    "admin invite user",
    `/api/admin/companies/${companyId}/users`,
    {
      method: "POST",
      body: JSON.stringify({
        name: "Smoke Supervisor",
        email: `supervisor-${suffix}@example.com`,
        role: "Supervisor",
      }),
    },
    (body) => body?.user?.id,
  );
  const userId = invite.user.id;
  await checkMutation(
    "admin update user",
    `/api/admin/users/${userId}`,
    { method: "PATCH", body: JSON.stringify({ status: "Active", role: "Supervisor" }) },
    (body) => body?.user?.status === "Active",
  );
  await checkMutation("admin resend invite", `/api/admin/users/${userId}/resend`, { method: "POST" }, (body) => body?.user?.id === userId);
  await checkMutation("admin remove user", `/api/admin/users/${userId}`, { method: "DELETE" }, (body) => body?.company?.id === companyId);
  await checkMutation(
    "admin impersonation",
    `/api/admin/companies/${companyId}/impersonation`,
    { method: "POST" },
    (body) => body?.session?.mode === "view_as",
  );
  await checkMutation(
    "admin delete company",
    `/api/admin/companies/${companyId}`,
    { method: "DELETE" },
    (body) => body?.company?.id === companyId && body?.deleted === true,
  );
  await cleanupPostgresSmokeRecords({ suffix, createdJobId });
}

async function main() {
  if (args.has("help") || args.has("h")) {
    usage();
    return;
  }
  if (!["local", "postgres"].includes(mode)) {
    usage();
    throw new Error(`Unknown smoke mode: ${mode}`);
  }

  console.log(`Phase 1 API smoke target: ${baseUrl} (${mode}${runMutations ? ", mutations enabled" : ", read-only"})`);
  for (const check of [...readChecks, ...(mode === "postgres" ? postgresReadChecks : [])]) {
    await checkRead(check);
  }
  if (runMutations) {
    await runMutationChecks();
  }
  console.log("Phase 1 API smoke passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
