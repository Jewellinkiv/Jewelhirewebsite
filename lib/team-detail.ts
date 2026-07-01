// Extra per-associate detail for the Team map table (augments lib/data TEAM).
// Mock data; joins on the TeamMember id.

import { FitTier } from "./gemmatch";

export interface AssociateDetail {
  tenure: string;
  floorFit: number; // how well they fit the current floor type
  fitTier: FitTier;
  lastAssessed: string;
  status: "Active" | "On leave" | "New";
  secondary: string; // secondary profile lane
}

export const ASSOCIATE_DETAIL: Record<string, AssociateDetail> = {
  t1: { tenure: "3y 2m", floorFit: 88, fitTier: "Strong fit", lastAssessed: "May 2026", status: "Active", secondary: "Determined" },
  t2: { tenure: "6y 1m", floorFit: 84, fitTier: "Strong fit", lastAssessed: "Apr 2026", status: "Active", secondary: "Visionary" },
  t3: { tenure: "1y 8m", floorFit: 79, fitTier: "Strong fit", lastAssessed: "May 2026", status: "Active", secondary: "Connector" },
  t4: { tenure: "2y 4m", floorFit: 82, fitTier: "Strong fit", lastAssessed: "Mar 2026", status: "Active", secondary: "Foundation" },
  t5: { tenure: "4y 0m", floorFit: 71, fitTier: "Good fit", lastAssessed: "May 2026", status: "Active", secondary: "Visionary" },
  t6: { tenure: "2y 9m", floorFit: 68, fitTier: "Good fit", lastAssessed: "Feb 2026", status: "On leave", secondary: "Determined" },
};
