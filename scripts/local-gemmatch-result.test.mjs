import assert from "node:assert/strict";
import test from "node:test";
import { latestCompletedJewelCertResult } from "../lib/applicant-jewelcert-result.ts";
import { completeGemMatchResponse, listApplicantInvites } from "../lib/local-api-store.ts";

test("local JewelCert completion preserves the scored mix for the applicant profile", () => {
  const completion = completeGemMatchResponse({
    inviteId: "gemmatch-maya",
    pickedAdjectiveIds: [
      "strategic",
      "analytical",
      "inventive",
      "curious",
      "friendly",
      "warm",
      "persuasive",
      "dependable",
      "patient",
      "driven",
    ],
  });

  assert.deepEqual(completion?.invite.resultMix, { V: 40, C: 30, F: 20, D: 10 });

  const applicantInvites = listApplicantInvites("maya.chen@email.com");
  const result = latestCompletedJewelCertResult({ items: applicantInvites });
  assert.deepEqual(result, {
    primary: "V",
    secondary: "C",
    type: "Innovator",
    mix: { V: 40, C: 30, F: 20, D: 10 },
    completedAt: completion?.invite.completedAt,
  });
});
