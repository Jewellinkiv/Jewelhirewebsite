// Multi-location team. A store (org) has several locations; associates belong
// to one location and can be reassigned. Mock data.

import { ProfileCode } from "./gemmatch";

export interface Location {
  id: string;
  name: string;
  floorType: string;
}

export interface TeamMemberLoc {
  id: string;
  name: string;
  initials: string;
  role: string;
  type: string;
  primary: ProfileCode;
  assessed?: boolean;
  locationId: string;
}

export const LOCATIONS: Location[] = [
  { id: "little-rock", name: "Little Rock", floorType: "Powerhouse" },
  { id: "memphis", name: "Memphis", floorType: "Harmony" },
  { id: "jonesboro", name: "Jonesboro", floorType: "Balanced Boutique" },
];

export const TEAM_MEMBERS: TeamMemberLoc[] = [
  // Little Rock
  { id: "t1", name: "Zach East", initials: "ZE", role: "Sales Associate", type: "Trailblazer", primary: "V", locationId: "little-rock" },
  { id: "t2", name: "Maria King", initials: "MK", role: "Sales Manager", type: "Visionary Leader", primary: "D", locationId: "little-rock" },
  { id: "t3", name: "Jon Diaz", initials: "JD", role: "Sales Associate", type: "Sales Strategist", primary: "D", locationId: "little-rock" },
  { id: "t4", name: "Bryan Webb", initials: "BW", role: "Sales Associate", type: "Innovator", primary: "V", locationId: "little-rock" },
  { id: "t5", name: "Sara Pope", initials: "SP", role: "Bridal Specialist", type: "Luxury Advisor", primary: "C", locationId: "little-rock" },
  { id: "t6", name: "Tomás Lee", initials: "TL", role: "Repair Coordinator", type: "Operational Anchor", primary: "F", locationId: "little-rock" },
  // Memphis
  { id: "t7", name: "Leo Park", initials: "LP", role: "Sales Manager", type: "Team Captain", primary: "C", locationId: "memphis" },
  { id: "t8", name: "Nina Cole", initials: "NC", role: "Sales Associate", type: "Harmony Builder", primary: "C", locationId: "memphis" },
  { id: "t9", name: "Drew Hart", initials: "DH", role: "Bench Jeweler", type: "Master Craftsman", primary: "F", locationId: "memphis" },
  // Jonesboro
  { id: "t10", name: "Priya Shah", initials: "PS", role: "Store Manager", type: "Architect", primary: "V", locationId: "jonesboro" },
  { id: "t11", name: "Cole Reed", initials: "CR", role: "Sales Associate", type: "Motivator", primary: "C", locationId: "jonesboro" },
];

export function locationName(id: string): string {
  return LOCATIONS.find((l) => l.id === id)?.name ?? id;
}
