import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;

const rootDir = process.cwd();
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

const mode = args.get("mode") || process.env.JEWELHIRE_BROWSER_SMOKE_MODE || "local";
const startServer = args.has("start-server");
const port = Number(args.get("port") || process.env.JEWELHIRE_BROWSER_SMOKE_PORT || 3003);
const baseUrl = (args.get("base") || process.env.JEWELHIRE_BROWSER_BASE_URL || `http://localhost:${port}`).replace(/\/$/, "");
const headed = args.has("headed");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const artifactDir = path.resolve(rootDir, args.get("artifacts") || `docs/qa-runs/${timestamp}`);
const STORE_ID = "store-sissys-little-rock";
const MAYA_EMAIL = "maya.chen@email.com";
const PUBLIC_STORE_SLUG = "sissys-log-cabin-careers";

const desktop = { width: 1440, height: 1000 };
const mobile = { width: 390, height: 844 };

const routeGroups = [
  {
    label: "store",
    routes: [
      "/",
      "/pipeline",
      "/applicants",
      "/applicants/maya-chen",
      "/jobs",
      "/jobs/sales-associate",
      "/interviews",
      "/send-jewelcert",
      "/cert-invitations",
      "/gemmatch",
      "/team",
      "/team-map",
      "/roster",
      "/learn",
      "/learn/four-cs",
      "/assessments",
      "/public-page",
      "/settings",
    ],
  },
  {
    label: "applicant",
    routes: [
      "/apply/luxury-sales-associate",
      "/portal",
      "/portal/applications",
      "/portal/invites",
      "/portal/interviews",
      "/portal/resume",
      "/portal/training",
      "/portal/profile",
    ],
  },
  {
    label: "admin",
    routes: [
      "/admin",
      "/admin/companies",
      "/admin/companies/co-sissys",
      "/admin/billing",
      "/admin/assessments",
      "/admin/support",
      "/admin/analytics",
    ],
  },
];

function usage() {
  console.log(`Usage:
  npm run qa:browser
  npm run qa:browser:postgres
  node scripts/browser-smoke-phase1.mjs --base=http://localhost:3000
  node scripts/browser-smoke-phase1.mjs --start-server --mode=postgres --port=3003

Options:
  --base=<url>        Target an already-running app.
  --start-server      Start a temporary Next dev server before browser QA.
  --mode=<local|postgres>
  --port=<number>     Port for --start-server. Default: 3003.
  --headed            Show the browser.
  --artifacts=<dir>   Screenshot/report directory. Default: docs/qa-runs/<timestamp>.`);
}

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

