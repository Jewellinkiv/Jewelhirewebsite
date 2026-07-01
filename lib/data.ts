// Mock data for the frontend prototype.
// In production this comes from the API; fit fields come from the matching service.

import { Mix, ProfileCode, FitBreakdown } from "./gemmatch";

export type CandidateStatus =
  | "New"
  | "Cert sent"
  | "Assessed"
  | "In review"
  | "Interview"
  | "Hired"
  | "Rejected";

export interface GemMatchSummary {
  mix: Mix;
  primary: ProfileCode;
  secondary: ProfileCode;
  type: string;
  clarity: string;
  strengths: string[];
  watchOuts: string[];
  manageNotes: string[];
}

export interface Candidate {
  id: string;
  name: string;
  initials: string;
  role: string;
  location: string;
  email: string;
  phone: string;
  note: string;
  resume?: string;
  appliedDaysAgo: number;
  status: CandidateStatus;
  gemmatch?: GemMatchSummary;
  fit?: FitBreakdown;
}

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  type: string;
  primary: ProfileCode;
}

export const TEAM: TeamMember[] = [
  { id: "t1", name: "Zach East", initials: "ZE", role: "Sales Associate", type: "Trailblazer", primary: "V" },
  { id: "t2", name: "Maria King", initials: "MK", role: "Sales Manager", type: "Visionary Leader", primary: "D" },
  { id: "t3", name: "Jon Diaz", initials: "JD", role: "Sales Associate", type: "Sales Strategist", primary: "D" },
  { id: "t4", name: "Bryan Webb", initials: "BW", role: "Sales Associate", type: "Innovator", primary: "V" },
  { id: "t5", name: "Sara Pope", initials: "SP", role: "Bridal Specialist", type: "Luxury Advisor", primary: "C" },
  { id: "t6", name: "Tomás Lee", initials: "TL", role: "Repair Coordinator", type: "Operational Anchor", primary: "F" },
];

export const TEAM_MIX: Mix = { V: 40, C: 12, F: 8, D: 40 };
export const FLOOR_TYPE = "Powerhouse";

