import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { latestCompletedJewelCertResult } from "../lib/applicant-jewelcert-result.ts";

test("returns an honest empty state when no completed JewelCert exists", () => {
  assert.equal(latestCompletedJewelCertResult({ items: [] }), null);
  assert.equal(
    latestCompletedJewelCertResult({
      items: [{ kind: "GemMatch", status: "started", resultProfileCode: "V", resultMix: { V: 44, C: 16, F: 10, D: 30 } }],
    }),
    null,
  );
});

test("returns the latest validated completed result", () => {
  assert.deepEqual(
    latestCompletedJewelCertResult({
      items: [
        {
          kind: "GemMatch",
          status: "completed",
          resultProfileCode: "V",
          resultMix: { V: 44, C: 16, F: 10, D: 30 },
          completedAt: "2026-07-15T12:00:00.000Z",
        },
      ],
    }),
    {
      primary: "V",
      secondary: "D",
      type: "Trailblazer",
      mix: { V: 44, C: 16, F: 10, D: 30 },
      completedAt: "2026-07-15T12:00:00.000Z",
    },
  );
});

test("selects the most recently completed result regardless of API creation order", () => {
  assert.deepEqual(
    latestCompletedJewelCertResult({
      items: [
        {
          kind: "GemMatch",
          status: "completed",
          resultProfileCode: "C",
          resultMix: { V: 15, C: 50, F: 25, D: 10 },
          completedAt: "2026-07-14T18:00:00.000Z",
        },
        {
          kind: "GemMatch",
          status: "completed",
          resultProfileCode: "D",
          resultMix: { V: 20, C: 15, F: 25, D: 40 },
          completedAt: "2026-07-15T09:30:00.000Z",
        },
      ],
    }),
    {
      primary: "D",
      secondary: "F",
      type: "Master Analyst",
      mix: { V: 20, C: 15, F: 25, D: 40 },
      completedAt: "2026-07-15T09:30:00.000Z",
    },
  );
});

test("rejects corrupt, incomplete, or internally inconsistent result data", () => {
  const completedAt = "2026-07-15T12:00:00.000Z";
  const invalidItems = [
    { kind: "GemMatch", status: "completed", resultProfileCode: "V", completedAt },
    { kind: "GemMatch", status: "completed", resultProfileCode: "V", resultMix: { V: 1, C: 1, F: 1, D: 1 }, completedAt },
    { kind: "GemMatch", status: "completed", resultProfileCode: "C", resultMix: { V: 44, C: 16, F: 10, D: 30 }, completedAt },
    { kind: "GemMatch", status: "completed", resultProfileCode: "V", resultMix: { V: 44, C: 16, F: -10, D: 50 }, completedAt },
    { kind: "GemMatch", status: "completed", resultProfileCode: "V", resultMix: { V: 44, C: 16, F: 10, D: 30 }, completedAt: "not-a-date" },
  ];
  for (const item of invalidItems) {
    assert.equal(latestCompletedJewelCertResult({ items: [item] }), null);
  }
});

test("production profile cannot regress to the demo identity or static JewelCert result", () => {
  const root = process.cwd();
  const profilePage = fs.readFileSync(path.join(root, "app/(associate)/portal/profile/page.tsx"), "utf8");
  const clientSession = fs.readFileSync(path.join(root, "lib/client-session.ts"), "utf8");
  const postgres = fs.readFileSync(path.join(root, "lib/server/postgres-phase1.ts"), "utf8");

  assert.doesNotMatch(profilePage, /GEMMATCH_RESULT/);
  assert.doesNotMatch(clientSession, /useState<SessionUser>\(SESSION\)/);
  assert.match(
    postgres,
    /export async function listPostgresApplicantInvites[\s\S]*?gi\.result_profile_code,\s+gi\.fit_rating,\s+gi\.result_mix,\s+gi\.fit_score,/,
  );
});
