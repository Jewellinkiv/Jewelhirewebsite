#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

if (args.has("help")) {
  console.log(`Usage: node scripts/production-operations-readiness-audit.mjs [options]

Checks non-secret production operations evidence for the JewelHire/JewelLink
pilot. Exits non-zero until backup, rollback, and monitoring evidence is
complete enough for a controlled pilot.

Options:
  --artifacts=<dir>                         Report output directory
  --fixture-dir=<dir>                       Read fixture JSON instead of gcloud
  --jewelhire-project=<id>                  Default: jewelhire-prod-20260626
  --jewelhire-region=<region>               Default: us-central1
  --jewelhire-service=<name>                Default: jewelhire
  --jewelhire-db-secret=<name>              Default: jewelhire-database-url
  --jewellink-project=<id>                  Default: academy-460316
  --jewellink-region=<region>               Default: us-central1
  --jewellink-service=<name>                Default: jewellink-dev
  --jewellink-db-secret=<name>              Default: DATABASE_URL
  --expected-jewellink-health-job=<name>    Default: jewellink-jewelhire-integration-health
  --jewelhire-backup-method=<method>        provider-snapshot, pitr, or encrypted-logical
  --jewellink-backup-method=<method>        provider-snapshot, pitr, or encrypted-logical
  --jewelhire-backup-id=<id>                Provider backup/snapshot/logical artifact ID
  --jewellink-backup-id=<id>                Provider backup/snapshot/logical artifact ID
  --jewelhire-backup-completed-at=<iso>     Backup/snapshot/logical dump completion timestamp
  --jewellink-backup-completed-at=<iso>     Backup/snapshot/logical dump completion timestamp
  --jewelhire-backup-verified-at=<iso>      Backup list/restore verification timestamp
  --jewellink-backup-verified-at=<iso>      Backup list/restore verification timestamp
  --jewelhire-backup-retention=<summary>    Non-secret PITR/retention evidence summary
  --jewellink-backup-retention=<summary>    Non-secret PITR/retention evidence summary
  --jewelhire-backup-restore-evidence=<id>  Non-secret restore/list/drill evidence
  --jewellink-backup-restore-evidence=<id>  Non-secret restore/list/drill evidence
  --jewelhire-logical-backup-sha256=<hex>   Required when method is encrypted-logical
  --jewellink-logical-backup-sha256=<hex>   Required when method is encrypted-logical
  --jewelhire-rollback-owner=<name/channel>
  --jewellink-rollback-owner=<name/channel>
  --jewellink-iam-rollback-owner=<name/channel>
  --database-recovery-owner=<name/channel>
  --monitoring-channel=<channel/link>
  --observation-window=<start/end UTC>
  --rollback-thresholds=<summary>
`);
  process.exit(0);
}

