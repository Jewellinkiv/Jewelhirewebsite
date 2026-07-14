#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const rootDir = process.cwd();
const firstToken = `pr2_${"a".repeat(43)}`;
const secondToken = `pr2_${"b".repeat(43)}`;

function createServerFixture() {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "jewelhire-reset-browser-"));
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

async function availablePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const address = socket.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error("Could not reserve a local browser-test port.");
  return port;
}

async function waitForServer(url, child, output) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Next dev server exited early (${child.exitCode}).\n${output.join("")}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still compiling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}.\n${output.join("")}`);
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (firstError) {
    try {
      return await chromium.launch({ channel: "chrome", headless: true });
    } catch {
      throw new Error(
        `Unable to launch Chromium or Chrome. ${firstError instanceof Error ? firstError.message : firstError}`,
      );
    }
  }
}

const port = await availablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const cleanPath = "/reset-password";
const serverOutput = [];
const fixtureDir = createServerFixture();
const server = spawn(
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
      JEWELHIRE_REQUIRE_AUTH: "0",
      NEXT_DIST_DIR: ".next",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
server.stdout.on("data", (chunk) => serverOutput.push(String(chunk)));
server.stderr.on("data", (chunk) => serverOutput.push(String(chunk)));

let browser;
try {
  await waitForServer(`${baseUrl}${cleanPath}`, server, serverOutput);
  browser = await launchBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  const requestUrls = [];
  const resetRequests = [];

  page.on("request", (request) => requestUrls.push(request.url()));
  await page.route("**/api/auth/password/reset", async (route) => {
    const request = route.request();
    resetRequests.push({
      method: request.method(),
      body: request.postDataJSON(),
      url: request.url(),
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, role: "associate", next: "/login" }),
    });
  });

  await page.goto(`${baseUrl}${cleanPath}#token=${firstToken}`);
  await page.waitForURL(`${baseUrl}${cleanPath}`);
  assert.equal(page.url(), `${baseUrl}${cleanPath}`);
  await page.getByRole("heading", { name: "Choose a new password" }).waitFor();

  await page.evaluate((token) => {
    window.location.hash = `token=${token}`;
  }, secondToken);
  await page.waitForURL(`${baseUrl}${cleanPath}`);
  assert.equal(page.url(), `${baseUrl}${cleanPath}`);

  await page.getByLabel("New password").fill("BrowserResetPassword123!");
  await page.getByLabel("Confirm password").fill("BrowserResetPassword123!");
  await page.getByRole("button", { name: "Set new password" }).click();
  await page.waitForURL(`${baseUrl}/login`);

  assert.equal(resetRequests.length, 1);
  assert.equal(resetRequests[0]?.method, "POST");
  assert.deepEqual(resetRequests[0]?.body, {
    token: secondToken,
    password: "BrowserResetPassword123!",
  });
  assert.equal(resetRequests[0]?.url, `${baseUrl}/api/auth/password/reset`);
  assert.equal(requestUrls.some((url) => url.includes(firstToken) || url.includes(secondToken)), false);
  assert.equal(requestUrls.some((url) => url.includes("/reset-password?token=")), false);
  console.log("PASS browser keeps initial and hashchange reset bearers out of every HTTP URL");
  console.log("PASS browser submits only the newest in-memory bearer in the POST body and honors login fallback");
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      server.kill("SIGKILL");
      resolve();
    }, 5_000);
    server.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
