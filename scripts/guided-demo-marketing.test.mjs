import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(`${process.cwd()}/public/marketing/index.html`, "utf8");
const script = fs.readFileSync(`${process.cwd()}/public/marketing/app.js`, "utf8");
const styles = fs.readFileSync(`${process.cwd()}/public/marketing/styles.css`, "utf8");

test("marketing site makes the real store-owner demo prominent", () => {
  assert.match(html, /id="guided-demo"/);
  assert.match(html, /Interactive store-owner walkthrough/);
  assert.match(html, /Create your demo store/);
  assert.match(html, /confirm the hire, launch onboarding/);
  assert.ok((html.match(/https:\/\/app\.jewelhire\.com\/guided-demo/g) || []).length >= 7);
  assert.match(styles, /\.guided-demo-band/);
  assert.match(styles, /\.guided-demo-flow/);
});

test("marketing links use the current app and retire the mock lead form", () => {
  assert.doesNotMatch(html, /app\.jewelhire\.ai/);
  assert.doesNotMatch(html, /data-open-modal="demo"/);
  assert.doesNotMatch(html, /website mockup/);
  assert.doesNotMatch(script, /lead-form|modal-demo|modal-thanks/);
  assert.match(html, /https:\/\/app\.jewelhire\.com\/login/);
  assert.match(html, /https:\/\/app\.jewelhire\.com\/signup\/store/);
});
