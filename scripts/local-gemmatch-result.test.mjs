import assert from "node:assert/strict";
import test from "node:test";
import { applicantInvitesForDisplay } from "../lib/applicant-invite-display.ts";
import { latestCompletedJewelCertResult } from "../lib/applicant-jewelcert-result.ts";
import { completeGemMatchResponse, listApplicantInvites } from "../lib/local-api-store.ts";
import { CERT_COMPONENTS, GEMMATCH_PERSONALITY_ASSESSMENT_LABEL } from "../lib/jewelcert.ts";

test("GemMatch keeps its candidate-facing personality assessment name", () => {
  assert.equal(GEMMATCH_PERSONALITY_ASSESSMENT_LABEL, "GemMatch Personality Assessment");
  assert.equal(CERT_COMPONENTS.find((component) => component.id === "gemmatch")?.label, GEMMATCH_PERSONALITY_ASSESSMENT_LABEL);
});

test("applicant invite display hides a GemMatch component already represented by its JewelCert bundle", () => {
  const items = [
    {
      id: "bundle",
      kind: "JewelCert",
      assessmentPackageId: "gemmatch",
      application: { id: "application-1" },
      store: { id: "store-1" },
    },
    {
      id: "bundle-component",
      kind: "GemMatch",
      application: { id: "application-1" },
      store: { id: "store-1" },
    },
    {
      id: "standalone",
      kind: "GemMatch",
      application: { id: "application-2" },
      store: { id: "store-1" },
    },
  ];

  assert.deepEqual(applicantInvitesForDisplay(items).map((item) => item.id), ["bundle", "standalone"]);
});

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
