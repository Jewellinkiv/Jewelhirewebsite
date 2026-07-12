export type AuthRole = "store_owner" | "manager" | "associate" | "admin";
export type StoreMembershipRole = "store_owner" | "manager";
export type StoreLocationScope = { allLocations: boolean; locationIds: string[] };

export type StoreMembershipClaim = {
  storeId: string;
  storeRole?: string | null;
  allLocations?: boolean | null;
  locationIds?: string[] | null;
};

export function resolveSessionAccess(input: {
  isPlatformAdmin: boolean;
  storeIds: string[];
  memberships: StoreMembershipClaim[];
}) {
  if (input.isPlatformAdmin) {
    return {
      role: "admin" as const,
      storeRoles: {} as Record<string, StoreMembershipRole>,
      locationScopes: Object.fromEntries(
        input.storeIds.map((storeId) => [storeId, { allLocations: true, locationIds: [] }]),
      ) as Record<string, StoreLocationScope>,
    };
  }

  const storeRoles = Object.fromEntries(
    input.memberships.map((membership) => [
      membership.storeId,
      membership.storeRole === "admin" || membership.storeRole === "store_owner" ? "store_owner" : "manager",
    ]),
  ) as Record<string, StoreMembershipRole>;
  const locationScopes = Object.fromEntries(
    input.memberships.map((membership) => [
      membership.storeId,
      {
        allLocations: storeRoles[membership.storeId] === "store_owner" || membership.allLocations !== false,
        locationIds: membership.locationIds || [],
      },
    ]),
  ) as Record<string, StoreLocationScope>;
  const hasOwnerMembership = Object.values(storeRoles).includes("store_owner");

  return {
    role: hasOwnerMembership ? "store_owner" as const : input.storeIds.length ? "manager" as const : "associate" as const,
    storeRoles,
    locationScopes,
  };
}
