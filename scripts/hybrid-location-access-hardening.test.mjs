#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const accessControl = read("lib/server/access-control.ts");
const postgres = read("lib/server/postgres-phase1.ts");
const localStore = read("lib/local-api-store.ts");
const gemMatchRoute = read("app/api/gemmatch/responses/route.ts");
const interviewRoute = read("app/api/interviews/[id]/rsvp/route.ts");
const progressRoute = read("app/api/course-assignments/[id]/progress/route.ts");
const completionRoute = read("app/api/courses/[slug]/completion-test/attempts/route.ts");
const deployWorkflow = read(".github/workflows/deploy.yml");

test("hybrid authorization preserves recipient access and scopes manager store access by trusted location", () => {
  const recipientCheck = accessControl.indexOf("if (recipientIdentityMatches(session, input)) return session;");
  const membershipCheck = accessControl.indexOf("const membershipRole = session.storeRoles[input.storeId]");
  assert.ok(recipientCheck >= 0 && membershipCheck > recipientCheck);
  assert.match(accessControl, /resourceLocation\?: string \| null/);
  assert.match(accessControl, /locationScope\.locationIds\.length > 0[\s\S]*locationIdInScope\(input\.resourceLocation, locationScope\.locationIds\)/);
  assert.match(accessControl, /if \(locationScope\.allLocations\) return session/);
  assert.doesNotMatch(accessControl, /session\.storeIds\.includes\(input\.storeId\)/);
});

test("every hybrid mutation passes a server-resolved resource location", () => {
  assert.match(gemMatchRoute, /getPostgresGemMatchInviteScope[\s\S]*requireRecipientOrStoreAccess\(\{ \.\.\.scope,/);
  assert.match(interviewRoute, /getPostgresInterviewRsvpScope[\s\S]*requireRecipientOrStoreAccess\(\{ \.\.\.scope,/);
  assert.match(progressRoute, /resourceLocation: before\.resourceLocation/);
  assert.match(progressRoute, /getCourseAssignmentAccessScope[\s\S]*resourceLocation: accessScope\?\.resourceLocation/);
  assert.match(completionRoute, /resourceLocation: getStorageRuntime\(\) === "postgres"[\s\S]*getCourseAssignmentAccessScope\(assignmentId\)\?\.resourceLocation/);
  assert.ok(gemMatchRoute.indexOf("requireRecipientOrStoreAccess") < gemMatchRoute.indexOf("completePostgresGemMatchResponse(input)"));
  assert.ok(interviewRoute.indexOf("requireRecipientOrStoreAccess({ ...scope") < interviewRoute.indexOf("const interview = await updatePostgresInterviewRsvp"));
  assert.ok(progressRoute.indexOf("requireRecipientOrStoreAccess({") < progressRoute.indexOf("const assignment = await updatePostgresTrainingProgress"));
  assert.ok(completionRoute.indexOf("requireRecipientOrStoreAccess({") < completionRoute.indexOf("submitCourseTestAttempt({"));
});

test("PostgreSQL resolves applicant jobs and team assignments to persisted location ids and fails ambiguous jobs closed", () => {
  assert.match(postgres, /count\(\*\) filter \(where \$\{jobLocationSlug\} = \$\{candidateLocationSlug\}\) = 1/);
  assert.match(postgres, /and count\(\*\) = 1[\s\S]*then min\(candidate_location\.id\)/);
  assert.match(postgres, /candidate_location\.store_id = \$\{storeIdColumn\}/);
  assert.match(postgres, /resource_location\.location_id as resource_location/);
  assert.match(postgres, /when ca\.recipient_type = 'team_member' then tm\.location_id[\s\S]*else resource_location\.location_id/);
  assert.match(postgres, /resourceLocation: optional\(row\.resource_location\)/);
});

test("local fallback derives location from persisted application/job or team-member state", () => {
  assert.match(localStore, /export function getCourseAssignmentAccessScope/);
  assert.match(localStore, /localResourceLocationId\(assignment\.storeId, jobLocation\)/);
  assert.match(localStore, /teamMember\?\.locationId \|\| teamMember\?\.location/);
  assert.match(localStore, /resourceLocation: localResourceLocationId/g);
  assert.match(localStore, /return compatible\.length === 1 \? compatible\[0\]\.id : undefined/);
});

test("release validation runs both hybrid location regressions", () => {
  assert.match(deployWorkflow, /npm run test:hybrid-location-access\s/);
  assert.match(deployWorkflow, /npm run test:hybrid-location-access-postgres\s/);
});
