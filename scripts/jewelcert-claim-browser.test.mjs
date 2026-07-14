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
const firstToken = "first-jewelcert-bearer-only-in-memory";
const secondToken = "second-jewelcert-bearer-from-hashchange";

function createServerFixture() {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "jewelhire-claim-browser-"));
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
const cleanPath = "/jewelcert/claim/browser-transport-invite";
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
  const previewRequests = [];
  const requestUrls = [];

  page.on("request", (request) => requestUrls.push(request.url()));
  await page.route("**/api/auth/jewelcert-claim/preview", async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    const headers = await request.allHeaders();
    previewRequests.push({ method: request.method(), url: request.url(), referer: headers.referer || "", body });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        valid: true,
        existingAccount: body.token === secondToken,
        jewellinkRequired: body.token === secondToken,
        next: "/bundle/browser-transport-invite",
        loginPath: body.token === secondToken
          ? "/login?error=jewellink_required&next=%2Fbundle%2Fbrowser-transport-invite"
          : undefined,
      }),
    });
  });

  await page.goto(`${baseUrl}${cleanPath}#t=${encodeURIComponent(firstToken)}`);
  await page.getByRole("heading", { name: "Create a password to begin" }).waitFor();
  assert.equal(page.url(), `${baseUrl}${cleanPath}`);
  assert.deepEqual(previewRequests[0]?.body, {
    inviteId: "browser-transport-invite",
    token: firstToken,
  });

  await page.evaluate((token) => {
    window.location.hash = `t=${encodeURIComponent(token)}`;
  }, secondToken);
  await page.getByText("Continue with JewelLink", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Continue to JewelLink sign in" }).getAttribute("href"),
    "/login?error=jewellink_required&next=%2Fbundle%2Fbrowser-transport-invite",
  );
  assert.equal(page.url(), `${baseUrl}${cleanPath}`);
  assert.deepEqual(previewRequests.map((request) => request.body.token), [firstToken, secondToken]);

  for (const request of previewRequests) {
    assert.equal(request.method, "POST");
    assert.equal(new URL(request.url).pathname, "/api/auth/jewelcert-claim/preview");
    assert.equal(new URL(request.url).search, "");
    assert.equal(new URL(request.url).hash, "");
    assert.equal(new URL(request.referer).pathname, cleanPath);
    assert.equal(new URL(request.referer).search, "");
    assert.equal(new URL(request.referer).hash, "");
    assert.equal(request.referer.includes(request.body.token), false);
  }
  for (const url of requestUrls) {
    assert.equal(url.includes(firstToken), false, `first bearer leaked into request URL: ${url}`);
    assert.equal(url.includes(secondToken), false, `second bearer leaked into request URL: ${url}`);
  }
  assert.equal(requestUrls.some((url) => new URL(url).pathname === "/api/auth/jewelcert-claim"), false);

  await context.close();
  console.log("PASS initial and same-tab JewelCert hash tokens stay out of every browser request URL");
} finally {
  if (browser) await browser.close().catch(() => undefined);
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    const timeout = setTimeout(resolve, 5_000);
    server.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
