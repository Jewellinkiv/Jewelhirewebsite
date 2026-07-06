import {
  addTeamMember,
  getTeamComposition,
  getTeamMemberStoreId,
  listStoreLocations,
  listStoreTeamMembers,
  removeTeamMember,
  updateTeamMember,
} from "@/lib/local-team-store";
import { Mix, ProfileCode } from "@/lib/gemmatch";
import { requireStoreAccess } from "@/lib/server/access-control";
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

const localTeamStore: TeamStore = {
  async listStoreLocations(storeId) {
    return listStoreLocations(await requireStoreAccess(storeId, "team.locations.list"));
  },
  async listStoreTeamMembers(input) {
    await requireStoreAccess(input.storeId, "team.members.list");
    return listStoreTeamMembers(input.storeId, input.locationId);
  },
  async getTeamComposition(input) {
    await requireStoreAccess(input.storeId, "team.composition.read");
    return getTeamComposition(input.storeId, input.locationId);
  },
  async createTeamMember(input) {
    const storeId = await requireStoreAccess(input.storeId, "team.members.create");
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
    await requireStoreAccess(storeId, "team.members.update");
    return updateTeamMember(input.memberId, {
      locationId: input.locationId,
      status: input.status,
      nextAction: input.nextAction,
    });
  },
  async removeTeamMember(memberId) {
    const storeId = getTeamMemberStoreId(memberId);
    if (!storeId) return undefined;
    await requireStoreAccess(storeId, "team.members.remove");
    return removeTeamMember(memberId);
  },
};

const postgresTeamStore: TeamStore = {
  async listStoreLocations(storeId) {
    return listPostgresStoreLocations(await requireStoreAccess(storeId, "team.locations.list"));
  },
  async listStoreTeamMembers(input) {
    await requireStoreAccess(input.storeId, "team.members.list");
    return listPostgresStoreTeamMembers(input);
  },
  async getTeamComposition(input) {
    await requireStoreAccess(input.storeId, "team.composition.read");
    return getPostgresStoreTeamComposition(input);
  },
  async createTeamMember(input) {
    return createPostgresTeamMember({
      ...input,
      storeId: await requireStoreAccess(input.storeId, "team.members.create"),
    });
  },
  async updateTeamMember(input) {
    const storeId = await getPostgresTeamMemberStoreId(input.memberId);
    if (!storeId) return undefined;
    await requireStoreAccess(storeId, "team.members.update");
    return updatePostgresTeamMember(input);
  },
  async removeTeamMember(memberId) {
    const storeId = await getPostgresTeamMemberStoreId(memberId);
    if (!storeId) return undefined;
    await requireStoreAccess(storeId, "team.members.remove");
    return removePostgresTeamMember(memberId);
  },
};

export function getTeamStore(): TeamStore {
  return selectStoreAdapter("team-store", {
    local: localTeamStore,
    postgres: postgresTeamStore,
  });
}
