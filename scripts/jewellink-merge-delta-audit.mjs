#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

const jewelHireRepo = process.cwd();
const jewelLinkRepo = path.resolve(args.get("jewellink-repo") || path.join(jewelHireRepo, "..", "JewelLink"));
const target = args.get("target") || "origin/main";
const preserved = args.get("preserved") || "codex/jewellink-integration-hold";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const artifacts = path.resolve(
  jewelHireRepo,
  args.get("artifacts") || `docs/qa-runs/jewellink-merge-delta-${timestamp}`,
);

function git(arguments_, { allowFailure = false } = {}) {
  const result = spawnSync("git", arguments_, {
    cwd: jewelLinkRepo,
    encoding: "utf8",
    env: Object.fromEntries(
      ["PATH", "HOME", "TMPDIR"].filter((name) => process.env[name]).map((name) => [name, process.env[name]]),
    ),
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${arguments_.join(" ")} failed`).trim());
  }
  return result.status === 0 ? result.stdout.trim() : null;
}

function blob(ref, file) {
  return git(["rev-parse", `${ref}:${file}`], { allowFailure: true });
}

function classify(parentBlob, preservedBlob, targetBlob) {
  if (targetBlob === preservedBlob) return "already-present";
  if (targetBlob === parentBlob) return parentBlob ? "clean-modify" : "clean-add";
  if (!parentBlob && targetBlob) return "add-collision";
  if (!preservedBlob && targetBlob !== parentBlob) return "delete-overlap";
  return "overlapping-change";
}

function markdown(report) {
  const lines = [
    "# JewelLink merge-delta audit",
    "",
    `Created: ${report.createdAt}`,
    `Target: \`${report.target.ref}\` at \`${report.target.commit}\``,
    `Preserved integration: \`${report.preserved.ref}\` at \`${report.preserved.commit}\``,
    `Preserved parent: \`${report.preserved.parentCommit}\``,
    `Result: ${report.pass ? "PASS" : "REVIEW REQUIRED"}`,
    "",
    "## Counts",
    "",
    ...Object.entries(report.counts).map(([name, count]) => `- ${name}: ${count}`),
    "",
    "## Paths",
    "",
    "| State | Path |",
    "| --- | --- |",
    ...report.paths.map((entry) => `| ${entry.state} | \`${entry.path}\` |`),
    "",
    "`clean-add` and `clean-modify` identify non-overlapping Git blobs, not deployment approval. UI and deployment files still follow the manual treatment in the reintegration dossier.",
  ];
  return lines.join("\n");
}

function main() {
  if (!fs.existsSync(path.join(jewelLinkRepo, "package.json"))) {
    throw new Error(`JewelLink repository not found at ${jewelLinkRepo}`);
  }
  const targetCommit = git(["rev-parse", target]);
  const preservedCommit = git(["rev-parse", preserved]);
  const parentRef = `${preservedCommit}^`;
  const parentCommit = git(["rev-parse", parentRef]);
  const changed = git(["diff-tree", "--no-commit-id", "--name-only", "-r", preservedCommit])
    .split("\n")
    .filter(Boolean);

  const paths = changed.map((file) => {
    const state = classify(blob(parentCommit, file), blob(preservedCommit, file), blob(targetCommit, file));
    console.log(`${state.toUpperCase()} ${file}`);
    return { path: file, state };
  });
  const states = ["already-present", "clean-add", "clean-modify", "overlapping-change", "add-collision", "delete-overlap"];
  const counts = Object.fromEntries(states.map((state) => [state, paths.filter((entry) => entry.state === state).length]));
  const blockingStates = new Set(["add-collision", "delete-overlap"]);
  const report = {
    createdAt: new Date().toISOString(),
    pass: paths.every((entry) => !blockingStates.has(entry.state)),
    repository: jewelLinkRepo,
    target: { ref: target, commit: targetCommit },
    preserved: { ref: preserved, commit: preservedCommit, parentCommit },
    counts,
    paths,
    safety: { worktreeMutation: false, productionMutation: false, secretsRead: false },
  };

  fs.mkdirSync(artifacts, { recursive: true });
  fs.writeFileSync(path.join(artifacts, "merge-delta-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(artifacts, "merge-delta-report.md"), `${markdown(report)}\n`);
  console.log(`Report: ${path.relative(jewelHireRepo, path.join(artifacts, "merge-delta-report.md"))}`);
  process.exitCode = report.pass ? 0 : 1;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
