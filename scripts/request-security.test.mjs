#!/usr/bin/env node

import assert from "node:assert/strict";
import test from "node:test";
import { clientIp } from "../lib/server/request.ts";

const originalNodeEnv = process.env.NODE_ENV;
const originalTrustedHops = process.env.JEWELHIRE_TRUSTED_PROXY_HOPS;

function requestWith(headers) {
  return new Request("https://app.jewelhire.test/login", { headers });
}

test("client IP selection ignores spoofable XFF values to the left of the trusted edge", () => {
  process.env.NODE_ENV = "production";
  process.env.JEWELHIRE_TRUSTED_PROXY_HOPS = "1";
  assert.equal(
    clientIp(requestWith({ "x-forwarded-for": "203.0.113.10, 198.51.100.44, 192.0.2.9" })),
    "198.51.100.44",
  );
  assert.equal(
    clientIp(requestWith({ "x-forwarded-for": "10.0.0.1, 10.0.0.2, 198.51.100.44, 192.0.2.9" })),
    "198.51.100.44",
  );
});

test("production fails closed when proxy trust is missing, invalid, or too short", () => {
  process.env.NODE_ENV = "production";
  delete process.env.JEWELHIRE_TRUSTED_PROXY_HOPS;
  assert.equal(clientIp(requestWith({ "x-forwarded-for": "203.0.113.10" })), "unknown");
  process.env.JEWELHIRE_TRUSTED_PROXY_HOPS = "-1";
  assert.equal(clientIp(requestWith({ "x-forwarded-for": "203.0.113.10, 192.0.2.9" })), "unknown");
  process.env.JEWELHIRE_TRUSTED_PROXY_HOPS = "2";
  assert.equal(clientIp(requestWith({ "x-forwarded-for": "203.0.113.10, 192.0.2.9" })), "unknown");
  process.env.JEWELHIRE_TRUSTED_PROXY_HOPS = "1";
  assert.equal(clientIp(requestWith({ "x-forwarded-for": "spoofed, not-an-ip, 192.0.2.9" })), "unknown");
  assert.equal(clientIp(requestWith({ "x-real-ip": "203.0.113.22" })), "unknown");
});

test("development supports direct local proxy headers without trusting malformed values", () => {
  process.env.NODE_ENV = "test";
  delete process.env.JEWELHIRE_TRUSTED_PROXY_HOPS;
  assert.equal(clientIp(requestWith({ "x-forwarded-for": "127.0.0.7" })), "127.0.0.7");
  assert.equal(clientIp(requestWith({ "x-real-ip": "127.0.0.8" })), "127.0.0.8");
  assert.equal(clientIp(requestWith({ "x-forwarded-for": "attacker-value" })), "unknown");
});

test.after(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalTrustedHops === undefined) delete process.env.JEWELHIRE_TRUSTED_PROXY_HOPS;
  else process.env.JEWELHIRE_TRUSTED_PROXY_HOPS = originalTrustedHops;
});
