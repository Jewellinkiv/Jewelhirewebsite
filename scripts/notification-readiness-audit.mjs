#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/notification-readiness-${TS}`);
const ROOTS = ["app", "lib"];
const EXCLUDE = new Set(["node_modules", ".next", ".git", "docs/qa-runs"]);
const EXPECTED_TRIGGERS = [
  {
    id: "public_application_submitted",
    label: "Public application submitted",
    recipients: "candidate confirmation, store hiring manager",
    markers: ["api/public/stores", "applications"],
    wiredMarkers: ["notifyPublicApplicationSubmitted"],
    requiredForLaunch: true,
  },
  {
    id: "jewelcert_invite_created",
    label: "JewelCert invite created",
    recipients: "candidate",
    markers: ["jewelcert-invites", "createPostgresJewelCertInvite"],
    wiredMarkers: ["notifyJewelCertInviteCreated"],
    requiredForLaunch: true,
  },
  {
    id: "assessment_completed",
    label: "Candidate completes JewelCert or assessment",
    recipients: "store hiring manager, candidate confirmation",
    markers: ["complete", "assessment", "JewelCert"],
    wiredMarkers: ["notifyAssessmentCompleted"],
    requiredForLaunch: false,
  },
  {
    id: "candidate_hired",
    label: "Candidate hired to team",
    recipients: "candidate",
    markers: ["applications", "hire"],
    wiredMarkers: ["notifyCandidateHired"],
    requiredForLaunch: false,
  },
  {
    id: "interview_scheduled",
    label: "Interview scheduled",
    recipients: "candidate, interviewer, added guests",
    markers: ["createPostgresInterview", "createPostgresNewCandidateInterview", "Email invite queued"],
    wiredMarkers: ["notifyInterviewScheduled"],
    requiredForLaunch: true,
  },
  {
    id: "team_user_invited",
    label: "Store or company user invited",
    recipients: "invited user, store admin",
    markers: ["invitePostgresStoreUser", "invitePostgresCompanyUser"],
    wiredMarkers: ["notifyTeamUserInvited"],
    requiredForLaunch: false,
  },
  {
    id: "training_assignment_due",
    label: "Training assigned, overdue, or completed",
    recipients: "associate, manager",
    markers: ["Training assignment overdue", "training"],
    wiredMarkers: ["notifyTrainingAssignment"],
    requiredForLaunch: false,
  },
  {
    id: "billing_or_subscription_changed",
    label: "Stripe checkout, subscription, or billing state changed",
    recipients: "store owner, billing contact",
    markers: ["STRIPE_STORE_OWNER_PAYMENT_LINK", "checkout", "billing"],
    wiredMarkers: ["notifyBillingChanged"],
    requiredForLaunch: false,
  },
];

const SEND_ADAPTER_MARKERS = [
  "api.postmarkapp.com",
  "X-Postmark-Server-Token",
  "MessageStream",
  "sendEmail(",
  "sendMail(",
  ["POSTMARK", "SERVER", "TOKEN"].join("_"),
];

const EMAIL_PROMISE_PATTERNS = [
  /\bemailed\b/i,
  /\bsent from\b/i,
  /\bwill get one link\b/i,
  /\bEmail \+ in-app\b/i,
  /\bTraining assignment overdue\b/i,
  /\bNew strong-fit candidate\b/i,
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = path.relative(process.cwd(), full);
    if (entry.isDirectory()) {
      if (!EXCLUDE.has(entry.name) && !EXCLUDE.has(relative)) walk(full, files);
      continue;
    }
    if (/\.(tsx?|jsx?|mjs|cjs|md)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function readSource() {
  const files = ROOTS.flatMap((root) => walk(path.resolve(process.cwd(), root)));
  return files.map((file) => ({
    file,
    relative: path.relative(process.cwd(), file),
    text: fs.readFileSync(file, "utf8"),
  }));
}

function findOccurrences(sources, predicate) {
  const matches = [];
  for (const source of sources) {
    const lines = source.text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (predicate(line, source.relative)) {
        matches.push({ file: source.relative, line: index + 1, text: line.trim().replace(/\s+/g, " ").slice(0, 180) });
      }
    });
  }
  return matches;
}

