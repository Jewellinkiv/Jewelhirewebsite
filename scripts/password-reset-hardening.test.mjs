#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const passwordAuth = read("lib/server/password-auth.ts");
const actionTokens = read("lib/server/action-tokens.ts");
const resetRoute = read("app/api/auth/password/reset/route.ts");
const resetRequestRoute = read("app/api/auth/password/reset-request/route.ts");
const resetRequestService = read("lib/server/password-reset-request.ts");
const passwordSessionRoute = read("app/api/auth/password/session/route.ts");
const resetPage = read("app/(auth)/reset-password/page.tsx");
const forgotPage = read("app/(auth)/forgot-password/page.tsx");
const auth = read("lib/server/auth.ts");
const accessControl = read("lib/server/access-control.ts");
const nativeEpochMigration = read("db/migrations/0021_native_auth_epoch.sql");
const deliveryStateMigration = read("db/migrations/0022_password_reset_delivery_state.sql");
const operatorPassword = read("scripts/ops-password-credential.mjs");
const postgresReadiness = read("lib/server/postgres-readiness.ts");
const readinessScript = read("scripts/check-database-readiness.mjs");
const migrationRunner = read("scripts/run-migrations.mjs");

test("password reset validates cheaply, hashes before locks, and commits credential plus token atomically", () => {
  const completion = passwordAuth.slice(
    passwordAuth.indexOf("export async function completePasswordReset"),
    passwordAuth.indexOf("export type StandaloneAccountClaimResult"),
  );
  const markers = [
    "const preflightResult",
    "const passwordHash = await hashPassword(input.password)",
    'client.query("begin")',
    "from users",
    "for update",
    "for update of token",
    "insert into password_credentials",
    "set native_auth_epoch = native_auth_epoch + 1",
    "update auth_action_tokens",
    'client.query("commit")',
  ];
  let prior = -1;
  for (const marker of markers) {
    const index = completion.indexOf(marker, prior + 1);
    assert.ok(index > prior, `expected ${marker} after the prior reset marker`);
    prior = index;
  }
  assert.match(actionTokens, /\^pr2_\[A-Za-z0-9_-\]\{43\}\$/);
  assert.match(actionTokens, /input\.purpose === "password_reset" \? `pr2_\$\{entropy\}` : `ac2_\$\{entropy\}`/);
  assert.doesNotMatch(actionTokens, /export async function consumeActionToken/);
  assert.match(completion, /currentUser\.native_auth_enabled/);
  assert.match(completion, /isConfiguredAdminEmail\(reset\.token_email\)/);
  assert.match(completion, /currentUser\.email_normalized !== reset\.token_email/);
  assert.match(completion, /consumed\.rows\.some\(\(row\) => row\.id === reset\.id\)/);
  assert.match(completion, /Password reset could not advance the native session epoch/);
  assert.ok(completion.indexOf("isConfiguredAdminEmail(reset.token_email)") > completion.indexOf("for update of token"));
});

