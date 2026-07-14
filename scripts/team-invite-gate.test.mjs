import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { teamInvitesEnabled } from "../lib/server/team-invite-policy.ts";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function handlerSource(relativePath, method) {
  const source = read(relativePath);
  const startMarker = `export const ${method} =`;
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${relativePath} must export ${method}`);
  const next = source.indexOf("\nexport const ", start + startMarker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

const hazardousRoutes = [
  {
    file: "app/api/stores/[storeId]/users/route.ts",
    method: "POST",
    auth: "requireStoreAccess",
    mutation: ".inviteStoreUser(",
  },
  {
    file: "app/api/admin/companies/[id]/users/route.ts",
    method: "POST",
    auth: "requireAdminAccess",
    mutation: ".inviteCompanyUser(",
  },
  {
    file: "app/api/admin/users/[id]/resend/route.ts",
    method: "POST",
    auth: "requireAdminAccess",
    mutation: ".resendUserInvite(",
  },
  {
    file: "app/api/admin/companies/route.ts",
    method: "POST",
    auth: "requireAdminAccess",
    mutation: ".createCompany(",
  },
  {
    file: "app/api/stores/[storeId]/transfer-admin/route.ts",
    method: "POST",
    auth: "requireStoreAccess",
    mutation: ".transferStoreAdmin(",
  },
  {
    file: "app/api/users/[id]/route.ts",
    method: "PATCH",
    auth: "getSessionContext",
    mutation: ".updateStoreUser(",
  },
  {
    file: "app/api/admin/users/[id]/route.ts",
    method: "PATCH",
    auth: "requireAdminAccess",
    mutation: ".updateUser(",
  },
];

for (const route of hazardousRoutes) {
  test(`${route.file} ${route.method} authenticates, then gates before mutation`, () => {
    const handler = handlerSource(route.file, route.method);
    const auth = handler.indexOf(route.auth);
    const gate = handler.indexOf("assertTeamInvitesEnabled()");
    const mutation = handler.indexOf(route.mutation);
    assert.notEqual(auth, -1, "authentication/authorization must remain in the handler");
    assert.notEqual(gate, -1, "team invitation gate must be in the hazardous handler");
    assert.notEqual(mutation, -1, "expected mutation call must remain visible to the guard test");
    assert.ok(auth < gate, "authentication must happen before capability disclosure");
    assert.ok(gate < mutation, "the gate must run before the store mutation");
  });
}

test("read, list, and remove handlers remain available while onboarding is paused", () => {
  const storeList = handlerSource("app/api/stores/[storeId]/users/route.ts", "GET");
  const storeRemove = handlerSource("app/api/users/[id]/route.ts", "DELETE");
  const adminCompanyList = handlerSource("app/api/admin/companies/route.ts", "GET");
  const adminCompanyDetail = handlerSource("app/api/admin/companies/[id]/route.ts", "GET");
  const adminRemove = handlerSource("app/api/admin/users/[id]/route.ts", "DELETE");

  for (const handler of [storeList, storeRemove, adminCompanyList, adminCompanyDetail, adminRemove]) {
    assert.doesNotMatch(handler, /assertTeamInvitesEnabled\(\)/);
  }
  assert.match(storeList, /teamInvitesEnabled\(\)/);
  assert.match(adminCompanyList, /teamInvitesEnabled\(\)/);
  assert.match(adminCompanyDetail, /teamInvitesEnabled\(\)/);
});

test("policy is server-only, production-default-off, and explicit-value fail closed", () => {
  const policy = read("lib/server/team-invite-policy.ts");
  const apiErrors = read("lib/server/api-errors.ts");
  assert.match(policy, /Server-only policy/);
  assert.doesNotMatch(policy, /NEXT_PUBLIC/);
  assert.match(policy, /configured === "1"/);
  assert.match(policy, /env\.NODE_ENV !== "production"/);
  assert.match(apiErrors, /code: "team_invites_disabled"/);
  assert.match(apiErrors, /status: 503/);

  assert.equal(teamInvitesEnabled({ NODE_ENV: "production" }), false);
  assert.equal(teamInvitesEnabled({ NODE_ENV: "development" }), true);
  assert.equal(teamInvitesEnabled({ NODE_ENV: "test" }), true);
  assert.equal(teamInvitesEnabled({ NODE_ENV: "development", JEWELHIRE_TEAM_INVITES_ENABLED: "0" }), false);
  assert.equal(teamInvitesEnabled({ NODE_ENV: "production", JEWELHIRE_TEAM_INVITES_ENABLED: "1" }), true);
  assert.equal(teamInvitesEnabled({ NODE_ENV: "development", JEWELHIRE_TEAM_INVITES_ENABLED: "true" }), false);
  assert.equal(teamInvitesEnabled({ NODE_ENV: "test", JEWELHIRE_TEAM_INVITES_ENABLED: "   " }), false);
});

test("Diamond Exchange production promotion requires an explicit disabled gate", () => {
  const workflow = read(".github/workflows/deploy.yml");
  const provisioning = read("docs/production-integration-provisioning.md");
  const rollout = read("docs/production-rollout-checklist.md");
  const integration = read("docs/jewellink-integration.md");
  assert.match(workflow, /JEWELHIRE_TEAM_INVITES_ENABLED/);
  assert.match(workflow, /TEAM_INVITES_ENABLED.*!= "0"/s);
  assert.match(workflow, /Diamond Exchange pilot/);
  assert.match(workflow, /npm run test:team-invite-gate/);
  assert.match(provisioning, /JEWELHIRE_TEAM_INVITES_ENABLED=0/);
  assert.match(rollout, /Secure tokenized team-invitation acceptance\s+is deferred/);
  assert.match(integration, /Secure, tokenized acceptance.*deferred/s);
  assert.match(integration, /fail(?:s)? closed before creating a company or team invite/);
});

test("affected UI advertises the pause and no longer makes unconditional send claims", () => {
  const storeUsers = read("components/UsersSettings.tsx");
  const adminCompanies = read("app/(admin)/admin/companies/page.tsx");
  const adminCompany = read("app/(admin)/admin/companies/[id]/page.tsx");
  assert.match(storeUsers, /Team onboarding is paused/);
  assert.match(adminCompanies, /Pilot safety control/);
  assert.match(adminCompany, /Team onboarding is paused for the pilot/);
  assert.doesNotMatch(storeUsers, /`Invite sent to/);
  assert.doesNotMatch(adminCompanies, /Owner invite sent/);
  assert.doesNotMatch(adminCompany, /`Invite re-sent to/);
});
