// Job postings with KPIs + full applicant history over time.
// Duplicates are intentional — a person can apply to the same job multiple times.

export type JobStage = "Applied" | "JewelCert" | "GemMatch" | "Interview" | "Hired" | "Rejected" | "Withdrawn";

export interface JobApplicantRow {
  id: string; // applicant id (links to /applicants/[id])
  name: string;
  initials: string;
  appliedDate: string;
  attempt: number; // 1 = first time, 2+ = re-applied
  stage: JobStage;
  fitScore?: number;
  fitTier?: string;
}

export interface JobPosting {
  slug: string;
  title: string;
  location: string;
  status: "Active" | "Draft" | "Paused" | "Closed";
  postedDaysAgo: number;
  openings: number;
  views: number;
  applicants: JobApplicantRow[]; // newest first; duplicates allowed
}

export const JOB_POSTINGS: JobPosting[] = [
  {
    slug: "sales-associate", title: "Sales Associate", location: "Little Rock", status: "Active",
    postedDaysAgo: 34, openings: 2, views: 540,
    applicants: [
      { id: "kate-pryor", name: "Kate Pryor", initials: "KP", appliedDate: "Jun 23, 2026", attempt: 1, stage: "Applied" },
      { id: "bryan-lett", name: "Bryan Lett", initials: "BL", appliedDate: "Jun 21, 2026", attempt: 1, stage: "JewelCert" },
      { id: "maya-chen", name: "Maya Chen", initials: "MC", appliedDate: "Jun 17, 2026", attempt: 2, stage: "Interview", fitScore: 74, fitTier: "Good fit" },
      { id: "ana-raper", name: "Ana Raper", initials: "AR", appliedDate: "Jun 15, 2026", attempt: 2, stage: "GemMatch", fitScore: 32, fitTier: "Poor fit" },
      { id: "tom-alder", name: "Tom Alder", initials: "TA", appliedDate: "Mar 2, 2026", attempt: 2, stage: "Rejected" },
      { id: "ana-raper", name: "Ana Raper", initials: "AR", appliedDate: "Aug 3, 2025", attempt: 1, stage: "Withdrawn" },
      { id: "tom-alder", name: "Tom Alder", initials: "TA", appliedDate: "Jul 18, 2025", attempt: 1, stage: "Rejected" },
      { id: "maya-chen", name: "Maya Chen", initials: "MC", appliedDate: "Nov 12, 2024", attempt: 1, stage: "Rejected" },
    ],
  },
  {
    slug: "sales-manager", title: "Sales Manager", location: "Little Rock", status: "Active",
    postedDaysAgo: 28, openings: 1, views: 210,
    applicants: [
      { id: "jess-wood", name: "Jess Wood", initials: "JW", appliedDate: "Jun 6, 2026", attempt: 1, stage: "Hired", fitScore: 71, fitTier: "Good fit" },
    ],
  },
  {
    slug: "bench-jeweler", title: "Bench Jeweler", location: "Little Rock", status: "Active",
    postedDaysAgo: 9, openings: 1, views: 95,
    applicants: [
      { id: "devon-ross", name: "Devon Ross", initials: "DR", appliedDate: "Jun 20, 2026", attempt: 1, stage: "GemMatch", fitScore: 88, fitTier: "Strong fit" },
    ],
  },
];

export function getPosting(slug: string): JobPosting | undefined {
  return JOB_POSTINGS.find((j) => j.slug === slug);
}
export function getPostingByTitle(title: string): JobPosting | undefined {
  return JOB_POSTINGS.find((j) => j.title === title);
}

export function postingKpis(j: JobPosting) {
  const total = j.applicants.length;
  const unique = new Set(j.applicants.map((a) => a.id)).size;
  const hired = j.applicants.filter((a) => a.stage === "Hired").length;
  const withFit = j.applicants.filter((a) => a.fitScore != null);
  const avgFit = withFit.length ? Math.round(withFit.reduce((s, a) => s + (a.fitScore ?? 0), 0) / withFit.length) : null;
  const applyRate = j.views ? Math.round((total / j.views) * 1000) / 10 : 0;
  return { total, unique, hired, avgFit, applyRate };
}
