// Store hiring pipeline (Phase 1 — single store, private applicants).
// Mock data; in production this comes from the API. JewelCert + fit
// are screening signals; managers filter, note, interview, and hire → JewelLink.

import { FitTier, ProfileCode } from "./gemmatch";

export type Stage = "Applied" | "JewelCert" | "GemMatch" | "Interview" | "Hired" | "Rejected";

export type JewelCertStatus = "Not sent" | "Sent" | "Completed" | "Passed" | "Flagged";

export interface PipelineApplicant {
  id: string; // matches a candidate detail route
  name: string;
  initials: string;
  role: string;
  location: string;
  stage: Stage;
  jewelcert: { status: JewelCertStatus; score?: number };
  gemmatch?: { type: string; primary: ProfileCode; fitScore?: number; tier?: FitTier };
  notes: number;
  lastActivity: string;
  interviewAt?: string;
}

export const STAGES: Stage[] = ["Applied", "JewelCert", "GemMatch", "Interview", "Hired", "Rejected"];

export const PIPELINE: PipelineApplicant[] = [
  {
    id: "kate-pryor", name: "Kate Pryor", initials: "KP", role: "Sales Associate", location: "Conway, AR",
    stage: "Applied", jewelcert: { status: "Not sent" }, notes: 1, lastActivity: "4h ago",
  },
  {
    id: "bryan-lett", name: "Bryan Lett", initials: "BL", role: "Sales Associate", location: "Little Rock, AR",
    stage: "JewelCert", jewelcert: { status: "Sent" }, notes: 0, lastActivity: "1d ago",
  },
  {
    id: "maya-chen", name: "Maya Chen", initials: "MC", role: "Sales Associate", location: "Little Rock, AR",
    stage: "Interview", jewelcert: { status: "Completed", score: 68 },
    gemmatch: { type: "Luxury Advisor", primary: "C", fitScore: 74, tier: "Good fit" },
    notes: 3, lastActivity: "2h ago", interviewAt: "Thu 2:30 PM",
  },
  {
    id: "devon-ross", name: "Devon Ross", initials: "DR", role: "Bench Jeweler", location: "Little Rock, AR",
    stage: "GemMatch", jewelcert: { status: "Passed", score: 88 },
    gemmatch: { type: "Master Craftsman", primary: "F", fitScore: 88, tier: "Strong fit" },
    notes: 1, lastActivity: "1d ago",
  },
  {
    id: "ana-raper", name: "Ana Raper", initials: "AR", role: "Sales Associate", location: "Little Rock, AR",
    stage: "GemMatch", jewelcert: { status: "Flagged", score: 41 },
    gemmatch: { type: "Trailblazer", primary: "V", fitScore: 32, tier: "Poor fit" },
    notes: 2, lastActivity: "3d ago",
  },
  {
    id: "jess-wood", name: "Jess Wood", initials: "JW", role: "Sales Manager", location: "Little Rock, AR",
    stage: "Hired", jewelcert: { status: "Passed", score: 79 },
    gemmatch: { type: "Sales Strategist", primary: "D", fitScore: 71, tier: "Good fit" },
    notes: 4, lastActivity: "5d ago",
  },
];