async function cleanupPostgresBrowserSmokeRecords() {
  if (mode !== "postgres") return;
  const url = databaseUrl();
  if (!url) {
    console.log("skip cleanup browser smoke cleanup skipped because DATABASE_URL is not configured");
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
    const profileResult = await client.query(
      `
        select id
        from applicant_profiles
        where (
            email_normalized like 'browser-applicant-%@example.com'
            or email_normalized like 'browser-walkin-%@example.com'
            or email_normalized like 'browser-workflow-%@example.com'
          )
          and (
            full_name like 'Browser Applicant %'
            or full_name like 'Browser Walk-in %'
            or full_name like 'Workflow Applicant %'
          )
      `,
    );
    const profileIds = profileResult.rows.map((row) => row.id);
    const applicationResult = profileIds.length
      ? await client.query("select id from applications where applicant_profile_id = any($1::text[])", [profileIds])
      : { rows: [] };
    const applicationIds = applicationResult.rows.map((row) => row.id);

    const teamMembers = applicationIds.length
      ? await client.query(
          `
            delete from team_members
            where source_application_id = any($1::text[])
              or name like 'Workflow Applicant %'
              or name like 'Browser Applicant %'
              or name like 'Browser Walk-in %'
          `,
          [applicationIds],
        )
      : await client.query(
          `
            delete from team_members
            where name like 'Workflow Applicant %'
              or name like 'Browser Applicant %'
              or name like 'Browser Walk-in %'
          `,
        );
    const courseAssignments = profileIds.length || applicationIds.length
      ? await client.query(
          `
            delete from course_assignments
            where (recipient_type = 'applicant' and recipient_id = any($1::text[]))
              or application_id = any($2::text[])
              or package_name like 'Browser %'
          `,
          [profileIds, applicationIds],
        )
      : await client.query("delete from course_assignments where package_name like 'Browser %'");
    const domainEvents = applicationIds.length
      ? await client.query(
          `
            delete from domain_events
            where subject_id = any($1::text[])
              or payload::text like '%browser-applicant-%'
              or payload::text like '%browser-walkin-%'
              or payload::text like '%browser-workflow-%'
              or payload::text like '%Browser Applicant %'
              or payload::text like '%Browser Walk-in %'
              or payload::text like '%Workflow Applicant %'
              or payload::text like '%Browser QA%'
          `,
          [applicationIds],
        )
      : await client.query(
          `
            delete from domain_events
            where payload::text like '%browser-applicant-%'
              or payload::text like '%browser-walkin-%'
              or payload::text like '%browser-workflow-%'
              or payload::text like '%Browser Applicant %'
              or payload::text like '%Browser Walk-in %'
              or payload::text like '%Workflow Applicant %'
              or payload::text like '%Browser QA%'
          `,
        );
    const profiles = profileIds.length
      ? await client.query("delete from applicant_profiles where id = any($1::text[])", [profileIds])
      : { rowCount: 0 };
    const users = await client.query(
      `
        delete from users
        where email_normalized like 'browser-store-user-%@example.com'
          or email_normalized like 'browser-admin-user-%@example.com'
      `,
    );
    const browserCompanies = await client.query(
      "select id from companies where name like 'Browser Jewelers %' and owner_name = 'Browser Owner'",
    );
    const companyIds = browserCompanies.rows.map((row) => row.id);
    const companyUsers = companyIds.length
      ? await client.query("delete from users where company_id = any($1::text[])", [companyIds])
      : { rowCount: 0 };
    const companies = companyIds.length
      ? await client.query("delete from companies where id = any($1::text[])", [companyIds])
      : { rowCount: 0 };
    const publicAssets = await client.query(
      "delete from public_page_assets where original_filename like 'browser-logo-%.png' or storage_url like '%browser-logo-%'",
    );
    const testimonials = await client.query("delete from public_page_testimonials where name like 'Browser QA Customer %'");
    const publicPageRestore = await client.query(
      `
        update store_public_pages
        set headline = 'Build a career in fine jewelry.',
            logo_text = 'Sissy''s Log Cabin',
            updated_at = now()
        where store_id = $1
          and (
            headline like 'Browser QA hiring page %'
            or logo_text like 'Browser QA%'
          )
      `,
      [STORE_ID],
    );
    const settingsRestore = await client.query(
      `
        update store_settings
        set default_manager = 'William Jones',
            updated_at = now()
        where store_id = $1
          and default_manager like 'Browser QA Manager %'
      `,
      [STORE_ID],
    );
    const adminAudit = await client.query(
      `
        delete from admin_audit_entries
        where target_label like '%Browser Jewelers%'
          or target_label like '%Browser QA%'
          or target_label like '%browser-admin-user-%@example.com%'
          or metadata::text like '%co-browser-jewelers-%'
      `,
    );

    await client.query("commit");
    console.log(
      `ok cleanup browser smoke records profiles=${profiles.rowCount || 0} applications=${applicationIds.length} teamMembers=${teamMembers.rowCount || 0} courseAssignments=${courseAssignments.rowCount || 0} users=${users.rowCount || 0} companyUsers=${companyUsers.rowCount || 0} companies=${companies.rowCount || 0} domainEvents=${domainEvents.rowCount || 0} assets=${publicAssets.rowCount || 0} testimonials=${testimonials.rowCount || 0} publicPages=${publicPageRestore.rowCount || 0} settings=${settingsRestore.rowCount || 0} adminAudit=${adminAudit.rowCount || 0}`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function startDevServer() {
  console.log(`Starting ${mode} browser QA server at ${baseUrl}`);
  const child = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    cwd: rootDir,
    env: {
      ...process.env,
      ...(mode === "postgres"
        ? { JEWELHIRE_STORAGE: "postgres", JEWELHIRE_ENABLE_SESSION_OVERRIDE: "1" }
        : { JEWELHIRE_STORAGE: "local" }),
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[next:${port}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[next:${port}] ${chunk}`));
  return child;
}

async function waitForServer() {
  for (let attempt = 1; attempt <= 90; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/me`);
      if (response.ok) return;
    } catch {
      // Keep waiting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function importPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(`Playwright is not installed. Run npm install first. ${error instanceof Error ? error.message : ""}`);
  }
}

async function launchBrowser(chromium) {
  try {
    return await chromium.launch({ headless: !headed });
  } catch (firstError) {
    try {
      return await chromium.launch({ channel: "chrome", headless: !headed });
    } catch {
      throw new Error(
        `Unable to launch a browser. Run npx playwright install chromium, or install Chrome. Original error: ${
          firstError instanceof Error ? firstError.message : firstError
        }`,
      );
    }
  }
}

function safeName(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "root";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fillField(page, label, value) {
  const accessible = page.getByLabel(label, { exact: true });
  if ((await accessible.count()) > 0) {
    try {
      await accessible.first().fill(value, { timeout: 1500 });
      return;
    } catch {
      // Fall back to the visual label groups used in the current prototype.
    }
  }

  const visualLabel = page.locator("label", { hasText: new RegExp(`^${escapeRegExp(label)}$`) }).first();
  const fieldGroup = visualLabel.locator("xpath=..");
  await fieldGroup.locator("input, textarea").first().fill(value);
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(artifactDir, `${name}.png`), fullPage: true });
}

function attachPageMonitors(page, failures) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    const isNextDevNoise =
      /Failed to fetch RSC payload/i.test(text) ||
      /Falling back to browser navigation/i.test(text) ||
      (/Failed to load resource: the server responded with a status of 404/i.test(text) &&
        message.location().url.endsWith("/favicon.ico"));
    if (!isNextDevNoise) failures.push(`console error on ${page.url()}: ${text}`);
  });
  page.on("pageerror", (error) => {
    failures.push(`page error on ${page.url()}: ${error.message}`);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (!url.startsWith(baseUrl)) return;
    if (response.status() >= 500) {
      failures.push(`server ${response.status()} on ${url}`);
    }
  });
}

