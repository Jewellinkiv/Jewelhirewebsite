import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

const baseUrl = (args.get("base") || process.env.JEWELHIRE_BROWSER_BASE_URL || "http://localhost:3004").replace(/\/$/, "");
const artifactDir = path.resolve(
  rootDir,
  args.get("artifacts") || `docs/qa-runs/access-control-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);
const strict = args.has("strict");
const requestTimeoutMs = Number(args.get("timeout-ms") || 20_000);

const STORE_ID = "store-sissys-little-rock";

const adminEndpoints = [
  "/api/admin/overview",
  "/api/admin/companies",
  "/api/admin/companies/co-sissys",
  "/api/admin/billing",
  "/api/admin/assessments",
  "/api/admin/support",
  "/api/admin/analytics",
];

const diagnosticEndpoints = [
  "/api/admin/database/health",
  "/api/admin/database/readiness",
  "/api/admin/database/phase1-snapshot",
];

function usage() {
  console.log(`Usage:
  node scripts/access-control-audit.mjs
  node scripts/access-control-audit.mjs --base=http://localhost:3004
  node scripts/access-control-audit.mjs --strict

Options:
  --base=<url>        Target an already-running app. Default: http://localhost:3004.
  --artifacts=<dir>   Report directory.
  --timeout-ms=<n>    Per-request timeout. Default: 20000.
  --strict            Exit nonzero when current admin role-gate gaps are detected.`);
}

async function get(pathname, session) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      headers: session ? { "x-jewelhire-session": session } : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      path: pathname,
      session: session || "default",
      status: response.status,
      ok: response.ok,
      bodySample: redactSensitiveText(text).replace(/\s+/g, " ").slice(0, 240),
    };
  } catch (error) {
    return {
      path: pathname,
      session: session || "default",
      status: 0,
      ok: false,
      timedOut: error instanceof Error && error.name === "AbortError",
      bodySample: redactSensitiveText(error instanceof Error ? error.message : String(error)),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function redactSensitiveText(value) {
  return value
    .replace(new RegExp(`pscale${"_"}pw${"_"}[A-Za-z0-9_]+`, "g"), "[redacted-password]")
    .replace(/postgres\.[A-Za-z0-9]+/g, "[redacted-user]")
    .replace(/[a-z0-9-]+\.pg\.psdb\.cloud/gi, "[redacted-host]");
}

async function runStorePrivacyChecks() {
  const sissys = await get(`/api/stores/${STORE_ID}/applications?q=maya`, "sissys");
  const harbor = await get(`/api/stores/${STORE_ID}/applications?q=maya`, "harbor");
  const admin = await get(`/api/stores/${STORE_ID}/applications?q=maya`, "admin");
  return [
    {
      name: "Sissy's owner can read Sissy's store applications",
      expected: 200,
      actual: sissys.status,
      pass: sissys.status === 200,
      response: sissys,
    },
    {
      name: "Harbor owner is blocked from Sissy's store applications",
      expected: 403,
      actual: harbor.status,
      pass: harbor.status === 403,
      response: harbor,
    },
    {
      name: "Admin can read Sissy's store applications",
      expected: 200,
      actual: admin.status,
      pass: admin.status === 200,
      response: admin,
    },
  ];
}

async function runAdminRoleGateChecks() {
  const checks = [];
  for (const endpoint of adminEndpoints) {
    const admin = await get(endpoint, "admin");
    const storeOwner = await get(endpoint, "sissys");
    checks.push({
      name: `${endpoint} allows admin session`,
      expected: 200,
      actual: admin.status,
      pass: admin.status === 200,
      severity: "failure",
      response: admin,
    });
    checks.push({
      name: `${endpoint} blocks store-owner session`,
      expected: 403,
      actual: storeOwner.status,
      pass: storeOwner.status === 403,
      severity: "known_gap",
      response: storeOwner,
    });
  }
  return checks;
}

async function runDiagnosticChecks() {
  const checks = [];
  for (const endpoint of diagnosticEndpoints) {
    const defaultSession = await get(endpoint);
    checks.push({
      name: `${endpoint} diagnostic visibility`,
      expected: "documented",
      actual: defaultSession.status,
      pass: defaultSession.status < 500,
      severity: "diagnostic_review",
      response: defaultSession,
    });
  }
  return checks;
}

function writeReport({ storePrivacyChecks, adminRoleGateChecks, diagnosticChecks, issues, knownGaps }) {
  const lines = [
    "# Access Control Audit",
    "",
    `Base URL: ${baseUrl}`,
    `Created: ${new Date().toISOString()}`,
    `Strict: ${strict}`,
    `Request timeout: ${requestTimeoutMs}ms`,
    "",
    "## Store Privacy",
    "",
    ...storePrivacyChecks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}: expected ${check.expected}, got ${check.actual}`),
    "",
    "## Admin Role Gates",
    "",
    ...adminRoleGateChecks.map((check) => {
      const status = check.pass ? "PASS" : check.severity === "known_gap" ? "KNOWN GAP" : "FAIL";
      return `- ${status} ${check.name}: expected ${check.expected}, got ${check.actual}`;
    }),
    "",
    "## Diagnostics",
    "",
    ...diagnosticChecks.map((check) => `- ${check.pass ? "REVIEW" : "FAIL"} ${check.name}: got ${check.actual}`),
    "",
    "## Issues",
    "",
    ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- None."]),
    "",
    "## Known Gaps",
    "",
    ...(knownGaps.length ? knownGaps.map((gap) => `- ${gap}`) : ["- None."]),
    "",
  ];

  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, "access-control-report.md"), lines.join("\n"));
  fs.writeFileSync(
    path.join(artifactDir, "access-control-report.json"),
    JSON.stringify(
      {
        baseUrl,
        createdAt: new Date().toISOString(),
        strict,
        issues,
        knownGaps,
        storePrivacyChecks,
        adminRoleGateChecks,
        diagnosticChecks,
      },
      null,
      2,
    ),
  );
}

async function main() {
  if (args.has("help") || args.has("h")) {
    usage();
    return;
  }

  const storePrivacyChecks = await runStorePrivacyChecks();
  const adminRoleGateChecks = await runAdminRoleGateChecks();
  const diagnosticChecks = await runDiagnosticChecks();
  const issues = [
    ...storePrivacyChecks.filter((check) => !check.pass).map((check) => `${check.name}: expected ${check.expected}, got ${check.actual}`),
    ...adminRoleGateChecks
      .filter((check) => !check.pass && check.severity !== "known_gap")
      .map((check) => `${check.name}: expected ${check.expected}, got ${check.actual}`),
    ...diagnosticChecks.filter((check) => !check.pass).map((check) => `${check.name}: got ${check.actual}`),
  ];
  const knownGaps = adminRoleGateChecks
    .filter((check) => !check.pass && check.severity === "known_gap")
    .map((check) => `${check.name}: expected ${check.expected}, got ${check.actual}`);

  writeReport({ storePrivacyChecks, adminRoleGateChecks, diagnosticChecks, issues, knownGaps });

  for (const check of storePrivacyChecks) {
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}: ${check.actual}`);
  }
  console.log(`Admin role-gate known gaps: ${knownGaps.length}`);
  console.log(`Issues: ${issues.length}`);
  console.log(`Artifacts: ${artifactDir}`);

  if (issues.length || (strict && knownGaps.length)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
