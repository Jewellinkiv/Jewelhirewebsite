#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

const jewelHireRepo = process.cwd();
const jewelLinkRepo = path.resolve(args.get("jewellink-repo") || path.join(jewelHireRepo, "..", "JewelLink"));
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const artifacts = path.resolve(
  jewelHireRepo,
  args.get("artifacts") || `docs/qa-runs/cross-product-${timestamp}`,
);
const jewelLinkBase = args.get("jewellink-base")?.replace(/\/$/, "");
const jewelHireBase = args.get("jewelhire-base")?.replace(/\/$/, "");
const requireEndpointProbes = args.has("require-endpoint-probes");
const includeServerAudits = args.has("include-server-audits");

const suites = [
  { product: "JewelHire", name: "role and platform-admin isolation", script: "scripts/role-model-audit.mjs", cwd: jewelHireRepo },
  { product: "JewelHire", name: "JewelLink SSO and cancellation recovery", script: "scripts/jewellink-sso-audit.mjs", cwd: jewelHireRepo },
  { product: "JewelHire", name: "hire handoff", script: "scripts/jewellink-hire-audit.mjs", cwd: jewelHireRepo },
  { product: "JewelHire", name: "JewelCert handoff", script: "scripts/jewellink-jewelcert-audit.mjs", cwd: jewelHireRepo },
  {
    product: "JewelHire",
    name: "tenant and location access control",
    script: "scripts/access-control-audit.mjs",
    cwd: jewelHireRepo,
    requiresServer: true,
    args: jewelHireBase ? [`--base=${jewelHireBase}`] : [],
  },
  { product: "JewelHire", name: "public careers, privacy, analytics, and throttling", script: "scripts/public-careers-audit.mjs", cwd: jewelHireRepo },
  { product: "JewelHire", name: "legal consent", script: "scripts/legal-readiness-audit.mjs", cwd: jewelHireRepo },
  { product: "JewelLink", name: "JewelHire integration contract", script: "scripts/audit-jewelhire-sso.mjs", cwd: jewelLinkRepo },
];

const fixtures = {
  syntheticOnly: true,
  tenants: [
    {
      id: "fixture-company-alpha",
      locations: ["fixture-alpha-downtown", "fixture-alpha-mall"],
    },
    {
      id: "fixture-company-beta",
      locations: ["fixture-beta-main"],
    },
  ],
  personas: [
    { id: "fixture-director", jewelLinkRole: "DIRECTOR", expectedJewelHireRole: "store_owner", scope: "all company locations" },
    { id: "fixture-manager", jewelLinkRole: "MANAGER", expectedJewelHireRole: "manager", scope: "assigned locations only" },
    { id: "fixture-student", jewelLinkRole: "STUDENT", expectedJewelHireRole: "applicant", scope: "personal portal" },
    { id: "fixture-consultant", jewelLinkRole: "CONSULTANT", expectedJewelHireRole: null, scope: "no JewelHire access" },
    { id: "fixture-platform-admin", jewelLinkRole: "ADMIN", company: "fixture-company-alpha", jewelHireAllowlisted: true, expectedJewelHireRole: "admin", scope: "platform admin with no JewelHire tenant membership after MFA-backed JewelLink SSO" },
    { id: "fixture-platform-super-admin", jewelLinkRole: "SUPER_ADMIN", company: "fixture-company-alpha", jewelHireAllowlisted: true, expectedJewelHireRole: "admin", scope: "platform admin with no JewelHire tenant membership after MFA-backed JewelLink SSO" },
    { id: "fixture-allowlisted-director", jewelLinkRole: "DIRECTOR", company: "fixture-company-alpha", jewelHireAllowlisted: true, expectedJewelHireRole: null, scope: "denied because an allowlist entry cannot elevate a non-admin role" },
  ],
};

