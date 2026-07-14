#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const actionTokens = read("lib/server/action-tokens.ts");
const passwordAuth = read("lib/server/password-auth.ts");
const route = read("app/api/auth/account-claim/route.ts");
const previewRoute = read("app/api/auth/account-claim/preview/route.ts");
const page = read("app/(auth)/claim-account/page.tsx");
const notifications = read("lib/server/notifications.ts");

test("retained-account claims validate cheaply and commit conversion, credential, and token atomically", () => {
  const completion = passwordAuth.slice(
    passwordAuth.indexOf("export async function completeStandaloneAccountClaim"),
    passwordAuth.indexOf("export async function hashPassword"),
  );
  const markers = [
    'isPlausibleActionToken("account_claim", input.token)',
    "const preflightResult",
    "const hash = await hashPassword(input.password)",
    'client.query("begin")',
    "from users",
    "for update",
    "for update of token",
    "set native_auth_enabled = true",
    "native_auth_epoch = u.native_auth_epoch + 1",
    "insert into password_credentials",
    "update auth_action_tokens",
    'client.query("commit")',
  ];
  let prior = -1;
  for (const marker of markers) {
    const index = completion.indexOf(marker, prior + 1);
    assert.ok(index > prior, `expected ${marker} after the prior claim marker`);
    prior = index;
  }
  assert.match(actionTokens, /\^ac2_\[A-Za-z0-9_-\]\{43\}\$/);
  assert.match(actionTokens, /`ac2_\$\{entropy\}`/);
  assert.match(completion, /currentUser\.status !== "active"/);
  assert.match(completion, /currentUser\.email_normalized !== claim\.token_email/);
  assert.match(completion, /isConfiguredAdminEmail\(claim\.token_email\)/);
  assert.match(completion, /consumed\.rows\.some\(\(row\) => row\.id === claim\.id\)/);
  assert.ok(completion.indexOf("isConfiguredAdminEmail(claim.token_email)") > completion.indexOf("for update of token"));
});

test("claim APIs keep the bearer in POST bodies and treat session hydration as post-commit best effort", () => {
  assert.match(previewRoute, /export async function POST/);
  assert.match(previewRoute, /request\.json\(\)/);
  assert.match(previewRoute, /isActionTokenValid\(\{ purpose: "account_claim", token \}\)/);
  assert.match(previewRoute, /no-store, max-age=0/);
  assert.doesNotMatch(previewRoute, /export async function GET|new URL\(request\.url\)|searchParams/);
  assert.match(route, /completeStandaloneAccountClaim\(\{ token, password \}\)/);
  assert.match(route, /MAX_ACCOUNT_CLAIM_BODY_BYTES = 2_048/);
  assert.match(route, /total > MAX_ACCOUNT_CLAIM_BODY_BYTES/);
  assert.doesNotMatch(route, /export async function GET|findActionTokenSubject|isActionTokenValid|searchParams/);
  assert.match(route, /findSessionForVerifiedNativeCredential\(\{/);
  assert.match(route, /nativeAuthEpoch: converted\.nativeAuthEpoch/);
  assert.doesNotMatch(route, /findSessionForGoogleUser/);
  assert.match(route, /session\?\.userId === converted\.userId/);
  assert.match(route, /Account converted but session hydration failed/);
  assert.match(route, /return NextResponse\.json\(\{ ok: true, next: "\/login" \}\)/);
});

test("claim email and browser page use fragment-only, scrubbed bearer transport", () => {
  assert.match(notifications, /\/claim-account#token=/);
  assert.doesNotMatch(notifications, /\/claim-account\?token=/);
  assert.doesNotMatch(page, /useSearchParams|searchParams\.get|window\.location\.search|account-claim\?token=/);
  assert.match(page, /useRef<string \| null>\(null\)/);
  assert.match(page, /window\.addEventListener\("hashchange", captureAndScrubToken\)/);
  assert.match(page, /window\.removeEventListener\("hashchange", captureAndScrubToken\)/);
  const capture = page.slice(
    page.indexOf("const captureAndScrubToken"),
    page.indexOf('window.addEventListener("hashchange"'),
  );
  assert.ok(capture.indexOf("window.location.hash") < capture.indexOf("window.history.replaceState"));
  assert.ok(capture.indexOf("window.history.replaceState") < capture.indexOf("setToken(tokenInMemory.current)"));
  assert.match(page, /fetch\("\/api\/auth\/account-claim\/preview", \{/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /body: JSON\.stringify\(\{ token \}\)/);
  assert.match(page, /controller\.abort\(\)/);
  assert.match(page, /body: JSON\.stringify\(\{ token, password \}\)/);
});
