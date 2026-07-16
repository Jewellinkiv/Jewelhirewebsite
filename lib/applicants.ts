// Applicant CRM (Phase 1 — store-scoped). Searchable archive of every applicant
// to this store, past and present, with notes/history. Mock data.

export type AppStatus = "Active" | "Hired" | "Rejected" | "Withdrawn";

export interface ApplicantNote {
  author: string;
  when: string;
  text: string;
}

export interface ApplicantRecord {
  id: string;
  linkable: boolean; // has a candidate detail page
  name: string;
  initials: string;
  role: string;
  status: AppStatus;
  stage: string;
  appliedDate: string;
  lastActivity: string;
  email: string;
  notes: ApplicantNote[];
}

export const APPLICANTS: ApplicantRecord[] = [
  {
    id: "maya-chen", linkable: true, name: "Maya Chen", initials: "MC", role: "Sales Associate",
    status: "Active", stage: "Interview", appliedDate: "Jun 17, 2026", lastActivity: "2h ago",
    email: "maya.chen@email.com",
    notes: [
      { author: "Maria King", when: "Today, 9:42 AM", text: "Strong client-service language. Loved the bridal experience. Move to interview." },
      { author: "William Jones", when: "Jun 19", text: "JewelCert 68 — coach on diamonds before high-ticket sales." },
    ],
  },
  {
    id: "devon-ross", linkable: true, name: "Devon Ross", initials: "DR", role: "Bench Jeweler",
    status: "Active", stage: "GemMatch", appliedDate: "Jun 20, 2026", lastActivity: "1d ago",
    email: "devon.ross@email.com",
    notes: [{ author: "William Jones", when: "Jun 22", text: "Excellent bench portfolio. Strong fit (88). Schedule interview." }],
  },
  {
    id: "ana-raper", linkable: true, name: "Ana Raper", initials: "AR", role: "Sales Associate",
    status: "Active", stage: "GemMatch", appliedDate: "Jun 15, 2026", lastActivity: "3d ago",
    email: "ana.raper@email.com",
    notes: [{ author: "Maria King", when: "Jun 18", text: "High drive but JewelCert flagged. Better fit for a different floor — hold." }],
  },
  {
    id: "jess-wood", linkable: true, name: "Jess Wood", initials: "JW", role: "Sales Manager",
    status: "Hired", stage: "Hired", appliedDate: "Jun 6, 2026", lastActivity: "5d ago",
    email: "jess.wood@email.com",
    notes: [{ author: "William Jones", when: "Jun 18", text: "Offer accepted. Added to JewelLink. Start date Jul 1." }],
  },
  {
    id: "bryan-lett", linkable: true, name: "Bryan Lett", initials: "BL", role: "Sales Associate",
    status: "Active", stage: "JewelCert", appliedDate: "Jun 21, 2026", lastActivity: "1d ago",
    email: "bryan.lett@email.com", notes: [],
  },
  {
    id: "kate-pryor", linkable: true, name: "Kate Pryor", initials: "KP", role: "Sales Associate",
    status: "Active", stage: "Applied", appliedDate: "Jun 23, 2026", lastActivity: "4h ago",
    email: "kate.pryor@email.com",
    notes: [{ author: "William Jones", when: "Today", text: "Walk-in referral from Sara. Send JewelCert." }],
  },
  // --- Past applicants (searchable archive) ---
  {
    id: "tom-alder", linkable: false, name: "Tom Alder", initials: "TA", role: "Sales Associate",
    status: "Rejected", stage: "Rejected", appliedDate: "Mar 2, 2026", lastActivity: "Mar 2026",
    email: "tom.alder@email.com",
    notes: [{ author: "Maria King", when: "Mar 9", text: "Not enough luxury experience this round. Re-engage if he completes courses." }],
  },
  {
    id: "rae-jenkins", linkable: false, name: "Rae Jenkins", initials: "RJ", role: "Bridal Specialist",
    status: "Withdrawn", stage: "Withdrawn", appliedDate: "Feb 14, 2026", lastActivity: "Feb 2026",
    email: "rae.jenkins@email.com",
    notes: [{ author: "William Jones", when: "Feb 20", text: "Withdrew — took another offer. Strong candidate, keep warm for future bridal opening." }],
  },
  {
    id: "leo-park", linkable: false, name: "Leo Park", initials: "LP", role: "Sales Manager",
    status: "Hired", stage: "Hired", appliedDate: "Nov 3, 2025", lastActivity: "Nov 2025",
    email: "leo.park@email.com",
    notes: [{ author: "William Jones", when: "Nov 12", text: "Hired into Memphis. Great Powerhouse-floor leader." }],
  },
];