const environmentContract = {
  placeholdersOnly: true,
  sharedValues: [
    {
      purpose: "one-time SSO code exchange",
      jewelLink: "JEWELHIRE_SSO_SHARED_SECRET=<shared-high-entropy-value>",
      jewelHire: "JEWELLINK_SSO_SHARED_SECRET=<shared-high-entropy-value>",
    },
    {
      purpose: "hire and JewelCert server-to-server handoffs",
      jewelLink: "JEWELHIRE_INTEGRATION_SHARED_SECRET=<shared-high-entropy-value>",
      jewelHire: "JEWELLINK_INTEGRATION_SHARED_SECRET=<shared-high-entropy-value>",
    },
  ],
  endpoints: [
    "JewelLink: JEWELHIRE_URL=<JewelHire origin>",
    "JewelHire: JEWELLINK_URL=<JewelLink origin>",
  ],
  jewelHirePolicy: [
    "DIRECTOR=store_owner (fixed code policy)",
    "MANAGER=primary plus explicit JewelLink location grants (fixed code policy)",
    "EMAIL_NOTIFICATIONS_ENABLED=false",
  ],
};

function safeEnvironment() {
  const allowed = ["PATH", "HOME", "TMPDIR", "NODE_OPTIONS", "TERM", "CI"];
  const env = Object.fromEntries(allowed.filter((name) => process.env[name]).map((name) => [name, process.env[name]]));
  return {
    ...env,
    NODE_ENV: "test",
    JEWELHIRE_STORAGE: "local",
    JEWELHIRE_ENABLE_SESSION_OVERRIDE: "0",
    EMAIL_NOTIFICATIONS_ENABLED: "false",
  };
}

function gitSha(repo) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8", env: safeEnvironment() });
  return result.status === 0 ? result.stdout.trim() : null;
}

function hasEnvName(repo, name) {
  const source = fs.readFileSync(path.join(repo, ".env.example"), "utf8");
  return new RegExp(`^${name}=`, "m").test(source);
}

function contractChecks() {
  const jewelHireIntrospectionPath = path.join(jewelHireRepo, "lib/server/jewellink-session-introspection.ts");
  const jewelLinkIntrospectionPath = path.join(jewelLinkRepo, "src/app/api/integrations/jewelhire/sso/introspect/route.ts");
  const jewelHireIntrospection = fs.existsSync(jewelHireIntrospectionPath)
    ? fs.readFileSync(jewelHireIntrospectionPath, "utf8")
    : "";
  const jewelLinkIntrospection = fs.existsSync(jewelLinkIntrospectionPath)
    ? fs.readFileSync(jewelLinkIntrospectionPath, "utf8")
    : "";
  const checks = [
    ["JewelHire declares the JewelLink SSO secret", hasEnvName(jewelHireRepo, "JEWELLINK_SSO_SHARED_SECRET")],
    ["JewelLink declares the JewelHire SSO secret", hasEnvName(jewelLinkRepo, "JEWELHIRE_SSO_SHARED_SECRET")],
    ["JewelHire declares the integration handoff secret", hasEnvName(jewelHireRepo, "JEWELLINK_INTEGRATION_SHARED_SECRET")],
    ["JewelLink declares the integration handoff secret", hasEnvName(jewelLinkRepo, "JEWELHIRE_INTEGRATION_SHARED_SECRET")],
    ["JewelHire declares the JewelLink base URL", hasEnvName(jewelHireRepo, "JEWELLINK_URL")],
    ["JewelLink declares the JewelHire base URL", hasEnvName(jewelLinkRepo, "JEWELHIRE_URL")],
    ["JewelHire SSO migration is present", fs.existsSync(path.join(jewelHireRepo, "db/migrations/0014_jewellink_sso.sql"))],
    ["JewelHire JewelCert migration is present", fs.existsSync(path.join(jewelHireRepo, "db/migrations/0015_jewellink_jewelcert_integration.sql"))],
    ["JewelLink SSO code migration is present", fs.existsSync(path.join(jewelLinkRepo, "prisma/migrations/20260712043000_add_jewelhire_sso_codes/migration.sql"))],
    ["JewelLink hire ledger migration is present", fs.existsSync(path.join(jewelLinkRepo, "prisma/migrations/20260712052000_add_jewelhire_hire_provisioning/migration.sql"))],
    ["JewelLink JewelCert result migration is present", fs.existsSync(path.join(jewelLinkRepo, "prisma/migrations/20260712053000_add_jewelhire_jewelcert_results/migration.sql"))],
    ["JewelLink email-verification migration is present", fs.existsSync(path.join(jewelLinkRepo, "prisma/migrations/20260713120000_add_email_verification/migration.sql"))],
    ["JewelLink auth-session policy migration is present", fs.existsSync(path.join(jewelLinkRepo, "prisma/migrations/20260713130000_add_auth_session_policy/migration.sql"))],
    ["JewelLink company auth-invalidation migration is present", fs.existsSync(path.join(jewelLinkRepo, "prisma/migrations/20260714100000_invalidate_company_auth_sessions/migration.sql"))],
    ["JewelLink tenant-reassignment mailbox invalidation migration is present", fs.existsSync(path.join(jewelLinkRepo, "prisma/migrations/20260714110000_deactivate_email_integrations_on_company_change/migration.sql"))],
    ["JewelHire continuously calls the JewelLink SSO introspection contract", jewelHireIntrospection.includes("/api/integrations/jewelhire/sso/introspect") && jewelHireIntrospection.includes('cache: "no-store"')],
    ["JewelLink exposes bearer-authenticated current-session introspection", jewelLinkIntrospection.includes("JEWELHIRE_SSO_SHARED_SECRET") && jewelLinkIntrospection.includes("timingSafeEqual") && jewelLinkIntrospection.includes("jewelHireAccessFingerprintMatches")],
  ];
  return checks.map(([name, pass]) => ({ name, pass }));
}

