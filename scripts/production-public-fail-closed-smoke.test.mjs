import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/production-public-fail-closed-smoke.mjs");

function writeJson(response, status, body, headers = {}) {
  response.writeHead(status, { "content-type": "application/json", ...headers });
  response.end(JSON.stringify(body));
}

function startServer({ teamInvitesEnabled = false } = {}) {
  const state = { userCount: 2, mutationHits: 0 };
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const cookie = request.headers.cookie || "";
    const authenticated = /jewelhire_session=good-session/.test(cookie);

    if (url.pathname === "/api/me") {
      if (!authenticated) return writeJson(response, 401, { error: { code: "unauthenticated" } });
      return writeJson(response, 200, {
        role: "store_owner",
        authSource: "native",
        activeStoreId: "store-pilot",
        storeIds: ["store-pilot"],
        email: "pilot-owner@example.test",
      });
    }

    if (url.pathname === "/api/stores/store-pilot/users" && request.method === "GET") {
      if (!authenticated) return writeJson(response, 401, { error: { code: "unauthenticated" } });
      return writeJson(response, 200, { count: state.userCount, items: [{ email: "hidden@example.test" }], capabilities: { teamInvitesEnabled } });
    }

    if (url.pathname === "/api/stores/store-pilot/users" && request.method === "POST") {
      if (!authenticated) return writeJson(response, 401, { error: { code: "unauthenticated" } });
      state.mutationHits += 1;
      if (teamInvitesEnabled) {
        state.userCount += 1;
        return writeJson(response, 201, { user: { email: "mutated@example.test" } });
      }
      return writeJson(response, 503, { error: { code: "team_invites_disabled" } });
    }

    if (url.pathname === "/api/stores/store-pilot/transfer-admin" && request.method === "POST") {
      if (!authenticated) return writeJson(response, 401, { error: { code: "unauthenticated" } });
      state.mutationHits += 1;
      if (teamInvitesEnabled) return writeJson(response, 200, { ok: true });
      return writeJson(response, 503, { error: { code: "team_invites_disabled" } });
    }

    if (url.pathname === "/api/applications/app-pilot/resume") {
      if (!authenticated) return writeJson(response, 401, { error: { code: "unauthenticated" } });
      response.writeHead(200, {
        "content-type": "application/pdf",
        "content-disposition": "attachment; filename=\"resume.pdf\"",
        "cache-control": "private, no-store, max-age=0",
        "content-security-policy": "sandbox",
      });
      return response.end("private resume bytes must not be stored");
    }

    writeJson(response, 404, { error: { code: "not_found" } });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, base: `http://127.0.0.1:${address.port}`, state });
    });
  });
}

function runSmoke({ base, cookie = "jewelhire_session=good-session; Path=/", resumeApplicationId = "app-pilot" }) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "public-fail-closed-smoke-"));
  const artifacts = path.join(cwd, "artifacts");
  const cookieFile = path.join(cwd, "cookie.json");
  if (cookie) fs.writeFileSync(cookieFile, `${JSON.stringify({ cookie })}\n`);
  const args = [
    script,
    `--base=${base}`,
    `--artifacts=${artifacts}`,
    `--store-id=store-pilot`,
    `--expected-store-id=store-pilot`,
    `--resume-application-id=${resumeApplicationId}`,
  ];
  if (cookie) args.push(`--cookie-file=${cookieFile}`);
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
      const reportJson = path.join(artifacts, "public-fail-closed-smoke-report.json");
      const reportMd = path.join(artifacts, "public-fail-closed-smoke-report.md");
      const requestMd = path.join(artifacts, "public-fail-closed-smoke-request.md");
      resolve({
        result: { status, stdout, stderr },
        json: fs.existsSync(reportJson) ? fs.readFileSync(reportJson, "utf8") : "",
        markdown: fs.existsSync(reportMd) ? fs.readFileSync(reportMd, "utf8") : "",
        requestMarkdown: fs.existsSync(requestMd) ? fs.readFileSync(requestMd, "utf8") : "",
      });
    });
  });
}

test("public fail-closed smoke passes without printing cookies, emails, or resume bytes", async () => {
  const { server, base } = await startServer();
  try {
    const { result, json, markdown } = await runSmoke({ base });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(markdown, /Result: PASS/);
    assert.match(markdown, /PASS store user invite returns team_invites_disabled/);
    assert.match(markdown, /PASS resume download rejects public access/);
    assert.match(markdown, /PASS resume download succeeds only for authenticated same-scope session/);
    assert.doesNotMatch(`${json}\n${markdown}`, /good-session|pilot-owner@example\.test|hidden@example\.test|private resume bytes/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("public fail-closed smoke fails closed when no authenticated cookie is supplied", async () => {
  const { server, base } = await startServer();
  try {
    const { result, markdown, requestMarkdown } = await runSmoke({ base, cookie: "" });
    assert.notEqual(result.status, 0);
    assert.match(markdown, /Result: FAIL/);
    assert.match(markdown, /FAIL authenticated pilot cookie is provided/);
    assert.match(requestMarkdown, /Production Public Fail-Closed Smoke Request/);
    assert.doesNotMatch(`${markdown}\n${requestMarkdown}`, /jewelhire_session=/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("public fail-closed smoke skips mutation probes when team invites are not disabled", async () => {
  const { server, base, state } = await startServer({ teamInvitesEnabled: true });
  try {
    const { result, markdown } = await runSmoke({ base });
    assert.notEqual(result.status, 0);
    assert.match(markdown, /FAIL team-invite capability is disabled before mutation probes/);
    assert.match(markdown, /FAIL team-invite mutation probes skipped because capability is not confirmed disabled/);
    assert.equal(state.mutationHits, 0);
    assert.equal(state.userCount, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
