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
const artifactDir = path.resolve(rootDir, args.get("artifacts") || `docs/qa-runs/frontend-polish-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const strict = args.has("strict");
const publicStoreSlug = args.get("store-slug") || process.env.JEWELHIRE_QA_PUBLIC_STORE_SLUG || "sissys-log-cabin-careers";
const publicJobId = args.get("job-id") || process.env.JEWELHIRE_QA_PUBLIC_JOB_ID || "job-luxury-sales-associate";
const viewport = {
  width: Number(args.get("width") || 390),
  height: Number(args.get("height") || 844),
};

const routes = [
  { name: "mobile-careers", path: `/careers/${publicStoreSlug}`, checks: ["wide-elements", "careers-page"] },
  { name: "mobile-apply", path: `/careers/${publicStoreSlug}/apply/${publicJobId}`, checks: ["wide-elements", "mobile-apply"] },
  { name: "mobile-pipeline", path: "/pipeline", checks: ["wide-elements", "hydration"] },
  { name: "hydration-applicant-detail", path: "/applicants/maya-chen", checks: ["hydration", "candidate-rating"] },
  { name: "hydration-public-page", path: "/public-page", checks: ["hydration"] },
];

function usage() {
  console.log(`Usage:
  node scripts/frontend-polish-evidence.mjs
  node scripts/frontend-polish-evidence.mjs --base=http://localhost:3004
  node scripts/frontend-polish-evidence.mjs --strict

Options:
  --base=<url>        Target an already-running app. Default: http://localhost:3004.
  --artifacts=<dir>   Screenshot/report directory.
  --width=<number>    Mobile viewport width. Default: 390.
  --height=<number>   Mobile viewport height. Default: 844.
  --strict            Exit nonzero when known frontend polish issues are detected.`);
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
    return await chromium.launch({ headless: true });
  } catch (firstError) {
    try {
      return await chromium.launch({ channel: "chrome", headless: true });
    } catch {
      throw new Error(
        `Unable to launch a browser. Run npx playwright install chromium, or install Chrome. Original error: ${
          firstError instanceof Error ? firstError.message : firstError
        }`,
      );
    }
  }
}

function isHydrationWarning(message) {
  return /hydration|extra attributes from the server|did not match|server html/i.test(message.text);
}

async function collectRouteEvidence(context, route) {
  const page = await context.newPage();
  const consoleMessages = [];
  const failedResources = [];
  page.on("console", (message) => {
    if (!["warning", "error"].includes(message.type())) return;
    consoleMessages.push({ type: message.type(), text: message.text(), location: message.location() });
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    failedResources.push({
      status: response.status(),
      method: response.request().method(),
      url: response.url(),
      resourceType: response.request().resourceType(),
    });
  });
  page.on("requestfailed", (request) => {
    failedResources.push({
      status: 0,
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      failure: request.failure()?.errorText || "request failed",
    });
  });

  const response = await page.goto(route.path, { waitUntil: "networkidle", timeout: 45_000 });
  const screenshot = `${route.name}.png`;
  await page.screenshot({ path: path.join(artifactDir, screenshot), fullPage: true });

  const metrics = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const body = document.body;
    const html = document.documentElement;
    const elements = Array.from(document.querySelectorAll("body *"));
    const measured = elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.textContent || "").replace(/\s+/g, " ").trim();
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className.slice(0, 180) : "",
          text: text.slice(0, 140),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
        };
      })
      .filter((item) => item.width > 0);

    const wideElements = measured
      .filter((item) => item.width > viewportWidth + 24 || item.right > viewportWidth + 24 || item.left < -24)
      .sort((a, b) => b.width - a.width)
      .slice(0, 15);
    const reviewMatches = measured
      .filter((item) => /\bReview\b/.test(item.text))
      .slice(0, 20);

    return {
      viewportWidth,
      viewportHeight,
      documentScrollWidth: Math.max(body.scrollWidth, html.scrollWidth),
      pageHorizontalOverflow: Math.max(body.scrollWidth, html.scrollWidth) > viewportWidth + 2,
      wideElements,
      reviewMatches,
      bodyTextSample: body.innerText.replace(/\s+/g, " ").trim().slice(0, 500),
    };
  });

  await page.close();
  return {
    ...route,
    status: response?.status() || 0,
    screenshot,
    consoleMessages,
    failedResources,
    hydrationWarnings: consoleMessages.filter(isHydrationWarning),
    metrics,
  };
}

function issueList(results) {
  const issues = [];
  for (const result of results) {
    if (result.status >= 400 || result.status === 0) {
      issues.push(`${result.path} returned ${result.status || "no response"}`);
    }
    if (result.checks.includes("hydration") && result.hydrationWarnings.length) {
      issues.push(`${result.path} emitted hydration warnings`);
    }
    if (result.checks.includes("candidate-rating") && /Internal rating|candidate rating|candidate review/i.test(result.metrics.bodyTextSample)) {
      issues.push(`${result.path} exposed candidate rating/review language`);
    }
    if (result.checks.includes("careers-page") && !/Open positions/i.test(result.metrics.bodyTextSample)) {
      issues.push(`${result.path} did not render its open-positions workflow`);
    }
    if (result.checks.includes("mobile-apply") && !/Full name.*Email.*Submit application/i.test(result.metrics.bodyTextSample)) {
      issues.push(`${result.path} did not render the required mobile application controls`);
    }
    if (result.checks.includes("wide-elements")) {
      const wideTable = result.metrics.wideElements.find((item) => item.tag === "table");
      if (wideTable) issues.push(`${result.path} still has a ${wideTable.width}px table inside a ${result.metrics.viewportWidth}px viewport`);
    }
  }
  return issues;
}

function writeReport(results, issues) {
  const lines = [
    "# Frontend Polish Evidence",
    "",
    `Base URL: ${baseUrl}`,
    `Created: ${new Date().toISOString()}`,
    `Viewport: ${viewport.width}x${viewport.height}`,
    `Strict: ${strict}`,
    "",
    "## Results",
    "",
  ];

  for (const result of results) {
    lines.push(`### ${result.name}`, "");
    lines.push(`- Route: \`${result.path}\``);
    lines.push(`- Status: ${result.status}`);
    lines.push(`- Screenshot: \`${result.screenshot}\``);
    lines.push(`- Page horizontal overflow: ${result.metrics.pageHorizontalOverflow} (${result.metrics.documentScrollWidth}px document / ${result.metrics.viewportWidth}px viewport)`);
    lines.push(`- Wide elements: ${result.metrics.wideElements.length}`);
    lines.push(`- Console warnings/errors: ${result.consoleMessages.length}`);
    lines.push(`- Failed resources: ${result.failedResources.length}`);
    lines.push(`- Hydration warnings: ${result.hydrationWarnings.length}`);
    for (const item of result.metrics.wideElements.slice(0, 5)) {
      lines.push(`  - ${item.tag} ${item.width}px: ${item.text}`);
    }
    for (const resource of result.failedResources.slice(0, 5)) {
      lines.push(`  - ${resource.status || "failed"} ${resource.method} ${resource.resourceType}: ${resource.url}`);
    }
    for (const message of result.consoleMessages.slice(0, 3)) {
      const location = message.location?.url ? ` (${message.location.url}:${message.location.lineNumber || 0})` : "";
      lines.push(`  - ${message.type}: ${message.text.slice(0, 220)}${location}`);
    }
    lines.push("");
  }

  lines.push("## Issues", "");
  if (issues.length) {
    for (const issue of issues) lines.push(`- ${issue}`);
  } else {
    lines.push("- None detected by this evidence script.");
  }
  lines.push("");

  fs.writeFileSync(path.join(artifactDir, "summary.md"), lines.join("\n"));
  fs.writeFileSync(path.join(artifactDir, "summary.json"), JSON.stringify({ baseUrl, createdAt: new Date().toISOString(), viewport, strict, issues, results }, null, 2));
}

async function main() {
  if (args.has("help") || args.has("h")) {
    usage();
    return;
  }
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0) {
    throw new Error("Invalid viewport dimensions");
  }
  fs.mkdirSync(artifactDir, { recursive: true });
  const { chromium } = await importPlaywright();
  const browser = await launchBrowser(chromium);
  try {
    const context = await browser.newContext({ baseURL: baseUrl, viewport });
    const results = [];
    for (const route of routes) {
      const evidence = await collectRouteEvidence(context, route);
      results.push(evidence);
      console.log(`${route.name}: status=${evidence.status} wide=${evidence.metrics.wideElements.length} hydration=${evidence.hydrationWarnings.length}`);
    }
    await context.close();
    const issues = issueList(results);
    writeReport(results, issues);
    console.log(`Artifacts: ${artifactDir}`);
    if (issues.length) console.log(`Issues:\n- ${issues.join("\n- ")}`);
    if (strict && issues.length) process.exitCode = 1;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