function runSuite(suite) {
  const { product, name, script: relativeScript, cwd } = suite;
  const script = path.join(cwd, relativeScript);
  if (!fs.existsSync(script)) {
    return { product, name, script: relativeScript, pass: false, exitCode: null, output: "Required audit script is missing." };
  }
  const started = Date.now();
  const result = spawnSync(process.execPath, [script, ...(suite.args || [])], {
    cwd,
    encoding: "utf8",
    env: safeEnvironment(),
    maxBuffer: 10 * 1024 * 1024,
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  process.stdout.write(`\n[${product}] ${name}\n${output}\n`);
  return {
    product,
    name,
    script: relativeScript,
    pass: result.status === 0,
    exitCode: result.status,
    durationMs: Date.now() - started,
    output,
  };
}

async function endpointChecks() {
  if (!jewelLinkBase) return [];
  const probes = [
    ["SSO exchange rejects a missing bearer secret", "/api/integrations/jewelhire/sso/exchange", { code: "synthetic-never-valid" }],
    ["SSO introspection rejects a missing bearer secret", "/api/integrations/jewelhire/sso/introspect", {
      userId: "synthetic-never-valid",
      upstreamSessionId: "synthetic-never-valid",
      accessFingerprint: "A".repeat(43),
    }],
    ["Hire provisioning rejects a missing bearer secret", "/api/integrations/jewelhire/hires", {}],
    ["JewelCert result ingestion rejects a missing bearer secret", "/api/integrations/jewelhire/jewelcert/results", {}],
  ];
  const results = [];
  for (const [name, pathname, body] of probes) {
    try {
      const response = await fetch(`${jewelLinkBase}${pathname}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        redirect: "manual",
      });
      results.push({ name, pass: response.status === 401, expectedStatus: 401, actualStatus: response.status });
    } catch (error) {
      results.push({ name, pass: false, expectedStatus: 401, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

function markdown(report) {
  const lines = [
    "# Cross-product acceptance report",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `JewelHire commit: \`${report.repositories.jewelHire.commit || "unavailable"}\``,
    `JewelLink commit: \`${report.repositories.jewelLink.commit || "unavailable"}\``,
    "",
    "## Contract checks",
    "",
    ...report.contractChecks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "## Product suites",
    "",
    ...report.suites.map((suite) => `- ${suite.pass ? "PASS" : "FAIL"} ${suite.product}: ${suite.name}`),
    ...(report.skippedSuites.length
      ? [
          "",
          "## Skipped suites",
          "",
          ...report.skippedSuites.map((suite) => `- SKIPPED ${suite.product}: ${suite.name} (${suite.reason})`),
        ]
      : []),
    "",
    "## Safe endpoint probes",
    "",
    ...(report.endpointChecks.length
      ? report.endpointChecks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name} (expected ${check.expectedStatus}, received ${check.actualStatus ?? "no response"})`)
      : ["- SKIPPED: pass `--jewellink-base=http://127.0.0.1:<port>` to verify unauthenticated rejection against a running local service."]),
    "",
    "This runner uses synthetic fixture identifiers, passes no integration secrets to child audits, disables email, and performs no production mutation.",
  ];
  return lines.join("\n");
}

async function main() {
  if (!fs.existsSync(path.join(jewelLinkRepo, "package.json"))) {
    throw new Error(`JewelLink repository not found at ${jewelLinkRepo}`);
  }
  if (requireEndpointProbes && !jewelLinkBase) {
    throw new Error("--require-endpoint-probes requires --jewellink-base=<local origin>");
  }
  if (includeServerAudits && !jewelHireBase) {
    throw new Error("--include-server-audits requires --jewelhire-base=<local JewelHire origin>");
  }

  const contracts = contractChecks();
  for (const check of contracts) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
  const runnableSuites = suites.filter((suite) => includeServerAudits || !suite.requiresServer);
  const skippedSuites = suites
    .filter((suite) => suite.requiresServer && !includeServerAudits)
    .map((suite) => ({
      product: suite.product,
      name: suite.name,
      script: suite.script,
      reason: "requires a running JewelHire server; rerun with --include-server-audits --jewelhire-base=<origin>",
    }));
  for (const suite of skippedSuites) {
    console.log(`SKIP ${suite.product}: ${suite.name} (${suite.reason})`);
  }
  const suiteResults = runnableSuites.map(runSuite);
  const endpointResults = await endpointChecks();
  for (const check of endpointResults) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);

  const report = {
    createdAt: new Date().toISOString(),
    pass: contracts.every((check) => check.pass)
      && suiteResults.every((suite) => suite.pass)
      && endpointResults.every((check) => check.pass)
      && (!requireEndpointProbes || endpointResults.length > 0),
    mode: endpointResults.length ? "source-and-endpoint" : "source",
    repositories: {
      jewelHire: { path: jewelHireRepo, commit: gitSha(jewelHireRepo) },
      jewelLink: { path: jewelLinkRepo, commit: gitSha(jewelLinkRepo) },
    },
    contractChecks: contracts,
    suites: suiteResults,
    skippedSuites,
    endpointChecks: endpointResults,
    fixtures,
    environmentContract,
    safety: {
      productionMutation: false,
      liveEmail: false,
      secretsPassedToChildAudits: false,
    },
  };

  fs.mkdirSync(artifacts, { recursive: true });
  fs.writeFileSync(path.join(artifacts, "fixture-inventory.json"), `${JSON.stringify(fixtures, null, 2)}\n`);
  fs.writeFileSync(path.join(artifacts, "environment-contract.json"), `${JSON.stringify(environmentContract, null, 2)}\n`);
  fs.writeFileSync(path.join(artifacts, "cross-product-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(artifacts, "cross-product-report.md"), `${markdown(report)}\n`);
  console.log(`\nReport: ${path.relative(jewelHireRepo, path.join(artifacts, "cross-product-report.md"))}`);
  process.exitCode = report.pass ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
