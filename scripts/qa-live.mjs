#!/usr/bin/env node
// Safe live QA for the deployed Desktop JewelHire app at app.jewelhire.com.
//
// This harness is intentionally non-destructive:
// - verifies public pages and auth boundaries
// - starts, but does not complete, Google OAuth
// - never submits applications, sends email, starts checkout, or clicks live actions
// - uses Playwright WebKit by default as the closest automation target to Safari

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { devices, webkit, chromium } from "playwright";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

const BASE = (args.get("base") || process.env.JEWELHIRE_QA_BASE_URL || "https://app.jewelhire.com").replace(/\/$/, "");
const HEADED = args.has("headed");
const BROWSER = args.get("browser") || process.env.JEWELHIRE_QA_BROWSER || "webkit";
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/live-${TS}`);
const SHOTS = path.join(OUT, "screenshots");

const desktop = { width: 1440, height: 1000 };
const mobile = devices["iPhone 13"].viewport;
const CONSOLE_ALLOW = [/favicon/i, /third-party cookie/i, /React DevTools/i];

const report = {
  base: BASE,
  app: "Desktop JewelHire Next app",
  browser: BROWSER,
  startedAt: new Date().toISOString(),
  checks: [],
  failures: 0,
  warnings: 0,
};

fs.mkdirSync(SHOTS, { recursive: true });

function fail(message) {
  report.failures++;
  console.error("FAIL " + message);
}

function warn(message) {
  report.warnings++;
  console.warn("WARN " + message);
}

function ok(message) {
  console.log("PASS " + message);
}

function record(check, pass, details = {}) {
  report.checks.push({ check, pass, ...details });
  if (pass) ok(check);
  else fail(`${check}: ${JSON.stringify(details).slice(0, 240)}`);
}

function watchConsole(page, sink) {
  page.on("console", (message) => {
    if (message.type() === "error" && !CONSOLE_ALLOW.some((pattern) => pattern.test(message.text()))) {
      sink.push(message.text());
    }
  });
  page.on("pageerror", (error) => sink.push(String(error)));
}

async function readBody(response) {
  const text = await response.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.replace(/\s+/g, " ").slice(0, 300) };
  }
}

async function requestCheck(context, name, pathname, expectedStatus, expect = () => true) {
  const response = await context.request.get(`${BASE}${pathname}`, { maxRedirects: 0 });
  const body = await readBody(response);
  const pass = response.status() === expectedStatus && expect({ response, body });
  record(name, pass, { status: response.status(), pathname });
  return { response, body };
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true }).catch(() => {});
}

async function verifyViewport(browser, viewport, label) {
  const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const consoleErrors = [];
  const expectedUnauthorizedUrls = [];
  watchConsole(page, consoleErrors);
  page.on("response", (response) => {
    if (response.status() !== 401) return;
    const url = new URL(response.url());
    if (url.pathname === "/api/me") expectedUnauthorizedUrls.push(response.url());
  });

  const loginResponse = await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45_000 }).catch((error) => {
    fail(`${label} login load: ${error}`);
    return null;
  });
  if (loginResponse) record(`${label} login loads`, loginResponse.status() === 200, { status: loginResponse.status() });
  await screenshot(page, `login__${label}.png`);

  const loginBody = await page.locator("body").innerText().catch(() => "");
  record(`${label} login renders JewelHire`, /JewelHire|Sign in|Google/i.test(loginBody), { bodySample: loginBody.slice(0, 160) });

  const applyResponse = await page.goto(`${BASE}/apply/job-luxury-sales-associate`, { waitUntil: "networkidle", timeout: 45_000 }).catch((error) => {
    fail(`${label} public apply load: ${error}`);
    return null;
  });
  if (applyResponse) record(`${label} public apply loads`, applyResponse.status() === 200, { status: applyResponse.status() });
  await screenshot(page, `apply__${label}.png`);

  const applyBody = await page.locator("body").innerText().catch(() => "");
  record(`${label} public apply has form`, /apply|application|email/i.test(applyBody), { bodySample: applyBody.slice(0, 160) });

  const actionableConsoleErrors = consoleErrors.filter((error) => {
    const expectedLoggedOutSessionProbe =
      /status of 401/i.test(error) && expectedUnauthorizedUrls.some((url) => new URL(url).pathname === "/api/me");
    return !expectedLoggedOutSessionProbe;
  });
  if (actionableConsoleErrors.length) fail(`${label} console errors: ${actionableConsoleErrors[0].slice(0, 180)}`);
  else ok(`${label} no console errors`);

  await context.close();
}

async function run() {
  console.log(`JewelHire live QA -> ${BASE}`);
  console.log(`Artifacts -> ${OUT}`);

  const engine = BROWSER === "chromium" ? chromium : webkit;
  const browser = await engine.launch({ headless: !HEADED });

  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await requestCheck(context, "root redirects to login", "/", 307, ({ response }) => response.headers()["location"]?.startsWith("/login"));
  await requestCheck(context, "login is public", "/login", 200);
  await requestCheck(context, "public apply is public", "/apply/job-luxury-sales-associate", 200);
  await requestCheck(context, "api me requires auth", "/api/me", 401, ({ body }) => body?.error?.code === "unauthenticated");
  await requestCheck(
    context,
    "store api requires auth",
    "/api/stores/store-sissys-little-rock/applications?q=maya",
    401,
    ({ body }) => body?.error?.code === "unauthenticated",
  );
  await requestCheck(
    context,
    "store billing checkout requires auth",
    "/api/stores/store-sissys-little-rock/billing/checkout",
    401,
    ({ body }) => body?.error?.code === "unauthenticated",
  );
  await requestCheck(
    context,
    "google oauth start redirects",
    "/api/auth/google/start?next=%2F",
    307,
    ({ response }) => response.headers()["location"]?.startsWith("https://accounts.google.com/"),
  );
  await context.close();

  await verifyViewport(browser, desktop, "desktop");
  await verifyViewport(browser, mobile, "mobile");

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(OUT, "report.md"),
    [
      `# JewelHire Live QA`,
      ``,
      `Base: ${BASE}`,
      `App: ${report.app}`,
      `Browser engine: ${BROWSER}`,
      `Started: ${report.startedAt}`,
      `Finished: ${report.finishedAt}`,
      ``,
      `Failures: ${report.failures}`,
      `Warnings: ${report.warnings}`,
      `Checks: ${report.checks.length}`,
      ``,
      `Live side effects: none. No applications submitted, emails sent, or checkout actions clicked.`,
    ].join("\n"),
  );

  await browser.close();
  console.log(`Done. ${report.failures} failure(s), ${report.warnings} warning(s). Report: ${path.relative(process.cwd(), OUT)}/report.md`);
  process.exit(report.failures > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