const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/operations-readiness-${TS}`);
const FIXTURE_DIR = args.get("fixture-dir") ? path.resolve(process.cwd(), args.get("fixture-dir")) : "";

const products = {
  jewelhire: {
    label: "JewelHire",
    project: args.get("jewelhire-project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626",
    region: args.get("jewelhire-region") || process.env.JEWELHIRE_CLOUD_RUN_REGION || "us-central1",
    service: args.get("jewelhire-service") || process.env.JEWELHIRE_CLOUD_RUN_SERVICE || "jewelhire",
    databaseSecret: args.get("jewelhire-db-secret") || process.env.JEWELHIRE_DATABASE_SECRET || "jewelhire-database-url",
    fixturePrefix: "jewelhire",
  },
  jewellink: {
    label: "JewelLink",
    project: args.get("jewellink-project") || process.env.JEWELLINK_GCP_PROJECT || "academy-460316",
    region: args.get("jewellink-region") || process.env.JEWELLINK_CLOUD_RUN_REGION || "us-central1",
    service: args.get("jewellink-service") || process.env.JEWELLINK_CLOUD_RUN_SERVICE || "jewellink-dev",
    databaseSecret: args.get("jewellink-db-secret") || process.env.JEWELLINK_DATABASE_SECRET || "DATABASE_URL",
    fixturePrefix: "jewellink",
  },
};

const expectedJewelLinkHealthJob =
  args.get("expected-jewellink-health-job") ||
  process.env.JEWELLINK_JEWELHIRE_HEALTH_JOB ||
  "jewellink-jewelhire-integration-health";

const checks = [];

function option(name, envName = "") {
  return args.get(name) || (envName ? process.env[envName] : "") || "";
}

const declaredEvidence = {
  backups: {
    jewelhire: {
      method: option("jewelhire-backup-method", "JEWELHIRE_BACKUP_METHOD"),
      id: option("jewelhire-backup-id", "JEWELHIRE_BACKUP_ID"),
      completedAt: option("jewelhire-backup-completed-at", "JEWELHIRE_BACKUP_COMPLETED_AT"),
      verifiedAt: option("jewelhire-backup-verified-at", "JEWELHIRE_BACKUP_VERIFIED_AT"),
      retention: option("jewelhire-backup-retention", "JEWELHIRE_BACKUP_RETENTION"),
      restoreEvidence: option("jewelhire-backup-restore-evidence", "JEWELHIRE_BACKUP_RESTORE_EVIDENCE"),
      logicalSha256: option("jewelhire-logical-backup-sha256", "JEWELHIRE_LOGICAL_BACKUP_SHA256"),
    },
    jewellink: {
      method: option("jewellink-backup-method", "JEWELLINK_BACKUP_METHOD"),
      id: option("jewellink-backup-id", "JEWELLINK_BACKUP_ID"),
      completedAt: option("jewellink-backup-completed-at", "JEWELLINK_BACKUP_COMPLETED_AT"),
      verifiedAt: option("jewellink-backup-verified-at", "JEWELLINK_BACKUP_VERIFIED_AT"),
      retention: option("jewellink-backup-retention", "JEWELLINK_BACKUP_RETENTION"),
      restoreEvidence: option("jewellink-backup-restore-evidence", "JEWELLINK_BACKUP_RESTORE_EVIDENCE"),
      logicalSha256: option("jewellink-logical-backup-sha256", "JEWELLINK_LOGICAL_BACKUP_SHA256"),
    },
  },
  rollback: {
    jewelhireOwner: option("jewelhire-rollback-owner", "JEWELHIRE_ROLLBACK_OWNER"),
    jewellinkOwner: option("jewellink-rollback-owner", "JEWELLINK_ROLLBACK_OWNER"),
    jewellinkIamOwner: option("jewellink-iam-rollback-owner", "JEWELLINK_IAM_ROLLBACK_OWNER"),
    databaseRecoveryOwner: option("database-recovery-owner", "DATABASE_RECOVERY_OWNER"),
    observationWindow: option("observation-window", "OBSERVATION_WINDOW"),
    rollbackThresholds: option("rollback-thresholds", "ROLLBACK_THRESHOLDS"),
  },
  monitoring: {
    channel: option("monitoring-channel", "MONITORING_CHANNEL"),
  },
};

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details, valuesPrinted: false });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function fixtureJson(file, fallback = null) {
  if (!FIXTURE_DIR) return fallback;
  const fullPath = path.join(FIXTURE_DIR, file);
  if (!fs.existsSync(fullPath)) return fallback;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function fixtureSecrets() {
  return fixtureJson("secrets.json", {});
}

function sanitizeError(text) {
  return String(text || "")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/g, "Bearer [redacted]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/password=\S+/gi, "password=[redacted]")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

function commandAvailable(command) {
  if (FIXTURE_DIR) return true;
  return spawnSync(command, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).status === 0;
}

function gcloudJson(commandArgs) {
  if (!commandAvailable("gcloud")) {
    return { ok: false, data: null, error: "gcloud is not available" };
  }
  const result = spawnSync("gcloud", [...commandArgs, "--quiet"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1" },
  });
  if (result.status !== 0) {
    return { ok: false, data: null, error: sanitizeError(result.stderr || result.stdout) };
  }
  try {
    return { ok: true, data: result.stdout.trim() ? JSON.parse(result.stdout) : null, error: "" };
  } catch (error) {
    return { ok: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function gcloudText(commandArgs) {
  if (!commandAvailable("gcloud")) {
    return { ok: false, value: "", error: "gcloud is not available" };
  }
  const result = spawnSync("gcloud", [...commandArgs, "--quiet"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1" },
  });
  if (result.status !== 0) {
    return { ok: false, value: "", error: sanitizeError(result.stderr || result.stdout) };
  }
  return { ok: true, value: result.stdout.trim(), error: "" };
}

function serviceJson(product) {
  if (FIXTURE_DIR) return { ok: true, data: fixtureJson(`${product.fixturePrefix}-service.json`, {}) };
  return gcloudJson([
    "run",
    "services",
    "describe",
    product.service,
    "--project",
    product.project,
    "--region",
    product.region,
    "--format=json(metadata.name,status.url,status.traffic,status.latestReadyRevisionName,status.latestCreatedRevisionName,spec.template.spec.containers.image)",
  ]);
}

function schedulerJobs(product) {
  if (FIXTURE_DIR) return { ok: true, data: fixtureJson(`${product.fixturePrefix}-scheduler-jobs.json`, []) };
  return gcloudJson([
    "scheduler",
    "jobs",
    "list",
    "--project",
    product.project,
    "--location",
    product.region,
    "--format=json(name,state,schedule,timeZone,lastAttemptTime,status.code,httpTarget.uri,httpTarget.httpMethod,userUpdateTime,attemptDeadline)",
  ]);
}

function monitoringPolicies(product) {
  if (FIXTURE_DIR) return { ok: true, data: fixtureJson(`${product.fixturePrefix}-monitoring-policies.json`, []) };
  return gcloudJson([
    "monitoring",
    "policies",
    "list",
    "--project",
    product.project,
    "--format=json(name,displayName,enabled,notificationChannels,conditions.displayName)",
  ]);
}

function loggingMetrics(product) {
  if (FIXTURE_DIR) return { ok: true, data: fixtureJson(`${product.fixturePrefix}-logging-metrics.json`, []) };
  return gcloudJson([
    "logging",
    "metrics",
    "list",
    "--project",
    product.project,
    "--format=json(name,description,metricDescriptor.type)",
  ]);
}

function confirmedUnavailable(error) {
  return /SERVICE_DISABLED|has not been used|disabled/i.test(error || "");
}

function cloudSqlInstances(product) {
  if (FIXTURE_DIR) return { ok: true, data: fixtureJson(`${product.fixturePrefix}-cloud-sql-instances.json`, []) };
  return gcloudJson([
    "sql",
    "instances",
    "list",
    "--project",
    product.project,
    "--format=json(name,databaseVersion,state,region)",
  ]);
}

function databaseUrl(product) {
  if (FIXTURE_DIR) {
    const secrets = fixtureSecrets();
    const candidates = [
      `${product.project}/${product.databaseSecret}`,
      `${product.project}/${product.databaseSecret}/latest`,
      product.databaseSecret,
    ];
    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(secrets, key)) {
        return { ok: true, value: String(secrets[key]), error: "" };
      }
    }
    return { ok: false, value: "", error: `Fixture secret not found for ${product.databaseSecret}` };
  }
  return gcloudText([
    "secrets",
    "versions",
    "access",
    "latest",
    `--secret=${product.databaseSecret}`,
    `--project=${product.project}`,
  ]);
}

function trafficSummary(service) {
  const traffic = service?.status?.traffic || [];
  return traffic
    .filter((item) => Number(item.percent || 0) > 0)
    .map((item) => ({
      revisionName: item.revisionName || null,
      tag: item.tag || null,
      percent: Number(item.percent || 0),
      latestRevision: Boolean(item.latestRevision),
    }));
}

function imageSummary(service) {
  const images = service?.spec?.template?.spec?.containers?.map((container) => container.image).filter(Boolean) || [];
  return images.map((image) => {
    const digestMatch = image.match(/@sha256:([a-f0-9]+)/i);
    return {
      digest: digestMatch ? `sha256:${digestMatch[1]}` : "",
      imageRef: digestMatch ? image.slice(0, image.indexOf("@sha256:")) : image,
    };
  });
}

function safeJob(job) {
  return {
    name: String(job.name || "").split("/").pop(),
    state: job.state || "",
    schedule: job.schedule || "",
    timeZone: job.timeZone || "",
    lastAttemptTime: job.lastAttemptTime || "",
    statusCode: job.status?.code ?? null,
    method: job.httpTarget?.httpMethod || "",
    uriPath: safeUriPath(job.httpTarget?.uri || ""),
  };
}

function safeUriPath(rawUri) {
  try {
    const url = new URL(rawUri);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return "";
  }
}

function findJob(jobs, expectedName) {
  return jobs.find((job) => String(job.name || "").split("/").pop() === expectedName);
}

function policySummary(policies) {
  return policies.map((policy) => ({
    name: String(policy.name || "").split("/").pop(),
    displayName: policy.displayName || "",
    enabled: policy.enabled !== false,
    conditionCount: Array.isArray(policy.conditions) ? policy.conditions.length : 0,
    notificationChannels: Array.isArray(policy.notificationChannels)
      ? policy.notificationChannels.map((channel) => String(channel || "").split("/").pop()).filter(Boolean)
      : [],
  }));
}

function enabledPoliciesWithChannels(policies) {
  return policies.filter((policy) => policy.enabled && policy.notificationChannels.length > 0);
}

function metricSummary(metrics) {
  return metrics.map((metric) => ({
    name: metric.name || "",
    description: metric.description || "",
    type: metric.metricDescriptor?.type || "",
  }));
}

function cloudSqlSummary(instances) {
  return instances.map((instance) => ({
    name: instance.name || "",
    databaseVersion: instance.databaseVersion || "",
    state: instance.state || "",
    region: instance.region || "",
  }));
}

function databaseTarget(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return {
      host: url.hostname,
      database: url.pathname.replace(/^\//, "") || "postgres",
      providerHint: url.hostname.endsWith("pg.psdb.cloud") ? "external Postgres on pg.psdb.cloud" : "Postgres",
    };
  } catch {
    return { host: "", database: "", providerHint: "unparsed" };
  }
}

function isoLike(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
}

function validBackupMethod(value) {
  return ["provider-snapshot", "pitr", "encrypted-logical"].includes(String(value || "").trim());
}

function sha256Like(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || "").trim());
}

function checkBackupEvidence(label, backup) {
  const method = String(backup.method || "").trim();
  const logicalBackup = method === "encrypted-logical";
  record(`${label} backup method is recorded`, validBackupMethod(method), {
    method: validBackupMethod(method) ? method : "",
  });
  record(`${label} backup identifier is recorded`, Boolean(backup.id.trim()), {
    backupIdRecorded: Boolean(backup.id.trim()),
  });
  record(`${label} backup completion timestamp is recorded`, isoLike(backup.completedAt.trim()), {
    backupCompletedAtRecorded: Boolean(backup.completedAt.trim()),
  });
  record(`${label} backup verification timestamp is recorded`, isoLike(backup.verifiedAt.trim()), {
    backupVerifiedAtRecorded: Boolean(backup.verifiedAt.trim()),
  });
  record(`${label} PITR or retention evidence is recorded`, Boolean(backup.retention.trim()), {
    retentionEvidenceRecorded: Boolean(backup.retention.trim()),
  });
  record(`${label} restore/list verification evidence is recorded`, Boolean(backup.restoreEvidence.trim()), {
    restoreEvidenceRecorded: Boolean(backup.restoreEvidence.trim()),
  });
  record(`${label} encrypted logical backup SHA-256 is recorded when required`, !logicalBackup || sha256Like(backup.logicalSha256), {
    logicalBackup,
    sha256Recorded: sha256Like(backup.logicalSha256),
  });
  return {
    method: validBackupMethod(method) ? method : "",
    backupIdRecorded: Boolean(backup.id.trim()),
    completedAt: isoLike(backup.completedAt.trim()) ? backup.completedAt.trim() : "",
    verifiedAt: isoLike(backup.verifiedAt.trim()) ? backup.verifiedAt.trim() : "",
    retentionEvidenceRecorded: Boolean(backup.retention.trim()),
    restoreEvidenceRecorded: Boolean(backup.restoreEvidence.trim()),
    logicalSha256Recorded: sha256Like(backup.logicalSha256),
  };
}

function buildProductEvidence(productKey, product) {
  const serviceResult = serviceJson(product);
  const service = serviceResult.data || {};
  const liveTraffic = trafficSummary(service);
  const serviceReadable = serviceResult.ok && Boolean(service?.metadata?.name || service?.status);
  const oneLiveRevision = liveTraffic.length === 1 && liveTraffic[0].percent === 100;

  record(`${product.label} Cloud Run service metadata is readable`, serviceReadable, {
    project: product.project,
    region: product.region,
    service: product.service,
    error: serviceResult.ok ? "" : serviceResult.error,
  });
  record(`${product.label} Cloud Run has a single 100% live revision`, oneLiveRevision, {
    liveTraffic,
  });

  const dbResult = databaseUrl(product);
  const target = dbResult.ok ? databaseTarget(dbResult.value) : { host: "", database: "", providerHint: "" };
  record(`${product.label} production database credential is readable for host discovery`, dbResult.ok, {
    error: dbResult.ok ? "" : dbResult.error,
  });
  record(`${product.label} production database target is identified without exposing credentials`, Boolean(target.host), {
    target,
  });

  const schedulerResult = schedulerJobs(product);
  const safeJobs = (schedulerResult.data || []).map(safeJob);
  record(`${product.label} Cloud Scheduler metadata is readable or confirmed unavailable`, schedulerResult.ok || confirmedUnavailable(schedulerResult.error), {
    jobCount: safeJobs.length,
    error: schedulerResult.ok ? "" : schedulerResult.error,
  });

  const policiesResult = monitoringPolicies(product);
  const policies = policySummary(policiesResult.data || []);
  record(`${product.label} Cloud Monitoring alert policies are readable`, policiesResult.ok, {
    policyCount: policies.length,
    error: policiesResult.ok ? "" : policiesResult.error,
  });
  record(`${product.label} has at least one enabled monitoring alert policy`, policies.some((policy) => policy.enabled), {
    policyCount: policies.length,
  });
  const policiesWithChannels = enabledPoliciesWithChannels(policies);
  record(`${product.label} enabled monitoring alert policy has notification channel`, policiesWithChannels.length > 0, {
    policyCount: policies.length,
    policyWithChannelCount: policiesWithChannels.length,
  });

  const metricsResult = loggingMetrics(product);
  const metrics = metricSummary(metricsResult.data || []);
  record(`${product.label} Cloud Logging metric metadata is readable`, metricsResult.ok, {
    metricCount: metrics.length,
    error: metricsResult.ok ? "" : metricsResult.error,
  });

  const cloudSqlResult = cloudSqlInstances(product);
  const cloudSql = cloudSqlSummary(cloudSqlResult.data || []);
  record(`${product.label} Cloud SQL metadata is readable or confirmed unavailable`, cloudSqlResult.ok || confirmedUnavailable(cloudSqlResult.error), {
    instanceCount: cloudSql.length,
    error: cloudSqlResult.ok ? "" : cloudSqlResult.error,
  });

  const backup = checkBackupEvidence(product.label, declaredEvidence.backups[productKey]);

  return {
    project: product.project,
    region: product.region,
    service: product.service,
    serviceUrl: service?.status?.url || "",
    latestReadyRevision: service?.status?.latestReadyRevisionName || service?.status?.latestCreatedRevisionName || "",
    liveTraffic,
    images: imageSummary(service),
    databaseTarget: target,
    scheduler: {
      readable: schedulerResult.ok,
      jobs: safeJobs,
    },
    monitoring: {
      policies,
      loggingMetrics: metrics,
    },
    cloudSql,
    backup,
  };
}

function checkJewelLinkHealthScheduler(jewellinkEvidence) {
  const job = findJob(jewellinkEvidence.scheduler.jobs, expectedJewelLinkHealthJob);
  record("JewelLink JewelHire integration health scheduler job exists", Boolean(job), {
    expectedJob: expectedJewelLinkHealthJob,
  });
  record("JewelLink JewelHire integration health scheduler job is enabled", job?.state === "ENABLED", {
    expectedJob: expectedJewelLinkHealthJob,
    state: job?.state || "",
  });
  record("JewelLink JewelHire integration health scheduler targets the health endpoint", /\/api\/cron\/jewelhire-integration-health$/.test(job?.uriPath || ""), {
    expectedJob: expectedJewelLinkHealthJob,
    uriPath: job?.uriPath || "",
  });
  return job || null;
}

function checkDeclaredOperationsEvidence({ jewelhire, jewellink }) {
  const attachedMonitoringChannels =
    enabledPoliciesWithChannels(jewelhire.monitoring.policies).length > 0 &&
    enabledPoliciesWithChannels(jewellink.monitoring.policies).length > 0;
  record("Monitoring channel is recorded or attached to enabled alert policies", Boolean(declaredEvidence.monitoring.channel.trim()) || attachedMonitoringChannels, {
    declaredChannelRecorded: Boolean(declaredEvidence.monitoring.channel.trim()),
    attachedMonitoringChannels,
  });
  record("JewelHire rollback owner is recorded", Boolean(declaredEvidence.rollback.jewelhireOwner.trim()));
  record("JewelLink rollback owner is recorded", Boolean(declaredEvidence.rollback.jewellinkOwner.trim()));
  record("JewelLink IAM rollback owner is recorded", Boolean(declaredEvidence.rollback.jewellinkIamOwner.trim()));
  record("Database recovery owner is recorded", Boolean(declaredEvidence.rollback.databaseRecoveryOwner.trim()));
  record("Observation window is recorded", Boolean(declaredEvidence.rollback.observationWindow.trim()));
  record("Immediate rollback thresholds are recorded", Boolean(declaredEvidence.rollback.rollbackThresholds.trim()));
}

function markdown(report) {
  const lines = [
    "# Production Operations Readiness Audit",
    "",
    `Created: ${report.createdAt}`,
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    `Values printed: ${report.valuesPrinted}`,
    "",
    "## Runtime Rollback Targets",
    "",
  ];
  for (const [key, product] of Object.entries(report.products)) {
    lines.push(
      `### ${key === "jewelhire" ? "JewelHire" : "JewelLink"}`,
      "",
      `- Project/service: ${product.project}/${product.service}`,
      `- Latest ready revision: ${product.latestReadyRevision || "unavailable"}`,
      `- Live traffic: ${product.liveTraffic.map((item) => `${item.revisionName || "latest"} ${item.percent}%`).join(", ") || "unavailable"}`,
      `- Database host: ${product.databaseTarget.host || "unavailable"}`,
      `- Database provider hint: ${product.databaseTarget.providerHint || "unavailable"}`,
      `- Backup method: ${product.backup.method || "missing"}`,
      `- Backup ID recorded: ${product.backup.backupIdRecorded ? "yes" : "no"}`,
      `- Backup completed at: ${product.backup.completedAt || "missing"}`,
      `- Backup verified at: ${product.backup.verifiedAt || "missing"}`,
      `- PITR/retention evidence recorded: ${product.backup.retentionEvidenceRecorded ? "yes" : "no"}`,
      `- Restore/list evidence recorded: ${product.backup.restoreEvidenceRecorded ? "yes" : "no"}`,
      `- Logical SHA-256 recorded: ${product.backup.logicalSha256Recorded ? "yes" : "no"}`,
      `- Alert policies: ${product.monitoring.policies.length}`,
      `- Enabled policies with notification channels: ${enabledPoliciesWithChannels(product.monitoring.policies).length}`,
      `- Logging metrics: ${product.monitoring.loggingMetrics.length}`,
      `- Scheduler jobs readable: ${product.scheduler.readable ? "yes" : "no"}`,
      "",
    );
  }
  lines.push(
    "## JewelLink Integration Health Scheduler",
    "",
    `- Expected job: ${report.expectedJewelLinkHealthJob}`,
    `- Found: ${report.jewelLinkHealthJob ? "yes" : "no"}`,
    `- State: ${report.jewelLinkHealthJob?.state || "missing"}`,
    `- Target path: ${report.jewelLinkHealthJob?.uriPath || "missing"}`,
    "",
    "## Declared Operations Evidence",
    "",
    `- Monitoring channel recorded or attached: ${report.declaredEvidence.monitoring.channel ? "yes" : "no"}`,
    `- JewelHire rollback owner recorded: ${report.declaredEvidence.rollback.jewelhireOwner ? "yes" : "no"}`,
    `- JewelLink rollback owner recorded: ${report.declaredEvidence.rollback.jewellinkOwner ? "yes" : "no"}`,
    `- JewelLink IAM rollback owner recorded: ${report.declaredEvidence.rollback.jewellinkIamOwner ? "yes" : "no"}`,
    `- Database recovery owner recorded: ${report.declaredEvidence.rollback.databaseRecoveryOwner ? "yes" : "no"}`,
    `- Observation window recorded: ${report.declaredEvidence.rollback.observationWindow ? "yes" : "no"}`,
    `- Rollback thresholds recorded: ${report.declaredEvidence.rollback.rollbackThresholds ? "yes" : "no"}`,
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
    "",
    "No database URLs, bearer tokens, passwords, cookies, customer data, or secret values are written to this report.",
  );
  return lines.join("\n");
}