export const CANDIDATES: Candidate[] = [
  {
    id: "maya-chen",
    name: "Maya Chen",
    initials: "MC",
    role: "Sales Associate",
    location: "Little Rock, Arkansas",
    email: "maya.chen@email.com",
    phone: "(501) 555-0148",
    note: "Six years in luxury retail and clienteling. I love building long-term client relationships and helping people mark big moments with the right piece.",
    resume: "maya-chen-resume.pdf",
    appliedDaysAgo: 6,
    status: "In review",
    gemmatch: {
      mix: { V: 10, C: 55, F: 25, D: 10 },
      primary: "C",
      secondary: "F",
      type: "Luxury Advisor",
      clarity: "Strong Connector",
      strengths: ["Builds client trust fast", "Reliable, service-first", "Calm, steady presence"],
      watchOuts: ["May avoid tough conversations", "Less comfortable under solo quota pressure"],
      manageNotes: [
        "Lead with recognition and a steady client book",
        "Give warmth-friendly goals, not pure pressure",
        "Pair with a Determined teammate to push pace",
      ],
    },
    fit: {
      fitScore: 74,
      tier: "Good fit",
      roleFit: 80,
      teamFit: 67,
      reasons: [
        "Strong match to the Sales Associate ideal (Connector-led)",
        "Fills the Connector + Foundation gaps on a drive-heavy floor",
        "Adds warmth and steadiness without amplifying drive",
      ],
    },
  },
  {
    id: "devon-ross",
    name: "Devon Ross",
    initials: "DR",
    role: "Bench Jeweler",
    location: "Little Rock, Arkansas",
    email: "devon.ross@email.com",
    phone: "(501) 555-0192",
    note: "Bench jeweler and CAD designer, 9 years. Precision and quality are everything to me.",
    resume: "devon-ross-resume.pdf",
    appliedDaysAgo: 3,
    status: "Assessed",
    gemmatch: {
      mix: { V: 25, C: 5, F: 55, D: 15 },
      primary: "F",
      secondary: "D",
      type: "Master Craftsman",
      clarity: "Clear Foundation",
      strengths: ["Exacting quality standards", "Steady and deliberate", "Strong technical focus"],
      watchOuts: ["Resists fast-paced churn", "Low small-talk in a team setting"],
      manageNotes: [
        "Give clear standards and measurable targets",
        "Protect focus time, minimize interruptions",
        "Recognize craftsmanship publicly",
      ],
    },
    fit: {
      fitScore: 88,
      tier: "Strong fit",
      roleFit: 92,
      teamFit: 80,
      reasons: [
        "Excellent match to the Bench Jeweler role (precision-led)",
        "Adds the Foundation the team is most short on",
        "Balances a drive-heavy floor with steadiness",
      ],
    },
  },
  {
    id: "ana-raper",
    name: "Ana Raper",
    initials: "AR",
    role: "Sales Associate",
    location: "Little Rock, Arkansas",
    email: "ana.raper@email.com",
    phone: "(501) 555-0177",
    note: "Six years in customer-facing sales across automotive and retail. Relationship-focused with strong closing skills.",
    appliedDaysAgo: 8,
    status: "In review",
    gemmatch: {
      mix: { V: 60, C: 10, F: 0, D: 30 },
      primary: "V",
      secondary: "D",
      type: "Trailblazer",
      clarity: "Clear Visionary",
      strengths: ["Ambitious and strategic", "Breaks plateaus", "Fearless initiative"],
      watchOuts: ["May skip process & detail", "Can struggle with team consensus"],
      manageNotes: [
        "Clear KPIs, autonomy, and a growth path",
        "Pair with a Foundation to steady execution",
      ],
    },
    fit: {
      fitScore: 32,
      tier: "Poor fit",
      roleFit: 50,
      teamFit: 11,
      reasons: [
        "Partial match to the people-first Sales Associate role",
        "Amplifies an already drive-heavy Powerhouse floor",
        "Would fit a Harmony or Precision store better",
      ],
    },
  },
  {
    id: "jess-wood",
    name: "Jess Wood",
    initials: "JW",
    role: "Sales Manager",
    location: "Little Rock, Arkansas",
    email: "jess.wood@email.com",
    phone: "(501) 555-0123",
    note: "Sales manager with a track record of building high-performing teams.",
    appliedDaysAgo: 11,
    status: "Interview",
    gemmatch: {
      mix: { V: 20, C: 30, F: 10, D: 40 },
      primary: "D",
      secondary: "C",
      type: "Sales Strategist",
      clarity: "Strong Determined lean",
      strengths: ["Results-driven closer", "People savvy", "Leads from the front"],
      watchOuts: ["Impatient with slower teammates"],
      manageNotes: ["Give targets and a team to lead", "Channel competitiveness into team goals"],
    },
    fit: {
      fitScore: 71,
      tier: "Good fit",
      roleFit: 84,
      teamFit: 55,
      reasons: [
        "Strong match to the Sales Manager role",
        "Adds Connector energy to leadership",
        "Slightly amplifies floor drive",
      ],
    },
  },
  {
    id: "bryan-lett",
    name: "Bryan Lett",
    initials: "BL",
    role: "Sales Associate",
    location: "Little Rock, Arkansas",
    email: "bryan.lett@email.com",
    phone: "(501) 555-0166",
    note: "Hard worker, eager to break into the jewelry industry.",
    appliedDaysAgo: 2,
    status: "Cert sent",
  },
  {
    id: "kate-pryor",
    name: "Kate Pryor",
    initials: "KP",
    role: "Sales Associate",
    location: "Conway, Arkansas",
    email: "kate.pryor@email.com",
    phone: "(501) 555-0101",
    note: "Retail background, looking for a luxury sales role.",
    appliedDaysAgo: 1,
    status: "New",
  },
];

export function getCandidate(id: string): Candidate | undefined {
  return CANDIDATES.find((c) => c.id === id);
}