async function expectPageHealthy(page, route) {
  const bodyText = await page.locator("body").innerText({ timeout: 15000 });
  if (!bodyText.trim()) throw new Error(`${route} rendered a blank body`);
  if (/Application error|Unhandled Runtime Error|Internal Server Error/i.test(bodyText)) {
    throw new Error(`${route} rendered an error page`);
  }
  if (/^\/applicants\/[^/]+/.test(route) && /Internal rating|candidate rating|candidate review/i.test(bodyText)) {
    throw new Error(`${route} exposed candidate rating/review language`);
  }
}

async function loadRoute(page, route, label, viewport) {
  await page.setViewportSize(viewport);
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 45000 });
  if (!response || response.status() >= 400) {
    throw new Error(`${route} returned ${response?.status() || "no response"}`);
  }
  await expectPageHealthy(page, route);
  await screenshot(page, `${label}-${safeName(route)}-${viewport.width}`);
}

async function routeSmoke(page) {
  for (const group of routeGroups) {
    for (const route of group.routes) {
      await loadRoute(page, route, group.label, desktop);
      await loadRoute(page, route, group.label, mobile);
      console.log(`ok route ${group.label.padEnd(9)} ${route}`);
    }
  }
}

async function publicApplyFlow(page) {
  const suffix = Date.now().toString(36);
  await page.setViewportSize(desktop);
  await page.goto(`${baseUrl}/apply/luxury-sales-associate`, { waitUntil: "networkidle" });
  await fillField(page, "Full name", `Browser Applicant ${suffix}`);
  await fillField(page, "Email", `browser-applicant-${suffix}@example.com`);
  await fillField(page, "Phone", "555-0160");
  await fillField(page, "Location", "Little Rock, AR");
  await fillField(page, "Resume headline", "Browser QA jewelry applicant");
  await page.getByRole("button", { name: /Continue/i }).click();
  await fillField(page, "Professional summary", "Browser smoke candidate for the public apply flow.");
  await fillField(page, "Skills", "Clienteling, bridal sales, CRM");
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.getByRole("button", { name: /Submit application/i }).click();
  await page.getByText("Application submitted!").waitFor({ timeout: 20000 });
  await screenshot(page, "flow-public-apply-submitted");
  console.log("ok flow public apply");
}