// ---- Unified applicant profile (persistent person record) ----
// Applicants & candidates are one record, kept for years, with notes,
// timeline, application history (repeat applies), and combined JewelCert results.

export interface AppHistory {
  id: string;
  role: string;
  appliedDate: string;
  outcome: "In progress" | "Hired" | "Rejected" | "Withdrawn";
  note?: string;
}

export interface TestScore { name: string; score: number; label: string; }

export interface ApplicantProfile {
  about: string;
  headline?: string;
  phone?: string;
  location?: string;
  skills?: string[];
  experience?: string[];
  education?: string[];
  applications: AppHistory[]; // newest first
  gemmatch?: {
    type: string;
    primary: import("./gemmatch").ProfileCode;
    mix: import("./gemmatch").Mix;
    fitScore?: number;
    tier?: import("./gemmatch").FitTier;
  };
  tests: TestScore[];
}

export const PROFILE_EXTRAS: Record<string, ApplicantProfile> = {
  "maya-chen": {
    about: "Six years in luxury retail and clienteling. Relationship-first, strong bridal experience.",
    applications: [
      { id: "a-mc-2", role: "Sales Associate", appliedDate: "Jun 17, 2026", outcome: "In progress", note: "Current — in interview." },
      { id: "a-mc-1", role: "Seasonal Sales", appliedDate: "Nov 12, 2024", outcome: "Rejected", note: "Strong, but role filled. Encouraged to re-apply." },
    ],
    gemmatch: { type: "Luxury Advisor", primary: "C", mix: { V: 10, C: 55, F: 25, D: 10 }, fitScore: 74, tier: "Good fit" },
    tests: [
      { name: "Jewelry Knowledge", score: 68, label: "Foundational" },
      { name: "12 Essentials", score: 81, label: "Strong" },
      { name: "Sales Personality", score: 77, label: "Relationship Champion" },
    ],
  },
  "devon-ross": {
    about: "Bench jeweler and CAD designer, 9 years. Precision and quality focused.",
    applications: [{ id: "a-dr-1", role: "Bench Jeweler", appliedDate: "Jun 20, 2026", outcome: "In progress" }],
    gemmatch: { type: "Master Craftsman", primary: "F", mix: { V: 25, C: 5, F: 55, D: 15 }, fitScore: 88, tier: "Strong fit" },
    tests: [{ name: "Jewelry Knowledge", score: 92, label: "Advanced" }],
  },
  "ana-raper": {
    about: "Six years customer-facing sales. High drive, relationship-focused.",
    applications: [
      { id: "a-ar-2", role: "Sales Associate", appliedDate: "Jun 15, 2026", outcome: "In progress" },
      { id: "a-ar-1", role: "Sales Associate", appliedDate: "Aug 3, 2025", outcome: "Withdrawn", note: "Withdrew before assessment." },
    ],
    gemmatch: { type: "Trailblazer", primary: "V", mix: { V: 60, C: 10, F: 0, D: 30 }, fitScore: 32, tier: "Poor fit" },
    tests: [{ name: "Jewelry Knowledge", score: 41, label: "Developing" }],
  },
  "jess-wood": {
    about: "Sales manager with a track record of building high-performing teams.",
    applications: [{ id: "a-jw-1", role: "Sales Manager", appliedDate: "Jun 6, 2026", outcome: "Hired" }],
    gemmatch: { type: "Sales Strategist", primary: "D", mix: { V: 20, C: 30, F: 10, D: 40 }, fitScore: 71, tier: "Good fit" },
    tests: [{ name: "Jewelry Knowledge", score: 79, label: "Proficient" }],
  },
  "tom-alder": {
    about: "Retail sales background, building luxury experience.",
    applications: [
      { id: "a-ta-2", role: "Sales Associate", appliedDate: "Mar 2, 2026", outcome: "Rejected" },
      { id: "a-ta-1", role: "Sales Associate", appliedDate: "Jul 18, 2025", outcome: "Rejected", note: "Re-applied after first pass." },
    ],
    tests: [{ name: "Jewelry Knowledge", score: 55, label: "Foundational" }],
  },
};

export function getApplicant(id: string): ApplicantRecord | undefined {
  return APPLICANTS.find((a) => a.id === id);
}

export function getApplicantProfile(id: string): ApplicantProfile {
  return PROFILE_EXTRAS[id] ?? { about: "", applications: [], tests: [] };
}