test("reset request is uniform, bounded, mailbox-throttled, and failure-aware", () => {
  assert.match(resetRequestRoute, /import \{ after \} from "next\/server"/);
  assert.match(resetRequestRoute, /handlePasswordResetRequest\(request, \(task\) => after\(task\)\)/);
  assert.match(resetRequestService, /MAX_REQUEST_BODY_BYTES = 4_096/);
  assert.match(resetRequestService, /MAX_EMAIL_LENGTH = 254/);
  assert.match(resetRequestService, /email\.length > MAX_EMAIL_LENGTH \|\| !validEmail\(email\)/);
  assert.match(forgotPage, /maxLength=\{254\}/);
  assert.match(resetRequestService, /RESET_REQUESTS_PER_EMAIL_PER_HOUR = 3/);
  assert.match(resetRequestService, /createHmac\("sha256", authSecret\(\)\)/);
  assert.doesNotMatch(resetRequestService, /`reset-request-email:\$\{email\}`/);
  assert.match(resetRequestService, /NEUTRAL_RESPONSE_MINIMUM_MS = 600/);
  assert.match(resetRequestService, /randomInt\(NEUTRAL_RESPONSE_JITTER_MS \+ 1\)/);
  assert.match(resetRequestService, /return neutralResponse\(notBefore\)/);
  assert.match(resetRequestService, /\{ ok: true \}/);
  assert.match(resetRequestService, /"Cache-Control": "no-store"/);

  const handler = resetRequestService.slice(resetRequestService.indexOf("export async function handlePasswordResetRequest"));
  assert.ok(handler.indexOf("rateLimit(`reset-request:") < handler.indexOf("readBoundedJson(request)"));
  assert.match(handler, /scheduleAfterResponse\(\(\) => processPasswordResetRequest/);
  assert.doesNotMatch(handler, /await findActiveUserByEmail|await notifyPasswordReset|await preparePasswordResetTokenReplacement/);
  assert.match(actionTokens, /preparePasswordResetTokenReplacement/);
  assert.match(actionTokens, /finalizePasswordResetTokenReplacement/);
  assert.match(actionTokens, /delivery_state = 'superseded'/);
  assert.match(actionTokens, /max\(created_at\) \+ interval '1 microsecond'/);
  assert.match(actionTokens, /\(newer\.created_at, newer\.id\) > \(candidate\.created_at, candidate\.id\)/);
  assert.match(actionTokens, /\(older\.created_at, older\.id\) < \(candidate\.created_at, candidate\.id\)/);
  assert.doesNotMatch(actionTokens, /created_at: Date/);
  assert.doesNotMatch(actionTokens, /\$2::timestamptz/);
  assert.match(deliveryStateMigration, /delivery_state in \('pending', 'active', 'rejected', 'superseded'\)/);
  assert.match(deliveryStateMigration, /purpose = 'account_claim'/);
  assert.match(deliveryStateMigration, /auth_action_tokens_pending_reset_delivery_idx/);
});

test("native cookies carry a durable epoch while JewelLink SSO remains epoch-independent", () => {
  assert.match(nativeEpochMigration, /add column if not exists native_auth_epoch integer not null default 0/);
  assert.match(nativeEpochMigration, /users_native_auth_epoch_nonnegative_check/);
  assert.match(postgresReadiness, /schemaInvariants\.nativeAuthEpoch\.ready/);
  assert.match(postgresReadiness, /0021_native_auth_epoch/);
  assert.match(postgresReadiness, /0022_password_reset_delivery_state/);
  assert.match(postgresReadiness, /passwordResetDeliveryState\.ready/);
  assert.match(readinessScript, /native auth epoch:/);
  assert.match(readinessScript, /password reset delivery state:/);
  assert.match(readinessScript, /!nativeEpochReady/);
  assert.match(readinessScript, /!deliveryStateReady/);
  assert.match(auth, /nativeAuthEpoch\?: number/);
  assert.match(auth, /Number\.isSafeInteger\(session\.nativeAuthEpoch\)/);
  assert.match(auth, /session\.authSource === "jewellink_sso"[\s\S]*session\.nativeAuthEpoch !== undefined/);
  assert.match(auth, /u\.native_auth_epoch/);
  assert.match(auth, /expectedNativeAuthEpoch: session\.nativeAuthEpoch/);
  assert.match(auth, /findSessionForVerifiedNativeCredential/);
  assert.match(passwordAuth, /nativeAuthEpoch: row\.native_auth_epoch/);
  assert.match(passwordAuth, /native_auth_epoch = u\.native_auth_epoch \+ 1/);
  const standalonePasswordWrite = passwordAuth.slice(
    passwordAuth.indexOf("export async function setPassword"),
    passwordAuth.indexOf("export async function findActiveUserByEmail"),
  );
  assert.match(standalonePasswordWrite, /select id, native_auth_epoch from users where id = \$1 for update/);
  assert.match(standalonePasswordWrite, /native_auth_epoch = native_auth_epoch \+ 1/);
  assert.match(standalonePasswordWrite, /returning native_auth_epoch/);
  assert.match(operatorPassword, /for update/);
  assert.match(operatorPassword, /native_auth_epoch = native_auth_epoch \+ 1/);
  assert.match(operatorPassword, /purpose in \('password_reset', 'account_claim'\)/);
  assert.match(standalonePasswordWrite, /purpose in \('password_reset', 'account_claim'\)/);
  assert.match(
    accessControl,
    /export type SessionContext = Omit<[\s\S]*"version" \| "exp" \| "nativeAuthEpoch" \| "upstreamAssurance"[\s\S]*upstreamUserId\?: string/,
  );
  assert.match(accessControl, /nativeAuthEpoch: _nativeAuthEpoch/);
  assert.match(accessControl, /browserSessionContext[\s\S]*upstreamUserId: _upstreamUserId/);
});

test("native login equalizes KDF work and bounds the body before parsing", () => {
  const login = passwordAuth.slice(
    passwordAuth.indexOf("export async function loginWithPassword"),
    passwordAuth.indexOf("export async function setPassword"),
  );
  assert.match(passwordAuth, /const dummyPasswordHash = "scrypt\$1\$16384\$8\$1\$/);
  assert.match(login, /storedHashIsSupported \? row!\.password_hash : dummyPasswordHash/);
  assert.ok(login.indexOf("await verifyPassword") < login.indexOf("if (!row || !storedHashIsSupported || !passwordMatches)"));
  assert.doesNotMatch(login, /!row \|\| !\(await verifyPassword/);
  assert.match(passwordAuth, /stored\.length > 256/);
  assert.match(passwordAuth, /n !== String\(passwordParams\.N\)/);
  assert.match(passwordAuth, /\^\[A-Za-z0-9_-\]\{16,64\}\$/);
  assert.match(passwordAuth, /\^\[A-Za-z0-9_-\]\{86\}\$/);
  assert.match(passwordAuth, /Buffer\.from\(expectedHash, "base64url"\)\.length === passwordKeyLength/);

  assert.match(passwordSessionRoute, /MAX_LOGIN_BODY_BYTES = 16_384/);
  assert.match(passwordSessionRoute, /MAX_LOGIN_EMAIL_LENGTH = 254/);
  assert.match(passwordSessionRoute, /MAX_LOGIN_PASSWORD_LENGTH = 1_024/);
  const loginPost = passwordSessionRoute.slice(passwordSessionRoute.indexOf("export async function POST"));
  assert.ok(loginPost.indexOf("rateLimit(`login:") < loginPost.indexOf("readBody(request)"));
  assert.match(passwordSessionRoute, /total > MAX_LOGIN_BODY_BYTES/);
  assert.doesNotMatch(passwordSessionRoute, /request\.json\(|request\.formData\(/);
});

test("migration execution fails fast on blocked or runaway DDL", () => {
  assert.match(migrationRunner, /migrationLockTimeout = "5s"/);
  assert.match(migrationRunner, /migrationStatementTimeout = "2min"/);
  const application = migrationRunner.slice(migrationRunner.indexOf("async function apply"));
  assert.ok(application.indexOf("set_config('lock_timeout'") < application.indexOf("await client.query(sql)"));
  assert.ok(application.indexOf("set_config('statement_timeout'") < application.indexOf("await client.query(sql)"));
});

test("reset route delegates to the atomic service and treats session hydration as post-commit best effort", () => {
  assert.match(resetRoute, /MAX_RESET_COMPLETION_BODY_BYTES = 2_048/);
  assert.match(resetRoute, /total > MAX_RESET_COMPLETION_BODY_BYTES/);
  assert.doesNotMatch(resetRoute, /request\.json\(/);
  const resetPost = resetRoute.slice(resetRoute.indexOf("export async function POST"));
  assert.ok(resetPost.indexOf("enforceRateLimit") < resetPost.indexOf("readBoundedJson(request)"));
  assert.match(resetRoute, /completePasswordReset\(\{ token, password \}\)/);
  assert.doesNotMatch(resetRoute, /consumeActionToken|invalidateActionTokens|setPassword|nativeAuthEnabledForUser/);
  assert.match(resetRoute, /findSessionForVerifiedNativeCredential\(\{/);
  assert.match(resetRoute, /nativeAuthEpoch: result\.nativeAuthEpoch/);
  assert.doesNotMatch(resetRoute, /findSessionForGoogleUser/);
  assert.match(resetRoute, /session\?\.userId === result\.userId/);
  assert.match(resetRoute, /Password changed but session hydration failed/);
  assert.match(resetRoute, /return NextResponse\.json\(\{ ok: true, role: "associate", next: "\/login" \}\)/);
});

test("reset bearer is delivered in a fragment, captured in memory, and immediately scrubbed", () => {
  assert.match(resetRequestService, /\/reset-password#token=/);
  assert.doesNotMatch(resetRequestService, /\/reset-password\?token=/);
  assert.doesNotMatch(resetPage, /useSearchParams|searchParams\.get|window\.location\.search/);
  assert.match(resetPage, /useRef<string \| null>\(null\)/);
  assert.match(resetPage, /window\.addEventListener\("hashchange", captureAndScrubToken\)/);
  assert.match(resetPage, /window\.removeEventListener\("hashchange", captureAndScrubToken\)/);

  const capture = resetPage.slice(
    resetPage.indexOf("const captureAndScrubToken"),
    resetPage.indexOf('window.addEventListener("hashchange"'),
  );
  assert.ok(capture.indexOf("window.location.hash") < capture.indexOf("window.history.replaceState"));
  assert.ok(capture.indexOf("window.history.replaceState") < capture.indexOf("setToken(tokenInMemory.current)"));
  assert.match(capture, /fragment\.has\("token"\)/);
  assert.match(resetPage, /body: JSON\.stringify\(\{ token, password \}\)/);
  assert.match(resetPage, /if \(body\?\.next\)/);
});