async function storeInterviewFlow(page) {
  const suffix = Date.now().toString(36);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.setViewportSize(desktop);
  await page.goto(`${baseUrl}/interviews`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Schedule interview/i }).click();
  await page.getByRole("button", { name: /New candidate/i }).click();
  await fillField(page, "Full name", `Browser Walk-in ${suffix}`);
  await fillField(page, "Email", `browser-walkin-${suffix}@example.com`);
  await fillField(page, "Date", tomorrow);
  await fillField(page, "Time", "13:30");
  await fillField(page, "Notes", "Browser smoke new-candidate interview.");
  await page.getByRole("button", { name: /Schedule & invite/i }).click();
  await page.getByText(/Interview scheduled/i).waitFor({ timeout: 25000 });
  await page.getByText(`Browser Walk-in ${suffix}`).waitFor({ timeout: 10000 });
  await screenshot(page, "flow-store-new-candidate-interview");
  console.log("ok flow store new-candidate interview");
}

async function adminCompanyFlow(page) {
  const suffix = Date.now().toString(36);
  await page.setViewportSize(desktop);
  await page.goto(`${baseUrl}/admin/companies`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /New company/i }).click();
  await fillField(page, "Company name", `Browser Jewelers ${suffix}`);
  await fillField(page, "Owner name", "Browser Owner");
  await page.getByRole("button", { name: /Create company/i }).click();
  await page.getByText(new RegExp(`Browser Jewelers ${suffix} created`, "i")).waitFor({ timeout: 20000 });
  await screenshot(page, "flow-admin-new-company");
  console.log("ok flow admin new company");
}

