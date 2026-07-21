import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const script = path.join(root, "scripts/production-smoke-credential-auth-audit.mjs");

function writeCredentials(cwd, credentials) {
  const credentialsFile = path.join(cwd, "smoke-credentials.json");
  fs.writeFileSync(credentialsFile, `${JSON.stringify({ credentials }, null, 2)}\n`);
  return credentialsFile;
}

async function withAuthServer(users, callback) {
  const sessions = new Map();
  const server = http.createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/api/auth/password/session") {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw || "{}");
      const user = users.find((item) => item.email === body.email && item.password === body.password);
      if (!user) {
        response.writeHead(303, { location: "/login?error=password" });
        response.end();
        return;
      }
      const sessionId = `session-${sessions.size + 1}`;
      sessions.set(sessionId, user.session);
      response.writeHead(303, {
        location: user.session.role === "associate" ? "/portal" : "/",
        "set-cookie": `jewelhire_session=${sessionId}; Path=/; HttpOnly`,
      });
      response.end();
      return;
    }

    if (request.method === "GET" && request.url === "/api/me") {
      const cookie = request.headers.cookie || "";
      const sessionId = cookie.match(/jewelhire_session=([^;]+)/)?.[1] || "";
      const session = sessions.get(sessionId);
      if (!session) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { code: "unauthenticated" } }));
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(session));
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    return await callback(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function runAudit({ credentials, users }) {
  return withAuthServer(users, async (base) => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-credential-auth-"));
    const artifacts = path.join(cwd, "artifacts");
    const credentialsFile = writeCredentials(cwd, credentials);
    const result = await new Promise((resolve) => {
      const child = spawn(process.execPath, [script, `--base=${base}`, `--artifacts=${artifacts}`, `--credentials-file=${credentialsFile}`], {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });
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
        resolve({ status, stdout, stderr });
      });
    });
    const reportJson = path.join(artifacts, "smoke-credential-auth-report.json");
    const reportMd = path.join(artifacts, "smoke-credential-auth-report.md");
    const requestJson = path.join(artifacts, "smoke-credential-auth-request.json");
    const requestMd = path.join(artifacts, "smoke-credential-auth-request.md");
    return {
      result,
      json: fs.existsSync(reportJson) ? fs.readFileSync(reportJson, "utf8") : "",
      markdown: fs.existsSync(reportMd) ? fs.readFileSync(reportMd, "utf8") : "",
      requestJson: fs.existsSync(requestJson) ? fs.readFileSync(requestJson, "utf8") : "",
      requestMarkdown: fs.existsSync(requestMd) ? fs.readFileSync(requestMd, "utf8") : "",
    };
  });
}

test("complete smoke credentials pass without printing raw credentials", async () => {
  const credentials = [
    { role: "store_owner", email: "owner@example.test", password: "owner-password-value" },
    { role: "applicant", email: "applicant@example.test", password: "applicant-password-value" },
  ];
  const users = [
    {
      email: "owner@example.test",
      password: "owner-password-value",
      session: {
        role: "store_owner",
        authSource: "native",
        activeStoreId: "store-1",
        storeIds: ["store-1"],
      },
    },
    {
      email: "applicant@example.test",
      password: "applicant-password-value",
      session: {
        role: "associate",
        authSource: "native",
        activeStoreId: "",
        storeIds: [],
      },
    },
  ];

  const { result, json, markdown, requestMarkdown } = await runAudit({ credentials, users });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(markdown, /Result: PASS/);
  assert.match(markdown, /Store-owner smoke credential \| PASS/);
  assert.match(markdown, /Applicant smoke credential \| PASS/);
  assert.match(markdown, /Native admin smoke password removed \| PASS/);
  assert.equal(requestMarkdown, "");
  assert.doesNotMatch(`${json}\n${markdown}`, /owner@example\.test|applicant@example\.test/);
  assert.doesNotMatch(`${json}\n${markdown}`, /owner-password-value|applicant-password-value/);
});

test("stale store owner and native admin password fail with cleanup packet", async () => {
  const credentials = [
    { role: "admin", email: "admin@example.test", password: "admin-password-value" },
    { role: "store_owner", email: "owner@example.test", password: "wrong-owner-password-value" },
    { role: "applicant", email: "applicant@example.test", password: "applicant-password-value" },
  ];
  const users = [
    {
      email: "admin@example.test",
      password: "admin-password-value",
      session: {
        role: "associate",
        authSource: "native",
        activeStoreId: "",
        storeIds: [],
      },
    },
    {
      email: "applicant@example.test",
      password: "applicant-password-value",
      session: {
        role: "associate",
        authSource: "native",
        activeStoreId: "",
        storeIds: [],
      },
    },
  ];

  const { result, json, markdown, requestJson, requestMarkdown } = await runAudit({ credentials, users });

  assert.notEqual(result.status, 0);
  assert.match(markdown, /Result: FAIL/);
  assert.match(markdown, /Store-owner smoke credential \| FAIL/);
  assert.match(markdown, /Applicant smoke credential \| PASS/);
  assert.match(markdown, /Native admin smoke password removed \| FAIL/);
  assert.match(requestMarkdown, /Production Smoke Credential Auth Request/);
  assert.match(requestMarkdown, /`credentials\.store_owner`/);
  assert.match(requestMarkdown, /`cleanup\.adminNativePassword`/);
  assert.match(requestJson, /"status": "needed"/);
  assert.match(json, /"valuesPrinted": false/);
  assert.doesNotMatch(`${json}\n${markdown}\n${requestJson}\n${requestMarkdown}`, /admin@example\.test|owner@example\.test|applicant@example\.test/);
  assert.doesNotMatch(`${json}\n${markdown}\n${requestJson}\n${requestMarkdown}`, /password-value|wrong-owner/);
});

test("missing applicant credential fails closed", async () => {
  const credentials = [
    { role: "store_owner", email: "owner@example.test", password: "owner-password-value" },
    { role: "admin", authMethod: "jewellink_sso" },
  ];
  const users = [
    {
      email: "owner@example.test",
      password: "owner-password-value",
      session: {
        role: "store_owner",
        authSource: "native",
        activeStoreId: "store-1",
        storeIds: ["store-1"],
      },
    },
  ];

  const { result, markdown, requestMarkdown } = await runAudit({ credentials, users });

  assert.notEqual(result.status, 0);
  assert.match(markdown, /Applicant smoke credential \| FAIL/);
  assert.match(markdown, /Native admin smoke password removed \| PASS/);
  assert.match(requestMarkdown, /`credentials\.applicant`/);
});
