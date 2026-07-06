// Applicants a JewelCert has been sent to (via a JewelCert that included the pick-10 profile).
// Surfaces send status + the resulting fit. Mock data.

import { FitTier, ProfileCode } from "./gemmatch";

export type SendStatus = "Sent" | "Started" | "Completed";

export interface GemMatchSentRow {
  id: string; // applicant id → /applicants/[id]
  name: string;
  initials: string;
  role: string;
  sentDate: string;
  status: SendStatus;
  type?: string;
  primary?: ProfileCode;
  fitScore?: number;
  fitTier?: FitTier;
}

export const GEMMATCH_SENT: GemMatchSentRow[] = [
  { id: "devon-ross", name: "Devon Ross", initials: "DR", role: "Bench Jeweler", sentDate: "Jun 20, 2026", status: "Completed", type: "Master Craftsman", primary: "F", fitScore: 88, fitTier: "Strong fit" },
  { id: "maya-chen", name: "Maya Chen", initials: "MC", role: "Sales Associate", sentDate: "Jun 18, 2026", status: "Completed", type: "Luxury Advisor", primary: "C", fitScore: 74, fitTier: "Good fit" },
  { id: "jess-wood", name: "Jess Wood", initials: "JW", role: "Sales Manager", sentDate: "Jun 8, 2026", status: "Completed", type: "Sales Strategist", primary: "D", fitScore: 71, fitTier: "Good fit" },
  { id: "ana-raper", name: "Ana Raper", initials: "AR", role: "Sales Associate", sentDate: "Jun 16, 2026", status: "Completed", type: "Trailblazer", primary: "V", fitScore: 32, fitTier: "Poor fit" },
  { id: "bryan-lett", name: "Bryan Lett", initials: "BL", role: "Sales Associate", sentDate: "Jun 21, 2026", status: "Started" },
  { id: "kate-pryor", name: "Kate Pryor", initials: "KP", role: "Sales Associate", sentDate: "Jun 23, 2026", status: "Sent" },
];
