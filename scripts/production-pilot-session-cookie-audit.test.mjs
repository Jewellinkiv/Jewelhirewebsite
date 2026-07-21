#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "production-pilot-session-cookie-audit.mjs");

function writeJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function startServer(session = {}) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const cookie = request.headers.cookie || "";
    const authenticated = /jewelhire_session=good-session/.test(cookie);

    if (url.pathname === "/api/me") {
      if (!authenticated) return writeJson(response, 401, { error: { code: "unauthenticated" } });
      return writeJson(response, 200, {
        role: "manager",
        authSource: "jewellink_sso",
        activeStoreId: "store-pilot",
        storeIds: ["store-pilot"],
        email: "pilot-manager@example.test",
        ...session,
      });
    }

    writeJson(response, 404, { error: { code: "not_found" } });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, base: `http://127.0.0.1:${address.port}` });
    });
  });
}

function runAudit({
  base,
  cookie = [{ name: "jewelhire_session", value: "good-session" }],
  expectedStoreId = "store-pilot",
  allowedRoles = "store_owner,manager",
  expectedAuthSource = "jewellink_sso",
} = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-session-cookie-"));
  const artifacts = path.join(cwd, "artifacts");
  const args = [
    script,
    `--base=${base}`,
    `--artifacts=${artifacts}`,
    `--expected-store-id=${expectedStoreId}`,
    `--allowed-roles=${allowedRoles}`,
    `--expected-auth-source=${expectedAuthSource}`,
  ];
  if (cookie) {
    const cookieFile = path.join(cwd, "cookie.json");
    fs.writeFileSync(cookieFile, `${typeof cookie === "string" ? cookie : JSON.stringify(cookie)}\n`);
    args.push(`--cookie-file=${cookieFile}`);
  }

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: root });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      const reportJson = path.join(artifacts, "pilot-session-cookie-report.json");
      const reportMd = path.join(artifacts, "pilot-session-cookie-report.md");
      const requestMd = path.join(artifacts, "pilot-session-cookie-request.md");
      resolve({
        result: { status, stdout, stderr },
        json: fs.existsSync(reportJson) ? fs.readFileSync(reportJson, "utf8") : "",
        markdown: fs.existsSync(reportMd) ? fs.readFileSync(reportMd, "utf8") : "",
        requestMarkdown: fs.existsSync(requestMd) ? fs.readFileSync(requestMd, "utf8") : "",
      });
    });
  });
}

test("pilot session cookie audit passes for a JewelLink SSO manager in the expected store", async () => {
  const { server, base } = await startServer();
  try {
    const { result, json, markdown } = await runAudit({ base });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(markdown, /Result: PASS/);
    assert.match(markdown, /PASS session came from expected auth source/);
    assert.match(markdown, /PASS active store matches expected pilot store/);
    assert.doesNotMatch(`${json}\n${markdown}`, /good-session|pilot-manager@example\.test/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("pilot session cookie audit fails closed without a cookie", async () => {
  const { server, base } = await startServer();
  try {
    const { result, markdown, requestMarkdown } = await runAudit({ base, cookie: "" });
    assert.notEqual(result.status, 0);
    assert.match(markdown, /Result: FAIL/);
    assert.match(markdown, /FAIL authenticated JewelHire session cookie is provided/);
    assert.match(requestMarkdown, /Production Pilot Session Cookie Request/);
    assert.doesNotMatch(`${markdown}\n${requestMarkdown}`, /jewelhire_session=/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("pilot session cookie audit rejects native or wrong-store sessions without leaking identity", async () => {
  const { server, base } = await startServer({
    role: "store_owner",
    authSource: "native",
    activeStoreId: "store-other",
    storeIds: ["store-other"],
    email: "pilot-owner@example.test",
  });
  try {
    const { result, json, markdown, requestMarkdown } = await runAudit({ base });
    const output = `${json}\n${markdown}\n${requestMarkdown}`;
    assert.notEqual(result.status, 0);
    assert.match(markdown, /FAIL session came from expected auth source/);
    assert.match(markdown, /FAIL active store matches expected pilot store/);
    assert.match(markdown, /FAIL session store list includes expected pilot store/);
    assert.doesNotMatch(output, /good-session|pilot-owner@example\.test|store-other/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