function main() {
  const jewelhire = buildProductEvidence("jewelhire", products.jewelhire);
  const jewellink = buildProductEvidence("jewellink", products.jewellink);
  const jewelLinkHealthJob = checkJewelLinkHealthScheduler(jewellink);
  checkDeclaredOperationsEvidence({ jewelhire, jewellink });

  const failures = checks.filter((check) => !check.pass);
  const report = {
    createdAt: new Date().toISOString(),
    pass: failures.length === 0,
    failures: failures.length,
    valuesPrinted: false,
    expectedJewelLinkHealthJob,
    declaredEvidence: {
      backups: {
        jewelhire: {
          method: validBackupMethod(declaredEvidence.backups.jewelhire.method),
          backupIdRecorded: Boolean(declaredEvidence.backups.jewelhire.id.trim()),
          completedAt: isoLike(declaredEvidence.backups.jewelhire.completedAt.trim()),
          verifiedAt: isoLike(declaredEvidence.backups.jewelhire.verifiedAt.trim()),
          retentionEvidenceRecorded: Boolean(declaredEvidence.backups.jewelhire.retention.trim()),
          restoreEvidenceRecorded: Boolean(declaredEvidence.backups.jewelhire.restoreEvidence.trim()),
          logicalSha256Recorded: sha256Like(declaredEvidence.backups.jewelhire.logicalSha256),
        },
        jewellink: {
          method: validBackupMethod(declaredEvidence.backups.jewellink.method),
          backupIdRecorded: Boolean(declaredEvidence.backups.jewellink.id.trim()),
          completedAt: isoLike(declaredEvidence.backups.jewellink.completedAt.trim()),
          verifiedAt: isoLike(declaredEvidence.backups.jewellink.verifiedAt.trim()),
          retentionEvidenceRecorded: Boolean(declaredEvidence.backups.jewellink.retention.trim()),
          restoreEvidenceRecorded: Boolean(declaredEvidence.backups.jewellink.restoreEvidence.trim()),
          logicalSha256Recorded: sha256Like(declaredEvidence.backups.jewellink.logicalSha256),
        },
      },
      rollback: Object.fromEntries(
        Object.entries(declaredEvidence.rollback).map(([key, value]) => [key, Boolean(String(value).trim())]),
      ),
      monitoring: {
        channel:
          Boolean(declaredEvidence.monitoring.channel.trim()) ||
          (enabledPoliciesWithChannels(jewelhire.monitoring.policies).length > 0 &&
            enabledPoliciesWithChannels(jewellink.monitoring.policies).length > 0),
      },
    },
    products: { jewelhire, jewellink },
    jewelLinkHealthJob,
    checks,
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "operations-readiness-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "operations-readiness-report.md"), `${markdown(report)}\n`);
  console.log(`Report: ${path.relative(process.cwd(), path.join(OUT, "operations-readiness-report.md"))}`);
  process.exit(report.pass ? 0 : 1);
}

main();
