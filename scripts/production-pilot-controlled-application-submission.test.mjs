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
const script = path.join(root, "scripts", "production-pilot-controlled-application-submission.mjs");

function targetReport(overrides = {}) {
  return {
    pass: false,
    valuesPrinted: false,
    jewelHire: {
      controlledCredential: {
        role: "applicant",
        emailAlias: "p***@example.test",
        hasPassword: true,
      },
    },
    candidates: {
      controlledApplicationCount: 0,
      selectedPublicSubmissionTarget: {
        storeId: "store-pilot",
        endpointPath: "/api/public/stores/pilot/applications",
        jobId: "job-pilot",
        publicPageStatus: "published",
        jobStatus: "open",
      },
    },
    smokePlanUpdates: {
      setup: {
        publicApplication: {
          endpointPath: "/api/public/stores/pilot/applications",
          jobId: "job-pilot",
        },
      },
    },
    ...overrides,
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readKnownArtifacts(dir) {
  return [
    "pilot-application-submission-report.json",
    "pilot-application-submission-report.md",
    "pilot-application-submission-request.json",
    "pilot-application-submission-request.md",
  ]
    .map((name) => path.join(dir, name))
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => fs.readFileSync(filePath, "utf8"))
    .join("\n");
}

function runScript(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: root,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        port: address.port,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

test("dry-run writes a request packet without posting the controlled application", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-application-dry-run-"));
  const artifacts = path.join(tmp, "artifacts");
  const targetPath = path.join(tmp, "target.json");
  writeJson(targetPath, targetReport());

  let requestCount = 0;
  const server = await startServer((_request, response) => {
    requestCount += 1;
    response.writeHead(500);
    response.end("unexpected request");
  });
  try {
    const result = await runScript([
      `--base=http://127.0.0.1:${server.port}`,
      `--target-report=${targetPath}`,
      `--artifacts=${artifacts}`,
    ]);
    const output = `${result.stdout}\n${result.stderr}\n${readKnownArtifacts(artifacts)}`;

    assert.equal(result.status, 1, output);
    assert.equal(requestCount, 0);
    assert.match(output, /Production Pilot Controlled Application Submission Request/);
    assert.match(output, /Execution requested: no/);
    assert.match(output, /Production write performed: no/);
    assert.match(output, /local ignored execution approval file/);
    assert.doesNotMatch(output, /pilot-applicant@example\.test/);
    assert.doesNotMatch(output, /JewelHire controlled pilot resume/i);
    assert.doesNotMatch(output, /jewelhire_session=/i);
    assert.doesNotMatch(output, /password=/i);
  } finally {
    await server.close();
  }
});

test("execute mode does not read the production credential before approval gates pass", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-application-no-secret-"));
  const artifacts = path.join(tmp, "artifacts");
  const targetPath = path.join(tmp, "target.json");
  const gcloudMarker = path.join(tmp, "gcloud-called");
  const binDir = path.join(tmp, "bin");
  fs.mkdirSync(binDir);
  fs.writeFileSync(
    path.join(binDir, "gcloud"),
    `#!/bin/sh\necho called > ${JSON.stringify(gcloudMarker)}\nexit 99\n`,
    { mode: 0o755 },
  );
  writeJson(targetPath, targetReport());

  let requestCount = 0;
  const server = await startServer((_request, response) => {
    requestCount += 1;
    response.writeHead(500);
    response.end("unexpected request");
  });
  try {
    const result = await runScript(
      [
        "--execute",
        `--base=http://127.0.0.1:${server.port}`,
        `--target-report=${targetPath}`,
        `--artifacts=${artifacts}`,
      ],
      { env: { PATH: binDir } },
    );
    const output = `${result.stdout}\n${result.stderr}\n${readKnownArtifacts(artifacts)}`;

    assert.equal(result.status, 1, output);
    assert.equal(requestCount, 0);
    assert.equal(fs.existsSync(gcloudMarker), false);
    assert.match(output, /approval file is provided for execution/);
    assert.match(output, /Approval gates must pass before reading the production credential/);
  } finally {
    await server.close();
  }
});

test("approved execute mode posts one multipart application without leaking secrets into artifacts", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-application-execute-"));
  const artifacts = path.join(tmp, "artifacts");
  const targetPath = path.join(tmp, "target.json");
  const approvalPath = path.join(tmp, "approval.json");
  const credentialsPath = path.join(tmp, "credentials.json");
  writeJson(targetPath, targetReport());
  writeJson(approvalPath, {
    approvals: {
      approver: "Sterling",
      approvalChannel: "local fixture",
      approvedAt: "2026-07-21T04:40:00Z",
      controlledPublicApplicationSubmissionApproved: true,
      liveEmailSendsAcknowledged: true,
      controlledApplicantMailboxApproved: true,
      submissionId: "pilot_application_20260721",
    },
  });
  writeJson(credentialsPath, {
    credentials: [{ role: "applicant", email: "pilot-applicant@example.test" }],
  });

  let requestCount = 0;
  let idempotencyKey = "";
  let requestBody = "";
  const server = await startServer((request, response) => {
    requestCount += 1;
    idempotencyKey = String(request.headers["idempotency-key"] || "");
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/api/public/stores/pilot/applications");
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      requestBody = Buffer.concat(chunks).toString("utf8");
      response.writeHead(201, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          applicationId: "app-controlled-1",
          application: { storeId: "store-pilot", jobId: "job-pilot" },
        }),
      );
    });
  });
  try {
    const result = await runScript([
      "--execute",
      `--base=http://127.0.0.1:${server.port}`,
      `--target-report=${targetPath}`,
      `--approval-file=${approvalPath}`,
      `--credentials-file=${credentialsPath}`,
      `--artifacts=${artifacts}`,
    ]);
    const output = `${result.stdout}\n${result.stderr}\n${readKnownArtifacts(artifacts)}`;

    assert.equal(result.status, 0, output);
    assert.equal(requestCount, 1);
    assert.equal(idempotencyKey, "pilot_application_20260721");
    assert.match(requestBody, /job-pilot/);
    assert.match(requestBody, /jewelhire-controlled-pilot-resume\.pdf/);
    assert.match(output, /Result: PASS/);
    assert.match(output, /app-controlled-1/);
    assert.doesNotMatch(output, /pilot-applicant@example\.test/);
    assert.doesNotMatch(output, /JewelHire controlled pilot resume/i);
    assert.doesNotMatch(output, /jewelhire_session=/i);
    assert.doesNotMatch(output, /password=/i);
  } finally {
    await server.close();
  }
});
