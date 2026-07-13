import {
  addTeamMember,
  getTeamComposition,
  getTeamMemberStoreId,
  listStoreLocations,
  listStoreTeamMembers,
  removeTeamMember,
  updateTeamMember,
} from "@/lib/local-team-store";
import { Mix, PROFILE_ORDER, ProfileCode } from "@/lib/gemmatch";
import { requireLocationScopedStoreAccess } from "@/lib/server/access-control";
import { locationInScope, requestedLocationInScope, requireLocationInScope } from "@/lib/server/location-scope";
import {
  getPostgresStoreTeamComposition,
  getPostgresTeamMemberStoreId,
  listPostgresStoreLocations,
  listPostgresStoreTeamMembers,
  createPostgresTeamMember,
  removePostgresTeamMember,
  updatePostgresTeamMember,
} from "@/lib/server/postgres-phase1";
import { selectStoreAdapter } from "@/lib/server/storage-runtime";

type MaybePromise<T> = T | Promise<T>;
type TeamLocationView = ReturnType<typeof listStoreLocations>[number];
type TeamMemberView = {
  id: string;
  name: string;
  initials: string;
  role: string;
  type: string;
  primary: ProfileCode;
  locationId?: string;
  status?: string;
  location?: string;
  training?: string;
  lastCheckIn?: string;
  nextAction?: string;
  detail?: unknown;
  jewellinkTeamMemberId?: string;
  sourceApplicationId?: string;
};
type TeamCompositionView = {
  locationId?: string | null;
  floorType: string;
  mix: Mix;
  counts: Record<ProfileCode, number>;
  tested: number;
  total: number;
  members: TeamMemberView[];
};
type TeamMemberMutationResult = { member: TeamMemberView } | undefined;
type TeamMemberRemoveResult = { member: TeamMemberView; members: TeamMemberView[] } | undefined;

export interface ListTeamMembersInput {
  storeId: string;
  locationId?: string | null;
}

export interface UpdateTeamMemberInput {
  memberId: string;
  locationId?: string;
  status?: string;
  nextAction?: string;
}

export interface CreateTeamMemberInput {
  storeId: string;
  name: string;
  role?: string;
  primary?: ProfileCode;
  type?: string;
  locationId?: string | null;
}

export interface TeamStore {
  listStoreLocations(storeId: string): MaybePromise<TeamLocationView[]>;
  listStoreTeamMembers(input: ListTeamMembersInput): MaybePromise<TeamMemberView[]>;
  getTeamComposition(input: ListTeamMembersInput): MaybePromise<TeamCompositionView>;
  createTeamMember(input: CreateTeamMemberInput): MaybePromise<TeamMemberMutationResult>;
  updateTeamMember(input: UpdateTeamMemberInput): MaybePromise<TeamMemberMutationResult>;
  removeTeamMember(memberId: string): MaybePromise<TeamMemberRemoveResult>;
}

function localTeamId(name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "member";
  return `team-${slug}-${Date.now().toString(36)}`;
}

function localInitials(name: string) {
  return name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase() || "NA";
}

function compositionFromMembers(members: TeamMemberView[], locationId?: string | null, floorType = "Scoped team"): TeamCompositionView {
  const counts = members.reduce<Record<ProfileCode, number>>(
    (acc, member) => {
      acc[member.primary] += 1;
      return acc;
    },
    { V: 0, C: 0, F: 0, D: 0 },
  );
  const denominator = Math.max(members.length, 1);
  const mix = Object.fromEntries(
    PROFILE_ORDER.map((profile) => [profile, Math.round((counts[profile] / denominator) * 100)]),
  ) as Mix;
  return { locationId, floorType, mix, counts, tested: members.length, total: members.length, members };
}

function scopedMembers(members: TeamMemberView[], locationIds?: string[]) {
  return locationIds ? members.filter((member) => locationInScope(member.locationId || member.location, locationIds)) : members;
}

