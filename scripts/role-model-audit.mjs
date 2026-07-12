#!/usr/bin/env node
import fs from "node:fs";
import { resolveSessionAccess } from "../lib/auth-role-model.ts";

let failures = 0;

function check(name, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  if (!pass) failures += 1;
}

const storeAdmin = resolveSessionAccess({
  isPlatformAdmin: false,
  storeIds: ["store-a"],
  memberships: [{ storeId: "store-a", storeRole: "admin", allLocations: true }],
});
check("store admin resolves to organization owner, not platform admin", storeAdmin.role === "store_owner" && storeAdmin.storeRoles["store-a"] === "store_owner");

const manager = resolveSessionAccess({
  isPlatformAdmin: false,
  storeIds: ["store-a"],
  memberships: [{ storeId: "store-a", storeRole: "manager", allLocations: false, locationIds: ["location-a"] }],
});
check("manager remains manager", manager.role === "manager" && manager.storeRoles["store-a"] === "manager");
check("manager selected-location scope is preserved", manager.locationScopes["store-a"]?.allLocations === false && manager.locationScopes["store-a"]?.locationIds[0] === "location-a");

const mixed = resolveSessionAccess({
  isPlatformAdmin: false,
  storeIds: ["store-a", "store-b"],
  memberships: [
    { storeId: "store-a", storeRole: "store_owner" },
    { storeId: "store-b", storeRole: "manager" },
  ],
});
check("mixed memberships retain a role per store", mixed.role === "store_owner" && mixed.storeRoles["store-a"] === "store_owner" && mixed.storeRoles["store-b"] === "manager");

const applicant = resolveSessionAccess({ isPlatformAdmin: false, storeIds: [], memberships: [] });
check("user without store membership resolves to applicant", applicant.role === "associate");

const platformAdmin = resolveSessionAccess({
  isPlatformAdmin: true,
  storeIds: ["store-a", "store-b"],
  memberships: [{ storeId: "store-a", storeRole: "manager" }],
});
check("only explicit platform claim resolves platform admin", platformAdmin.role === "admin" && Object.keys(platformAdmin.storeRoles).length === 0);

const accessSource = fs.readFileSync(new URL("../lib/server/access-control.ts", import.meta.url), "utf8");
check("manager owner-only policy covers billing", accessSource.includes('"billing."'));
check("manager owner-only policy covers settings", accessSource.includes('"settings."'));
check("manager owner-only policy covers integrations", accessSource.includes('"integrations."'));
check("manager owner-only policy covers user administration", accessSource.includes('"users."'));
check("manager owner-only policy covers ownership transfer", accessSource.includes('"store.transfer_admin"'));
check("unconverted selected-location operations fail closed", accessSource.includes("Location-scoped manager access is not enabled"));
check("location-aware operations require an explicit scoped guard", accessSource.includes("requireLocationScopedStoreAccess"));

process.exitCode = failures ? 1 : 0;
