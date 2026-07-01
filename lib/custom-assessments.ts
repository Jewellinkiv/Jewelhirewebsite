// Store-created assessments. Stores can build their own assessments alongside
// the default, admin-created ones (GemMatch, legacy aptitude tests). Mock data.

export type AssessmentKind = "Knowledge check" | "Trait profile" | "Skills check";
export type QuestionType = "multiple-choice" | "scale" | "short-answer";

export interface AssessmentQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[]; // for multiple-choice
  answerIndex?: number; // correct option for knowledge checks
}

export interface CustomAssessment {
  id: string;
  title: string;
  description: string;
  kind: AssessmentKind;
  owner: "Store" | "Admin";
  status: "Draft" | "Published";
  questions: AssessmentQuestion[];
  updated: string;
}

export const CUSTOM_ASSESSMENTS: CustomAssessment[] = [
  {
    id: "ca1",
    title: "Diamond 4Cs — store knowledge",
    description: "Quick check on cut, color, clarity, and carat for new floor associates.",
    kind: "Knowledge check",
    owner: "Store",
    status: "Published",
    updated: "Jun 18, 2026",
    questions: [
      { id: "q1", type: "multiple-choice", prompt: "Which C refers to a diamond's sparkle and light return?", options: ["Carat", "Cut", "Clarity", "Color"], answerIndex: 1 },
      { id: "q2", type: "multiple-choice", prompt: "Color is graded on a scale from…", options: ["1–10", "A–F", "D–Z", "I–V"], answerIndex: 2 },
      { id: "q3", type: "short-answer", prompt: "In your own words, how would you explain clarity to a first-time buyer?" },
    ],
  },
  {
    id: "ca2",
    title: "Clienteling style",
    description: "How an associate prefers to build long-term client relationships.",
    kind: "Trait profile",
    owner: "Store",
    status: "Draft",
    updated: "Jun 21, 2026",
    questions: [
      { id: "q1", type: "scale", prompt: "I follow up with past clients on their important dates." },
      { id: "q2", type: "scale", prompt: "I enjoy guiding an undecided customer to the right piece." },
    ],
  },
];

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  "multiple-choice": "Multiple choice",
  scale: "1–5 scale",
  "short-answer": "Short answer",
};