const localTeamStore: TeamStore = {
  async listStoreLocations(storeId) {
    const access = await requireLocationScopedStoreAccess(storeId, "team.locations.list");
    return listStoreLocations(access.storeId).filter((location) => locationInScope(location.id, access.locationIds));
  },
  async listStoreTeamMembers(input) {
    const access = await requireLocationScopedStoreAccess(input.storeId, "team.members.list");
    const locationId = requestedLocationInScope(input.locationId, access.locationIds, "team.members.list");
    return scopedMembers(listStoreTeamMembers(input.storeId, locationId), access.locationIds);
  },
  async getTeamComposition(input) {
    const access = await requireLocationScopedStoreAccess(input.storeId, "team.composition.read");
    const locationId = requestedLocationInScope(input.locationId, access.locationIds, "team.composition.read");
    if (!access.locationIds) return getTeamComposition(input.storeId, locationId);
    const members = scopedMembers(listStoreTeamMembers(input.storeId, locationId), access.locationIds);
    const locations = listStoreLocations(input.storeId);
    return compositionFromMembers(members, locationId, locations.find((item) => item.id === locationId)?.floorType);
  },
  async createTeamMember(input) {
    const access = await requireLocationScopedStoreAccess(input.storeId, "team.members.create");
    requireLocationInScope(input.locationId, access.locationIds, "team.members.create");
    const storeId = access.storeId;
    const primary = input.primary || "C";
    const created = addTeamMember(storeId, {
      id: localTeamId(input.name),
      name: input.name,
      initials: localInitials(input.name),
      role: input.role?.trim() || "Team member",
      type: input.type?.trim() || "Balanced Associate",
      primary,
      locationId: input.locationId || undefined,
    });
    const [member] = listStoreTeamMembers(storeId).filter((item) => item.id === created.member.id);
    return member ? { member } : { member: created.member };
  },
  async updateTeamMember(input) {
    const storeId = getTeamMemberStoreId(input.memberId);
    if (!storeId) return undefined;
    const access = await requireLocationScopedStoreAccess(storeId, "team.members.update");
    const existing = listStoreTeamMembers(storeId).find((member) => member.id === input.memberId);
    requireLocationInScope(existing?.locationId || existing?.location, access.locationIds, "team.members.update");
    if (input.locationId !== undefined) requireLocationInScope(input.locationId, access.locationIds, "team.members.update");
    return updateTeamMember(input.memberId, {
      locationId: input.locationId,
      status: input.status,
      nextAction: input.nextAction,
    });
  },
  async removeTeamMember(memberId) {
    const storeId = getTeamMemberStoreId(memberId);
    if (!storeId) return undefined;
    const access = await requireLocationScopedStoreAccess(storeId, "team.members.remove");
    const existing = listStoreTeamMembers(storeId).find((member) => member.id === memberId);
    requireLocationInScope(existing?.locationId || existing?.location, access.locationIds, "team.members.remove");
    return removeTeamMember(memberId);
  },
};

const postgresTeamStore: TeamStore = {
  async listStoreLocations(storeId) {
    const access = await requireLocationScopedStoreAccess(storeId, "team.locations.list");
    return (await listPostgresStoreLocations(access.storeId)).filter((location) => locationInScope(location.id, access.locationIds));
  },
  async listStoreTeamMembers(input) {
    const access = await requireLocationScopedStoreAccess(input.storeId, "team.members.list");
    const locationId = requestedLocationInScope(input.locationId, access.locationIds, "team.members.list");
    return scopedMembers(await listPostgresStoreTeamMembers({ ...input, locationId }), access.locationIds);
  },
  async getTeamComposition(input) {
    const access = await requireLocationScopedStoreAccess(input.storeId, "team.composition.read");
    const locationId = requestedLocationInScope(input.locationId, access.locationIds, "team.composition.read");
    if (!access.locationIds) return getPostgresStoreTeamComposition({ ...input, locationId });
    const members = scopedMembers(await listPostgresStoreTeamMembers({ ...input, locationId }), access.locationIds);
    const locations = await listPostgresStoreLocations(input.storeId);
    return compositionFromMembers(members, locationId, locations.find((item) => item.id === locationId)?.floorType);
  },
  async createTeamMember(input) {
    const access = await requireLocationScopedStoreAccess(input.storeId, "team.members.create");
    requireLocationInScope(input.locationId, access.locationIds, "team.members.create");
    return createPostgresTeamMember({
      ...input,
      storeId: access.storeId,
    });
  },
  async updateTeamMember(input) {
    const storeId = await getPostgresTeamMemberStoreId(input.memberId);
    if (!storeId) return undefined;
    const access = await requireLocationScopedStoreAccess(storeId, "team.members.update");
    const existing = (await listPostgresStoreTeamMembers({ storeId })).find((member) => member.id === input.memberId);
    requireLocationInScope(existing?.locationId || existing?.location, access.locationIds, "team.members.update");
    if (input.locationId !== undefined) requireLocationInScope(input.locationId, access.locationIds, "team.members.update");
    return updatePostgresTeamMember(input);
  },
  async removeTeamMember(memberId) {
    const storeId = await getPostgresTeamMemberStoreId(memberId);
    if (!storeId) return undefined;
    const access = await requireLocationScopedStoreAccess(storeId, "team.members.remove");
    const existing = (await listPostgresStoreTeamMembers({ storeId })).find((member) => member.id === memberId);
    requireLocationInScope(existing?.locationId || existing?.location, access.locationIds, "team.members.remove");
    return removePostgresTeamMember(memberId);
  },
};

export function getTeamStore(): TeamStore {
  return selectStoreAdapter("team-store", {
    local: localTeamStore,
    postgres: postgresTeamStore,
  });
}
