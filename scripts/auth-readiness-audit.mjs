#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...valueParts] = arg.replace(/^--/, "").split("=");
    return [key, valueParts.length ? valueParts.join("=") : "1"];
  }),
);

const BASE = (args.get("base") || process.env.JEWELHIRE_AUTH_BASE_URL || "https://app.jewelhire.com").replace(/\/$/, "");
const PROJECT = args.get("project") || process.env.JEWELHIRE_GCP_PROJECT || "jewelhire-prod-20260626";
const REGION = args.get("region") || process.env.JEWELHIRE_CLOUD_RUN_REGION || "us-central1";
const SERVICE = args.get("service") || process.env.JEWELHIRE_CLOUD_RUN_SERVICE || "jewelhire";
const EXPECT_FIREBASE = args.has("expect-firebase") || process.env.JEWELHIRE_EXPECT_FIREBASE_LOGIN === "1";
const SKIP_CLOUD_SETUP = args.has("skip-cloud-setup");
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.resolve(process.cwd(), args.get("artifacts") || `docs/qa-runs/auth-readiness-${TS}`);
const checks = [];
const setup = [];

function record(name, pass, details = {}) {
  checks.push({ name, pass, ...details });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}

function recordSetup(name, pass, details = {}) {
  setup.push({ name, pass, ...details });
  record(`setup: ${name}`, pass, details);
}

function fileIncludes(file, markers) {
  const text = fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
  return markers.every((marker) => text.includes(marker));
}

async function readBody(response) {
  const text = await response.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function gcloud(args) {
  return execFileSync("gcloud", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

async function authorizedFetch(pathname) {
  const token = gcloud(["auth", "print-access-token"]);
  const response = await fetch(pathname, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-goog-user-project": PROJECT,
    },
  });
  return { response, body: await readBody(response) };
}

async function auditFirebaseSetup() {
  if (SKIP_CLOUD_SETUP) {
    recordSetup("cloud firebase setup skipped", true, { skipped: true });
    return;
  }

  const enabledServices = gcloud([
    "services",
    "list",
    "--enabled",
    "--project",
    PROJECT,
    "--format=value(config.name)",
  ]).split(/\s+/);
  recordSetup("firebase api enabled", enabledServices.includes("firebase.googleapis.com"));
  recordSetup("identity toolkit api enabled", enabledServices.includes("identitytoolkit.googleapis.com"));

  const firebaseProject = await authorizedFetch(`https://firebase.googleapis.com/v1beta1/projects/${PROJECT}`);
  recordSetup("gcp project is attached to firebase", firebaseProject.response.ok && firebaseProject.body?.projectId === PROJECT, {
    status: firebaseProject.response.status,
  });

  const webApps = await authorizedFetch(`https://firebase.googleapis.com/v1beta1/projects/${PROJECT}/webApps`);
  const apps = Array.isArray(webApps.body?.apps) ? webApps.body.apps : [];
  recordSetup("firebase web app exists", webApps.response.ok && apps.length > 0, {
    status: webApps.response.status,
    count: apps.length,
  });

  const identityConfig = await authorizedFetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`);
  const authorizedDomains = Array.isArray(identityConfig.body?.authorizedDomains) ? identityConfig.body.authorizedDomains : [];
  recordSetup("firebase auth is initialized", identityConfig.response.ok, { status: identityConfig.response.status });
  recordSetup("app domain authorized in firebase auth", authorizedDomains.includes("app.jewelhire.com"), {
    authorized: authorizedDomains.includes("app.jewelhire.com"),
  });

  const googleProvider = await authorizedFetch(`https://identitytoolkit.googleapis.com/v2/projects/${PROJECT}/defaultSupportedIdpConfigs/google.com`);
  recordSetup("firebase google provider enabled", googleProvider.response.ok && googleProvider.body?.enabled === true, {
    status: googleProvider.response.status,
    enabled: googleProvider.body?.enabled === true,
    clientId: googleProvider.body?.clientId ? "[present]" : "[missing]",
  });

  const runService = JSON.parse(
    gcloud([
      "run",
      "services",
      "describe",
      SERVICE,
      "--project",
      PROJECT,
      "--region",
      REGION,
      "--format=json",
    ]),
  );
  const env = runService?.spec?.template?.spec?.containers?.[0]?.env || [];
  const envNames = new Set(env.map((item) => item.name));
  const requiredEnv = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "FIREBASE_PROJECT_ID",
  ];
  for (const name of requiredEnv) {
    recordSetup(`cloud run env ${name} mounted`, envNames.has(name));
  }
}

