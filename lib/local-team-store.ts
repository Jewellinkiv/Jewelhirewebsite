import { Mix, ProfileCode } from "./gemmatch";
import { ASSOCIATE_DETAIL } from "./team-detail";
import { LOCATIONS, TEAM_MEMBERS, TeamMemberLoc } from "./team-locations";

interface TeamState {
  membersByStoreId: Record<string, TeamMemberLoc[]>;
}

declare global {
  // eslint-disable-next-line no-var
  var __jewelhireTeamStore: TeamState | undefined;
}

function state(): TeamState {
  if (!globalThis.__jewelhireTeamStore) {
    globalThis.__jewelhireTeamStore = { membersByStoreId: {} };
  }
  return globalThis.__jewelhireTeamStore;
}

function cloneMember(member: TeamMemberLoc): TeamMemberLoc {
  return { ...member };
}

function ensureMembers(storeId: string) {
  state().membersByStoreId[storeId] ??= TEAM_MEMBERS.map(cloneMember);
  return state().membersByStoreId[storeId];
}

export function listStoreLocations(_storeId: string) {
  return LOCATIONS.map((location) => ({ ...location }));
}

export function listStoreTeamMembers(storeId: string, locationId?: string | null) {
  return ensureMembers(storeId)
    .filter((member) => !locationId || member.locationId === locationId)
    .map((member, index) => {
      const detail = ASSOCIATE_DETAIL[member.id];
      const status = detail?.status === "New" ? "Onboarding" : detail?.status === "On leave" ? "Needs review" : "Active";
      return {
        ...cloneMember(member),
        status,
        location: LOCATIONS.find((location) => location.id === member.locationId)?.name || member.locationId,
        training: index === 4 ? "Clienteling starter" : index === 5 ? "Inventory Security" : "Current",
        lastCheckIn: index < 2 ? "This week" : index < 4 ? "Last week" : "Needs scheduling",
        nextAction:
          status === "Onboarding"
            ? "Assign first 30-day training path"
            : status === "Needs review"
              ? "Review development plan"
              : "Keep in quarterly coaching rhythm",
        detail,
      };
    });
}

export function addTeamMember(
  storeId: string,
  input: {
    id: string;
    name: string;
    initials: string;
    role: string;
    type: string;
    primary: ProfileCode;
    assessed?: boolean;
    locationId?: string;
  },
) {
  const members = ensureMembers(storeId);
  const existing = members.find((member) => member.id === input.id);
  if (existing) return { member: { ...existing }, created: false };

  const member: TeamMemberLoc = {
    id: input.id,
    name: input.name,
    initials: input.initials,
    role: input.role,
    type: input.type,
    primary: input.primary,
    assessed: input.assessed,
    locationId: input.locationId || "little-rock",
  };
  members.unshift(member);
  return { member: { ...member }, created: true };
}

export function updateTeamMember(memberId: string, input: { locationId?: string; status?: string; nextAction?: string }) {
  for (const members of Object.values(state().membersByStoreId)) {
    const member = members.find((candidate) => candidate.id === memberId);
    if (!member) continue;
    if (input.locationId) member.locationId = input.locationId;
    return { member: { ...member } };
  }
  // Initialize the default store lazily if PATCH is the first team call.
  const members = ensureMembers("store-sissys-little-rock");
  const member = members.find((candidate) => candidate.id === memberId);
  if (!member) return undefined;
  if (input.locationId) member.locationId = input.locationId;
  return { member: { ...member } };
}

export function getTeamMemberStoreId(memberId: string): string | undefined {
  for (const [storeId, members] of Object.entries(state().membersByStoreId)) {
    if (members.some((candidate) => candidate.id === memberId)) return storeId;
  }
  // Mirror the lazy default-store init used by update/remove so a first-call
  // PATCH/DELETE on a seeded member still resolves its owning store.
  const defaultStoreId = "store-sissys-little-rock";
  return ensureMembers(defaultStoreId).some((candidate) => candidate.id === memberId)
    ? defaultStoreId
    : undefined;
}

export function removeTeamMember(memberId: string) {
  for (const [storeId, members] of Object.entries(state().membersByStoreId)) {
    const member = members.find((candidate) => candidate.id === memberId);
    if (!member) continue;
    state().membersByStoreId[storeId] = members.filter((candidate) => candidate.id !== memberId);
    return { member: { ...member }, members: state().membersByStoreId[storeId].map(cloneMember) };
  }
  const members = ensureMembers("store-sissys-little-rock");
  const member = members.find((candidate) => candidate.id === memberId);
  if (!member) return undefined;
  state().membersByStoreId["store-sissys-little-rock"] = members.filter((candidate) => candidate.id !== memberId);
  return { member: { ...member }, members: state().membersByStoreId["store-sissys-little-rock"].map(cloneMember) };
}

export function getTeamComposition(storeId: string, locationId?: string | null) {
  const members = listStoreTeamMembers(storeId, locationId);
  const assessedMembers = members.filter((member) => member.assessed !== false);
  const counts = assessedMembers.reduce<Record<ProfileCode, number>>(
    (acc, member) => {
      acc[member.primary] += 1;
      return acc;
    },
    { V: 0, C: 0, F: 0, D: 0 },
  );
  const total = Math.max(assessedMembers.length, 1);
  const mix = Object.fromEntries(
    Object.entries(counts).map(([key, count]) => [key, Math.round((count / total) * 100)]),
  ) as Mix;
  const location = locationId ? LOCATIONS.find((item) => item.id === locationId) : undefined;
  return {
    floorType: location?.floorType || "Powerhouse",
    mix,
    counts,
    tested: assessedMembers.length,
    total: members.length,
    members,
  };
}
