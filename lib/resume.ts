// Associate resume builder model (Phase 1 — associate-facing, job-seeker owned).
// Completed course credentials appear on the resume automatically (see
// docs/applicant-lifecycle-model.md → Applicant Resume / course_credential_ids).

export interface Experience {
  id: string;
  title: string;
  company: string;
  period: string;
  detail: string;
}

export interface Education {
  id: string;
  school: string;
  credential: string;
  year: string;
}

export interface CourseCredential {
  id: string;
  title: string;
  issuer: string;
  completed: boolean;
  completedOn?: string;
}

export interface Resume {
  fullName: string;
  headline: string;
  location: string;
  email: string;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  courseCredentials: CourseCredential[];
}

// Seed resume — pre-filled so the preview reads as a real associate profile.
export const SEED_RESUME: Resume = {
  fullName: "Maya Chen",
  headline: "Luxury sales & clienteling · 6 years",
  location: "Little Rock, AR",
  email: "maya.chen@email.com",
  summary:
    "Client-focused jewelry sales associate with six years building repeat bridal and fine-jewelry relationships. Known for warm consultative selling, careful follow-up, and a calm hand with high-value pieces.",
  experience: [
    {
      id: "exp1",
      title: "Senior Sales Associate",
      company: "Sterling & Vine Fine Jewelry",
      period: "2021 — Present",
      detail: "Lead clienteling for the bridal salon; grew repeat-client revenue ~30% through structured follow-up.",
    },
    {
      id: "exp2",
      title: "Sales Associate",
      company: "Harbor Gold",
      period: "2019 — 2021",
      detail: "Showroom sales and custom-order intake; top performer for two consecutive quarters.",
    },
  ],
  education: [
    {
      id: "edu1",
      school: "University of Arkansas",
      credential: "B.A., Communications",
      year: "2019",
    },
  ],
  skills: ["Clienteling", "Bridal & fine jewelry", "CRM follow-up", "Custom orders", "Diamond grading basics"],
  // Course credentials sourced from completed JewelLink courses (mirrors the
  // CREDENTIALS idea in app/apply/[job]/page.tsx). Completed ones show on the resume.
  courseCredentials: [
    { id: "c1", title: "Jewelry Basics", issuer: "JewelLink", completed: true, completedOn: "Mar 2026" },
    { id: "c2", title: "Luxury Client Service", issuer: "JewelLink", completed: true, completedOn: "Apr 2026" },
    { id: "c3", title: "Diamonds & the Four C's", issuer: "JewelLink", completed: false },
  ],
};
