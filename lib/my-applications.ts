// Associate "My applications" model (Phase 1 — associate-facing, job-seeker owned).
//
// Privacy: this view shows ONLY the stores the associate has actually applied to
// (see docs/applicant-lifecycle-model.md → Phase 1 Privacy Rules). There is no
// browsing of other companies' jobs and no shared talent pool in Phase 1.
//
// Stages mirror the Application.stage values in the lifecycle model:
//   applied → jewelcert → gemmatch → interview → offer → hired
//   (terminal: rejected, withdrawn)

export type ApplicationStage =
  | "applied"
  | "jewelcert"
  | "gemmatch"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

export interface StoreApplication {
  id: string;
  store: string;
  storeLocation: string;
  role: string;
  stage: ApplicationStage;
  submittedAt: string;
  // The associate's next step — e.g. "Complete GemMatch". Optional for terminal stages.
  nextStep?: string;
  // Optional href the next-step CTA points to (associate-facing routes only).
  nextStepHref?: string;
}

// Display metadata per stage: a label and a chip color treatment. Kept here so the
// page and any future associate surfaces share one source of truth.
export const STAGE_META: Record<
  ApplicationStage,
  { label: string; tone: "active" | "good" | "pending" | "closed" }
> = {
  applied: { label: "Applied", tone: "pending" },
  jewelcert: { label: "JewelCert", tone: "active" },
  gemmatch: { label: "GemMatch", tone: "active" },
  interview: { label: "Interview", tone: "active" },
  offer: { label: "Offer", tone: "good" },
  hired: { label: "Hired", tone: "good" },
  rejected: { label: "Not selected", tone: "closed" },
  withdrawn: { label: "Withdrawn", tone: "closed" },
};

// Ordered pipeline used to render a simple progress track on each card.
export const STAGE_FLOW: ApplicationStage[] = [
  "applied",
  "jewelcert",
  "gemmatch",
  "interview",
  "offer",
  "hired",
];

// Seed applications — only stores this associate applied to (private, Phase 1).
export const SEED_APPLICATIONS: StoreApplication[] = [
  {
    id: "app-sissys-lsa",
    store: "Sissy's Log Cabin",
    storeLocation: "Little Rock, AR",
    role: "Luxury Jewelry Sales Associate",
    stage: "gemmatch",
    submittedAt: "Jun 12, 2026",
    nextStep: "Complete your GemMatch assessment (~3 min)",
    nextStepHref: "/portal/invites",
  },
  {
    id: "app-harbor-gold-sm",
    store: "Harbor Gold",
    storeLocation: "Memphis, TN",
    role: "Sales Manager",
    stage: "interview",
    submittedAt: "Jun 5, 2026",
    nextStep: "Interview scheduled — confirm your time",
  },
  {
    id: "app-sterling-vine-csa",
    store: "Sterling & Vine Fine Jewelry",
    storeLocation: "Little Rock, AR",
    role: "Client Service Associate",
    stage: "jewelcert",
    submittedAt: "Jun 18, 2026",
    nextStep: "Finish your JewelCert knowledge check",
  },
  {
    id: "app-bluewater-bench",
    store: "Bluewater Jewelers",
    storeLocation: "Conway, AR",
    role: "Bench Jeweler",
    stage: "applied",
    submittedAt: "Jun 21, 2026",
    nextStep: "Application received — the store is reviewing it",
  },
  {
    id: "app-haldens-offer",
    store: "Halden's Fine Gems",
    storeLocation: "Fayetteville, AR",
    role: "Senior Sales Associate",
    stage: "offer",
    submittedAt: "May 28, 2026",
    nextStep: "Offer extended — review the details",
  },
  {
    id: "app-northpoint-closed",
    store: "Northpoint Diamonds",
    storeLocation: "Rogers, AR",
    role: "Seasonal Sales Associate",
    stage: "rejected",
    submittedAt: "May 14, 2026",
  },
];