async function applicantPortalFlow(page) {
  await page.setViewportSize(desktop);
  await page.goto(`${baseUrl}/portal/resume`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Resume" }).waitFor();
  await fillField(page, "Headline", "Browser QA luxury sales candidate");
  await page.waitForTimeout(800);
  await screenshot(page, "flow-applicant-resume");
  await page.goto(`${baseUrl}/portal/training`, { waitUntil: "networkidle" });
  await expectPageHealthy(page, "/portal/training");
  await screenshot(page, "flow-applicant-training");
  console.log("ok flow applicant portal");
}

async function privacyApiChecks(request) {
  if (mode !== "postgres") {
    console.log("skip privacy API checks outside postgres mode");
    return;
  }
  const sissys = await request.get(`${baseUrl}/api/stores/${STORE_ID}/applications?q=maya`, {
    headers: { "x-jewelhire-session": "sissys" },
  });
  if (!sissys.ok()) throw new Error(`Sissy's pipeline returned ${sissys.status()}`);
  const sissysBody = await sissys.json();
  if (!sissysBody.items?.some((item) => item.id === "app-maya-chen")) {
    throw new Error("Sissy's session cannot see app-maya-chen");
  }
  if (sissysBody.items?.some((item) => item.id === "app-maya-harbor")) {
    throw new Error("Sissy's session leaked Harbor application");
  }

  const harborBlocked = await request.get(`${baseUrl}/api/stores/${STORE_ID}/applications?q=maya`, {
    headers: { "x-jewelhire-session": "harbor" },
  });
  if (harborBlocked.status() !== 403) {
    throw new Error(`Harbor session should be blocked from Sissy's store, got ${harborBlocked.status()}`);
  }
  console.log("ok privacy API checks");
}

async function expectOk(response, label) {
  if (!response.ok()) {
    const text = await response.text().catch(() => "");
    throw new Error(`${label} returned ${response.status()}${text ? `: ${text.slice(0, 240)}` : ""}`);
  }
  return response.json();
}

function storeHeaders() {
  return mode === "postgres" ? { "x-jewelhire-session": "sissys" } : {};
}

function adminHeaders() {
  return mode === "postgres" ? { "x-jewelhire-session": "admin" } : {};
}

function applicationSummaryId(item) {
  return item?.id || item?.application?.id;
}

async function createWorkflowApplication(request) {
  const suffix = Date.now().toString(36);
  const email = `browser-workflow-${suffix}@example.com`;
  const created = await expectOk(
    await request.post(`${baseUrl}/api/public/stores/${PUBLIC_STORE_SLUG}/applications`, {
      data: {
        jobId: "luxury-sales-associate",
        profile: {
          name: `Workflow Applicant ${suffix}`,
          email,
          phone: "555-0188",
          location: "Little Rock, AR",
          headline: "Workflow QA candidate",
          summary: "Generated by browser workflow QA.",
          skills: "clienteling, follow-up, bridal",
        },
      },
    }),
    "workflow public application",
  );
  if (!created.applicationId) throw new Error("Workflow public application did not return an application id");

  const search = await expectOk(
    await request.get(`${baseUrl}/api/stores/${STORE_ID}/applications?q=${encodeURIComponent(email)}`, {
      headers: storeHeaders(),
    }),
    "workflow application search",
  );
  if (!search.items?.some((item) => applicationSummaryId(item) === created.applicationId) && Number(search.count || 0) < 1) {
    throw new Error(`Created workflow application was not visible in store search for ${email}`);
  }
  return { applicationId: created.applicationId, email };
}

async function workflowApiChecks(request) {
  const suffix = Date.now().toString(36);
  const { applicationId } = await createWorkflowApplication(request);

  const filtered = await expectOk(
    await request.get(`${baseUrl}/api/stores/${STORE_ID}/applications?q=workflow&stage=applied`, {
      headers: storeHeaders(),
    }),
    "pipeline filtered search",
  );
  if (!filtered.items?.some((item) => applicationSummaryId(item) === applicationId)) {
    throw new Error("Pipeline filtered search did not include the workflow application");
  }

  const noteBody = `Browser workflow note ${Date.now().toString(36)}`;
  const createdNote = await expectOk(
    await request.post(`${baseUrl}/api/applicants/${applicationId}/notes`, {
      headers: storeHeaders(),
      data: { body: noteBody, noteType: "screening" },
    }),
    "applicant note create",
  );
  if (!createdNote.note?.id) throw new Error("Applicant note create did not return a note id");
  const listedNotes = await expectOk(
    await request.get(`${baseUrl}/api/applicants/${applicationId}/notes`, { headers: storeHeaders() }),
    "applicant notes list",
  );
  if (!listedNotes.items?.some((note) => note.id === createdNote.note.id)) {
    throw new Error("Applicant notes list did not include the created note");
  }
  await expectOk(
    await request.delete(`${baseUrl}/api/notes/${createdNote.note.id}`, { headers: storeHeaders() }),
    "applicant note delete",
  );

  const jewelcert = await expectOk(
    await request.post(`${baseUrl}/api/stores/${STORE_ID}/jewelcert-invites`, {
      headers: storeHeaders(),
      data: {
        applicationId,
        componentIds: ["gemmatch", "sales-personality"],
        courseSlugs: ["four-cs"],
      },
    }),
    "JewelCert invite create",
  );
  if (!jewelcert.invite?.id) throw new Error("JewelCert invite create did not return an invite id");

  const stage = await expectOk(
    await request.post(`${baseUrl}/api/applications/${applicationId}/stage`, {
      headers: storeHeaders(),
      data: { toStage: "interview", reason: "Browser workflow QA stage movement" },
    }),
    "application stage update",
  );
  if (stage.application?.stage !== "interview") throw new Error("Application stage update did not move to interview");

  await expectOk(
    await request.post(`${baseUrl}/api/interviews/interview-maya-first/rsvp`, {
      data: { response: "accepted" },
    }),
    "interview RSVP",
  );

  const hirePreview = await expectOk(
    await request.get(`${baseUrl}/api/applications/${applicationId}/hire-preview?role=Sales%20Associate`, {
      headers: storeHeaders(),
    }),
    "hire preview",
  );
  if (!hirePreview.candidate && !hirePreview.application) throw new Error("Hire preview payload was empty");

  const hire = await expectOk(
    await request.post(`${baseUrl}/api/applications/${applicationId}/hire`, {
      headers: storeHeaders(),
      data: { role: "Sales Associate" },
    }),
    "hire confirm",
  );
  if (!hire.hireSync?.id) throw new Error("Hire confirm did not return a hire sync id");
  await expectOk(
    await request.get(`${baseUrl}/api/applications/${applicationId}/hire-sync`, { headers: storeHeaders() }),
    "hire sync detail",
  );

  const reviews = await expectOk(
    await request.get(`${baseUrl}/api/stores/${STORE_ID}/public-page/reviews?includeHidden=true`, {
      headers: storeHeaders(),
    }),
    "public-page reviews list",
  );
  const review = reviews.items?.[0];
  if (review?.id) {
    const nextStatus = review.status === "hidden" ? "published" : "hidden";
    const patched = await expectOk(
      await request.patch(`${baseUrl}/api/stores/${STORE_ID}/public-page/reviews/${review.id}`, {
        headers: storeHeaders(),
        data: { status: nextStatus },
      }),
      "public-page review update",
    );
    if (patched.review?.status !== nextStatus) throw new Error("Public-page review status did not update");
    await expectOk(
      await request.patch(`${baseUrl}/api/stores/${STORE_ID}/public-page/reviews/${review.id}`, {
        headers: storeHeaders(),
        data: { status: review.status },
      }),
      "public-page review restore",
    );
  }

  await expectOk(
    await request.post(`${baseUrl}/api/admin/companies/co-sissys/impersonation`, {
      headers: adminHeaders(),
    }),
    "admin impersonation",
  );

  const courseTest = await expectOk(
    await request.get(`${baseUrl}/api/courses/four-cs/completion-test`),
    "course completion test read",
  );
  const courseQuestions = courseTest.test?.questions || courseTest.questions || [];
  const courseAnswers = courseQuestions.map((question) => ({ questionId: question.id, answerIndex: 0 }));
  if (!courseAnswers.length) throw new Error("Course completion test did not expose learner questions");
  const courseAttempt = await expectOk(
    await request.post(`${baseUrl}/api/courses/four-cs/completion-test/attempts`, {
      data: {
        recipientId: `browser-workflow-${suffix}@example.com`,
        answers: courseAnswers,
      },
    }),
    "course completion test attempt",
  );
  if (courseAttempt.attempt?.courseSlug !== "four-cs") throw new Error("Course completion attempt did not return the expected course slug");

  const assessment = await expectOk(
    await request.post(`${baseUrl}/api/stores/${STORE_ID}/assessments`, {
      headers: storeHeaders(),
      data: {
        title: `Browser QA assessment ${suffix}`,
        description: "Generated by browser workflow QA.",
        kind: "Knowledge check",
        status: "Draft",
        questions: [
          {
            id: `browser-q-${suffix}`,
            type: "multiple-choice",
            prompt: "Which channel should Phase 1 candidates belong to?",
            options: ["A private store pipeline", "A cross-company marketplace"],
            answerIndex: 0,
          },
        ],
      },
    }),
    "custom assessment create",
  );
  if (!assessment.assessment?.id) throw new Error("Custom assessment create did not return an id");
  const publishedAssessment = await expectOk(
    await request.post(`${baseUrl}/api/stores/${STORE_ID}/assessments/${assessment.assessment.id}/publish`, {
      headers: storeHeaders(),
    }),
    "custom assessment publish",
  );
  if (publishedAssessment.assessment?.status !== "Published") throw new Error("Custom assessment did not publish");
  const draftAssessment = await expectOk(
    await request.post(`${baseUrl}/api/stores/${STORE_ID}/assessments/${assessment.assessment.id}/unpublish`, {
      headers: storeHeaders(),
    }),
    "custom assessment unpublish",
  );
  if (draftAssessment.assessment?.status !== "Draft") throw new Error("Custom assessment did not unpublish");
  await expectOk(
    await request.delete(`${baseUrl}/api/stores/${STORE_ID}/assessments/${assessment.assessment.id}`, {
      headers: storeHeaders(),
    }),
    "custom assessment cleanup",
  );

  const page = await expectOk(
    await request.get(`${baseUrl}/api/stores/${STORE_ID}/public-page`, { headers: storeHeaders() }),
    "public-page read",
  );
  const originalPublicStatus = page.config?.status || "draft";
  const savedPage = await expectOk(
    await request.put(`${baseUrl}/api/stores/${STORE_ID}/public-page`, {
      headers: storeHeaders(),
      data: {
        config: {
          ...page.config,
          headline: `Browser QA hiring page ${suffix}`,
        },
      },
    }),
    "public-page save",
  );
  if (savedPage.config?.headline !== `Browser QA hiring page ${suffix}`) throw new Error("Public-page save did not persist headline");
  await expectOk(
    await request.post(`${baseUrl}/api/stores/${STORE_ID}/public-page/preview`, { headers: storeHeaders() }),
    "public-page preview create",
  );
  const logo = await expectOk(
    await request.post(`${baseUrl}/api/stores/${STORE_ID}/public-page/logo`, {
      headers: storeHeaders(),
      data: {
        filename: `browser-logo-${suffix}.png`,
        mimeType: "image/png",
        size: 128,
        url: `https://example.com/browser-logo-${suffix}.png`,
        altText: "Browser QA logo",
      },
    }),
    "public-page logo save",
  );
  if (!logo.asset?.id) throw new Error("Public-page logo save did not return an asset");
  const testimonial = await expectOk(
    await request.post(`${baseUrl}/api/stores/${STORE_ID}/public-page/testimonials`, {
      headers: storeHeaders(),
      data: {
        name: `Browser QA Customer ${suffix}`,
        rating: 5,
        text: "A generated testimonial for workflow QA.",
      },
    }),
    "public-page testimonial create",
  );
  if (!testimonial.testimonial?.id) throw new Error("Public-page testimonial create did not return an id");
  const hiddenTestimonial = await expectOk(
    await request.patch(`${baseUrl}/api/stores/${STORE_ID}/public-page/testimonials/${testimonial.testimonial.id}`, {
      headers: storeHeaders(),
      data: { status: "hidden" },
    }),
    "public-page testimonial update",
  );
  if (hiddenTestimonial.testimonial?.status !== "hidden") throw new Error("Public-page testimonial did not update");
  await expectOk(
    await request.delete(`${baseUrl}/api/stores/${STORE_ID}/public-page/testimonials/${testimonial.testimonial.id}`, {
      headers: storeHeaders(),
    }),
    "public-page testimonial delete",
  );
  const publishedPage = await expectOk(
    await request.post(`${baseUrl}/api/stores/${STORE_ID}/public-page/publish`, {
      headers: storeHeaders(),
      data: { status: originalPublicStatus === "published" ? "paused" : "published" },
    }),
    "public-page publish toggle",
  );
  if (publishedPage.config?.status === originalPublicStatus) throw new Error("Public-page publish toggle did not change status");
  await expectOk(
    await request.post(`${baseUrl}/api/stores/${STORE_ID}/public-page/publish`, {
      headers: storeHeaders(),
      data: { status: originalPublicStatus },
    }),
    "public-page publish restore",
  );
  await expectOk(
    await request.put(`${baseUrl}/api/stores/${STORE_ID}/public-page`, {
      headers: storeHeaders(),
      data: { config: page.config },
    }),
    "public-page config restore",
  );

  const originalSettings = await expectOk(
    await request.get(`${baseUrl}/api/stores/${STORE_ID}/settings`, { headers: storeHeaders() }),
    "store settings read for restore",
  );
  const settings = await expectOk(
    await request.patch(`${baseUrl}/api/stores/${STORE_ID}/settings`, {
      headers: storeHeaders(),
      data: {
        organization: { defaultManager: `Browser QA Manager ${suffix}` },
      },
    }),
    "store settings update",
  );
  if (settings.settings?.organization?.defaultManager !== `Browser QA Manager ${suffix}`) {
    throw new Error("Store settings did not update default manager");
  }
  const storeUser = await expectOk(
    await request.post(`${baseUrl}/api/stores/${STORE_ID}/users`, {
      headers: storeHeaders(),
      data: {
        name: `Browser Store User ${suffix}`,
        email: `browser-store-user-${suffix}@example.com`,
        role: "Supervisor",
      },
    }),
    "store user invite",
  );
  if (!storeUser.user?.id) throw new Error("Store user invite did not return a user id");
  await expectOk(
    await request.delete(`${baseUrl}/api/users/${storeUser.user.id}`, { headers: storeHeaders() }),
    "store user cleanup",
  );
  const integrations = await expectOk(
    await request.get(`${baseUrl}/api/stores/${STORE_ID}/integrations`, { headers: storeHeaders() }),
    "store integrations list",
  );
  const originalProvider = integrations.items?.find((item) => item.status === "connected")?.provider;
  const integrationProvider = originalProvider === "microsoft" ? "google" : "microsoft";
  await expectOk(
    await request.post(`${baseUrl}/api/stores/${STORE_ID}/integrations/${integrationProvider}`, {
      headers: storeHeaders(),
    }),
    "store integration connect",
  );
  await expectOk(
    await request.delete(`${baseUrl}/api/stores/${STORE_ID}/integrations/${integrationProvider}`, {
      headers: storeHeaders(),
    }),
    "store integration disconnect",
  );
  if (originalProvider) {
    await expectOk(
      await request.post(`${baseUrl}/api/stores/${STORE_ID}/integrations/${originalProvider}`, {
        headers: storeHeaders(),
      }),
      "store integration restore",
    );
  }
  await expectOk(
    await request.patch(`${baseUrl}/api/stores/${STORE_ID}/settings`, {
      headers: storeHeaders(),
      data: {
        organization: originalSettings.settings?.organization,
        workflow: originalSettings.settings?.workflow,
        notifications: originalSettings.settings?.notifications,
      },
    }),
    "store settings restore",
  );

  const adminUser = await expectOk(
    await request.post(`${baseUrl}/api/admin/companies/co-sissys/users`, {
      headers: adminHeaders(),
      data: {
        name: `Browser Admin User ${suffix}`,
        email: `browser-admin-user-${suffix}@example.com`,
        role: "Supervisor",
      },
    }),
    "admin company user invite",
  );
  if (!adminUser.user?.id) throw new Error("Admin company user invite did not return a user id");
  await expectOk(
    await request.post(`${baseUrl}/api/admin/users/${adminUser.user.id}/resend`, { headers: adminHeaders() }),
    "admin user invite resend",
  );
  const patchedAdminUser = await expectOk(
    await request.patch(`${baseUrl}/api/admin/users/${adminUser.user.id}`, {
      headers: adminHeaders(),
      data: { status: "Active" },
    }),
    "admin user status update",
  );
  if (patchedAdminUser.user?.status !== "Active") throw new Error("Admin user status did not update");
  await expectOk(
    await request.delete(`${baseUrl}/api/admin/users/${adminUser.user.id}`, { headers: adminHeaders() }),
    "admin user remove",
  );
  console.log("ok workflow API checks");
}

async function writeReport(results) {
  const report = [
    "# JewelHire Browser QA Run",
    "",
    `Date: ${new Date().toISOString()}`,
    `Mode: ${mode}`,
    `Base URL: ${baseUrl}`,
    `Artifacts: ${artifactDir}`,
    "",
    "## Results",
    "",
    ...results.map((result) => `- ${result.ok ? "PASS" : "FAIL"} ${result.name}${result.error ? `: ${result.error}` : ""}`),
    "",
    "Screenshots are saved beside this report.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(artifactDir, "browser-smoke-report.md"), report);
}

async function runStep(results, name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

async function main() {
  if (args.has("help") || args.has("h")) {
    usage();
    return;
  }
  if (!["local", "postgres"].includes(mode)) throw new Error(`Unknown mode: ${mode}`);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`Invalid port: ${port}`);
  fs.mkdirSync(artifactDir, { recursive: true });
  loadEnvFile(".env.local");

  let server;
  if (startServer) {
    server = startDevServer();
    await waitForServer();
  } else {
    await waitForServer();
  }

  const { chromium } = await importPlaywright();
  const browser = await launchBrowser(chromium);
  const failures = [];
  const results = [];
  try {
    const context = await browser.newContext({ baseURL: baseUrl });
    const page = await context.newPage();
    attachPageMonitors(page, failures);

    await runStep(results, "route smoke", () => routeSmoke(page));
    await runStep(results, "public apply flow", () => publicApplyFlow(page));
    await runStep(results, "store new-candidate interview flow", () => storeInterviewFlow(page));
    await runStep(results, "applicant portal flow", () => applicantPortalFlow(page));
    await runStep(results, "admin company flow", () => adminCompanyFlow(page));
    await runStep(results, "workflow API checks", () => workflowApiChecks(context.request));
    await runStep(results, "privacy API checks", () => privacyApiChecks(context.request));

    if (failures.length) {
      throw new Error(`Browser smoke saw runtime errors:\n${failures.join("\n")}`);
    }
    console.log(`\nBrowser Phase 1 smoke passed. Artifacts: ${artifactDir}`);
  } finally {
    await writeReport(results);
    await browser.close().catch(() => undefined);
    await cleanupPostgresBrowserSmokeRecords().catch((error) => {
      console.error(`Browser smoke cleanup failed: ${error instanceof Error ? error.message : error}`);
    });
    if (server) server.kill("SIGTERM");
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