async function main() {
  record("firebase verifier exists", fileIncludes("lib/server/firebase-auth.ts", ["verifyFirebaseIdToken", "securetoken@system.gserviceaccount.com"]));
  record("firebase session route exists", fileIncludes("app/api/auth/firebase/session/route.ts", ["verifyFirebaseIdToken", "setSessionCookie"]));
  record("login renders firebase button component", fileIncludes("app/(auth)/login/page.tsx", ["FirebaseGoogleButton", "firebaseClientConfig"]));
  record("login renders standard email password form", fileIncludes("app/(auth)/login/page.tsx", ["password-login-form", "/api/auth/password/session", "Sign in with email"]));
  record("password credential storage exists", fileIncludes("db/migrations/0003_password_credentials.sql", ["password_credentials", "password_hash"]));
  record("password session route exists", fileIncludes("app/api/auth/password/session/route.ts", ["loginWithPassword", "setSessionCookie"]));
  record("password login routes admins to admin panel by default", fileIncludes("app/api/auth/password/session/route.ts", ["destinationForSession", "session.role === \"admin\"", "\"/admin\""]));
  record("root dashboard redirects admin sessions", fileIncludes("app/(store)/page.tsx", ["router.replace(\"/admin\")", "session.role === \"admin\""]));
  await auditFirebaseSetup();

  const login = await fetch(`${BASE}/login`, { redirect: "manual" });
  const loginText = await login.text();
  record("live login loads", login.status === 200, { status: login.status });
  record("live login has Google sign-in", /Continue with Google|Continue with Firebase Google/i.test(loginText));
  record("live login has standard email password form", /password-login-form|Sign in with email/i.test(loginText));
  record("live firebase login visible when expected", EXPECT_FIREBASE ? loginText.includes("Continue with Firebase Google") : true, {
    expected: EXPECT_FIREBASE,
    visible: loginText.includes("Continue with Firebase Google"),
  });

  const invalidFirebase = await fetch(`${BASE}/api/auth/firebase/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken: "invalid", next: "/" }),
    redirect: "manual",
  });
  const invalidBody = await readBody(invalidFirebase);
  record("firebase invalid token rejected", invalidFirebase.status === 401 && invalidBody?.error?.code === "invalid_firebase_token", {
    status: invalidFirebase.status,
  });

  const invalidPassword = await fetch(`${BASE}/api/auth/password/session`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: "not-a-real-user@example.com", password: "wrong-password", next: "/" }),
    redirect: "manual",
  });
  const invalidPasswordLocation = invalidPassword.headers.get("location") || "";
  record("password invalid credentials rejected on public app host", invalidPassword.status === 303 && invalidPasswordLocation.startsWith(`${BASE}/login`), {
    status: invalidPassword.status,
    location: invalidPasswordLocation ? invalidPasswordLocation.replace(/error=[^&]+/, "error=[redacted]") : "",
  });

  const failures = checks.filter((check) => !check.pass);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "auth-readiness-report.json"), JSON.stringify({ base: BASE, project: PROJECT, createdAt: new Date().toISOString(), checks, setup }, null, 2));
  fs.writeFileSync(
    path.join(OUT, "auth-readiness-report.md"),
    [
      "# Auth Readiness Audit",
      "",
      `Base: ${BASE}`,
      `Google Cloud project: ${PROJECT}`,
      `Created: ${new Date().toISOString()}`,
      `Failures: ${failures.length}`,
      "",
      ...checks.map((check) => `- ${check.pass ? "PASS" : "FAIL"} ${check.name}`),
      "",
      "Firebase/GCP setup values are reported as present/missing only; no secret or API key values are written.",
    ].join("\n"),
  );
  console.log(`Report: ${path.relative(process.cwd(), OUT)}/auth-readiness-report.md`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
