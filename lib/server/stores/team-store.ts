import {
  getTeamComposition,
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

export interface TeamStore {
  listStoreLocations(storeId: string): MaybePromise<TeamLocationView[]>;
  listStoreTeamMembers(input: ListTeamMembersInput): MaybePromise<TeamMemberView[]>;
  getTeamComposition(input: ListTeamMembersInput): MaybePromise<TeamCompositionView>;
  updateTeamMember(input: UpdateTeamMemberInput): MaybePromise<TeamMemberMutationResult>;
  removeTeamMember(memberId: string): MaybePromise<TeamMemberRemoveResult>;
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
  updateTeamMember(input) {
    return updateTeamMember(input.memberId, {
      locationId: input.locationId,
      status: input.status,
      nextAction: input.nextAction,
    });
  },
  removeTeamMember,
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
