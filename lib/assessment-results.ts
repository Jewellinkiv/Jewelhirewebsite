// Mock manager-facing assessment results for the legacy aptitude tests.
// Shapes follow docs/assessment-model.md (Assessment Attempt + Assessment Result).
// In production these come from the API; here they seed the review surface.

export type ResultType = "knowledge_check" | "trait_profile";

export interface CategoryScore {
  target: string;
  score: number;
  max: number;
  pct: number;
}

export interface TraitScore {
  trait: string;
  pct: number;
  level: "Strong" | "Solid" | "Developing" | "Low";
}

export interface AnswerReviewItem {
  n: number;
  prompt: string;
  target: string;
  selected: { text: string; points: number };
  preferred?: { text: string; points: number }; // knowledge checks only
  correct?: boolean; // knowledge checks only
}

export interface FollowUp {
  course: string;
  reason: string;
  href: string;
}

export interface AssessmentResult {
  slug: string;
  title: string;
  type: ResultType;
  candidate: { id: string; name: string; initials: string; role: string };
  completedAt: string;
  durationMinutes: number;
  status: "Needs review" | "Reviewed";
  totalScore: number; // 0..100
  scoreLabel: string;
  summary: string;
  categories?: CategoryScore[];
  traits?: TraitScore[];
  answerReview: AnswerReviewItem[];
  recommendation: { decision: string; text: string };
  followUps: FollowUp[];
}

const MAYA = { id: "maya-chen", name: "Maya Chen", initials: "MC", role: "Sales Associate" };

export const ASSESSMENT_RESULTS: Record<string, AssessmentResult> = {
  "jewelry-basic-knowledge": {
    slug: "jewelry-basic-knowledge",
    title: "Jewelry Basic Knowledge Assessment",
    type: "knowledge_check",
    candidate: MAYA,
    completedAt: "Jun 19, 2026",
    durationMinutes: 41,
    status: "Needs review",
    totalScore: 68,
    scoreLabel: "Foundational",
    summary:
      "Strong on metals and repairs, with clear gaps in diamonds and gemstones. Solid base for a sales role, but recommend knowledge coaching before leading diamond conversations.",
    categories: [
      { target: "Metals", score: 4, max: 4, pct: 100 },
      { target: "Gemstones", score: 2, max: 3, pct: 67 },
      { target: "Diamonds", score: 2, max: 4, pct: 50 },
      { target: "Jewelry Types", score: 3, max: 4, pct: 75 },
      { target: "Settings & Mountings", score: 1, max: 3, pct: 33 },
      { target: "Watches", score: 1, max: 2, pct: 50 },
      { target: "Jewelry Repairs", score: 2, max: 2, pct: 100 },
    ],
    answerReview: [
      {
        n: 1,
        prompt: "What is the primary reason for rhodium plating on white gold?",
        target: "Metals",
        selected: { text: "Provide a bright, white, and reflective finish", points: 4 },
        preferred: { text: "Provide a bright, white, and reflective finish", points: 4 },
        correct: true,
      },
      {
        n: 2,
        prompt: "Which marking are you most likely to see on sterling silver?",
        target: "Metals",
        selected: { text: "925", points: 4 },
        preferred: { text: "925", points: 4 },
        correct: true,
      },
      {
        n: 4,
        prompt: "Which gemstone is the hardest on the Mohs scale?",
        target: "Gemstones",
        selected: { text: "Sapphire", points: 1 },
        preferred: { text: "Diamond", points: 4 },
        correct: false,
      },
      {
        n: 7,
        prompt: 'What does "fire" mean when it pertains to diamonds?',
        target: "Diamonds",
        selected: { text: "The sparkle produced by its facets", points: 1 },
        preferred: { text: "The dispersion of light into spectral colors", points: 4 },
        correct: false,
      },
      {
        n: 8,
        prompt: 'What does "clarity" measure in a diamond?',
        target: "Diamonds",
        selected: { text: "The diamond's ability to refract light", points: 1 },
        preferred: { text: "The presence of inclusions and blemishes", points: 4 },
        correct: false,
      },
    ],
    recommendation: {
      decision: "Advance with coaching",
      text:
        "Maya's product knowledge is a good base, not a blocker for a relationship-led sales role. Before she leads high-ticket diamond sales, assign the diamonds/gemstones training below and re-check.",
    },
    followUps: [
      { course: "Mastering the Four C's: A Guide to Diamond Excellence", reason: "Closes the Diamonds gap (50%)", href: "/learn" },
      { course: "Gemstone Essentials", reason: "Reinforces Gemstones (67%)", href: "/learn" },
    ],
  },

  "sales-personality": {
    slug: "sales-personality",
    title: "Sales Personality Profiling Test",
    type: "trait_profile",
    candidate: MAYA,
    completedAt: "Jun 19, 2026",
    durationMinutes: 22,
    status: "Needs review",
    totalScore: 0,
    scoreLabel: "Relationship Champion",
    summary:
      "Leans strongly to Relationship Champion with solid Detail-Oriented Educator support — consistent with her JewelCert Luxury Advisor profile. Lower on Assertive Negotiator; pair with a closer on high-pressure deals.",
    traits: [
      { trait: "Relationship Champion", pct: 86, level: "Strong" },
      { trait: "Detail-Oriented Educator", pct: 64, level: "Solid" },
      { trait: "Strategic Closer", pct: 41, level: "Developing" },
      { trait: "Assertive Negotiator", pct: 28, level: "Low" },
    ],
    answerReview: [
      {
        n: 5,
        prompt: "How do you prefer to build a sale?",
        target: "Relationship Champion",
        selected: { text: "Get to know the client and what the moment means to them", points: 4 },
      },
      {
        n: 11,
        prompt: "A client is unsure between two pieces. You…",
        target: "Detail-Oriented Educator",
        selected: { text: "Walk them through the differences so they decide with confidence", points: 3 },
      },
      {
        n: 18,
        prompt: "When a deal stalls on price, you…",
        target: "Assertive Negotiator",
        selected: { text: "Give them space and follow up later", points: 1 },
      },
    ],
    recommendation: {
      decision: "Strong cultural fit",
      text:
        "Her relationship-first style fits clienteling and bridal. To protect margin on high-ticket deals, partner her with a Strategic Closer / Determined teammate rather than coaching her into a hard-closer role.",
    },
    followUps: [
      { course: "Confident Closing Without the Pressure", reason: "Lifts Assertive Negotiator (28%)", href: "/learn" },
    ],
  },
};

export function getAssessmentResult(slug: string): AssessmentResult | undefined {
  return ASSESSMENT_RESULTS[slug];
}

export const COMPLETED_RESULTS = Object.values(ASSESSMENT_RESULTS);