function triggerStatus(sources, trigger) {
  const hits = [];
  for (const marker of trigger.markers) {
    hits.push(...findOccurrences(sources, (line) => line.includes(marker)));
  }
  const wiredEvidence = (trigger.wiredMarkers || []).flatMap((marker) =>
    findOccurrences(sources, (line) => line.includes(marker)).map((hit) => ({ marker, ...hit })),
  );
  return {
    ...trigger,
    evidence: hits.slice(0, 8),
    wiredEvidence: wiredEvidence.slice(0, 8),
    sourcePresent: hits.length > 0,
    wired: (trigger.wiredMarkers || []).length > 0 && wiredEvidence.length > 0,
  };
}

function main() {
  const sources = readSource();
  const fullText = sources.map((source) => source.text).join("\n");
  const adapterEvidence = SEND_ADAPTER_MARKERS.flatMap((marker) =>
    findOccurrences(sources, (line) => line.includes(marker)).map((hit) => ({ marker, ...hit })),
  );
  const promiseEvidence = findOccurrences(sources, (line) => EMAIL_PROMISE_PATTERNS.some((pattern) => pattern.test(line)));
  const triggers = EXPECTED_TRIGGERS.map((trigger) => triggerStatus(sources, trigger));
  const emailsEnabledInSource = fullText.includes("EMAIL_NOTIFICATIONS_ENABLED");
  const hasSendAdapter = adapterEvidence.length > 0;
  const preferenceEnforcement =
    fullText.includes("applicantAllowsNotification") &&
    fullText.includes("recipient_opted_out") &&
    fullText.includes("APPLICANT_PREFERENCE_BY_TEMPLATE");
  const blockers = [];
  const warnings = [];

  if (!hasSendAdapter) {
    blockers.push("No Postmark or SMTP send adapter was found in source; keep live email sends disabled.");
  }
  if (!preferenceEnforcement) {
    blockers.push("Applicant notification preferences are not enforced by the central send adapter.");
  }
  for (const trigger of triggers) {
    if (!trigger.sourcePresent) warnings.push(`No source marker found for expected notification trigger: ${trigger.label}.`);
    if (trigger.sourcePresent && !trigger.wired) {
      const message = `Notification trigger is not wired yet: ${trigger.label} -> ${trigger.recipients}.`;
      if (trigger.requiredForLaunch) blockers.push(message);
      else warnings.push(message);
    }
  }
  if (!emailsEnabledInSource) {
    warnings.push("No local source reference to EMAIL_NOTIFICATIONS_ENABLED found; Cloud Run should keep the flag false until the adapter is implemented.");
  }

  const report = {
    createdAt: new Date().toISOString(),
    sourceRoot: process.cwd(),
    mode: "static",
    liveSendSafety: "No emails are sent by this audit.",
    hasSendAdapter,
    preferenceEnforcement,
    adapterEvidence,
    promiseEvidence,
    triggers,
    blockers,
    warnings,
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "notification-readiness-report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(OUT, "notification-readiness-report.md"),
    [
      "# Notification Readiness Audit",
      "",
      `Created: ${report.createdAt}`,
      `Source root: ${report.sourceRoot}`,
      "Live send safety: no emails are sent by this audit.",
      "",
      `Send adapter found: ${hasSendAdapter ? "yes" : "no"}`,
      `Applicant preferences enforced: ${preferenceEnforcement ? "yes" : "no"}`,
      `Blockers: ${blockers.length}`,
      `Warnings: ${warnings.length}`,
      "",
      "## Expected Triggers",
      "",
      ...triggers.map((trigger) => `- ${trigger.sourcePresent ? "FOUND" : "MISSING"} / ${trigger.wired ? "WIRED" : "NOT WIRED"} ${trigger.label} -> ${trigger.recipients}`),
      "",
      "## Blockers",
      "",
      ...(blockers.length ? blockers.map((blocker) => `- ${blocker}`) : ["- None"]),
      "",
      "## Warnings",
      "",
      ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ["- None"]),
      "",
      "## UI/Source Email Promise Evidence",
      "",
      ...(promiseEvidence.length
        ? promiseEvidence.slice(0, 20).map((hit) => `- ${hit.file}:${hit.line} ${hit.text}`)
        : ["- None found"]),
    ].join("\n"),
  );

  console.log(`Notification readiness report: ${path.relative(process.cwd(), OUT)}/notification-readiness-report.md`);
  console.log(`Blockers: ${blockers.length}; warnings: ${warnings.length}; send adapter found: ${hasSendAdapter ? "yes" : "no"}`);
  process.exit(0);
}

main();
