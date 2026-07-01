// Interview scheduling (Phase 1 — store-scoped). Mock data.

export type InterviewType = "In-person" | "Video" | "Phone";
export type InterviewStatus = "Scheduled" | "Completed" | "No-show";

export interface Interview {
  id: string;
  applicantId: string;
  linkable: boolean;
  name: string;
  initials: string;
  role: string;
  when: string;
  type: InterviewType;
  status: InterviewStatus;
  interviewer: string;
  notes: string;
  meetLink?: string;
  guests?: string[];
}

export const INTERVIEWS: Interview[] = [
  {
    id: "iv1", applicantId: "maya-chen", linkable: true, name: "Maya Chen", initials: "MC",
    role: "Sales Associate", when: "Thu Jun 25 · 2:30 PM", type: "In-person", status: "Scheduled",
    interviewer: "Maria King", notes: "Floor walk-through + clienteling scenario.",
  },
  {
    id: "iv2", applicantId: "devon-ross", linkable: true, name: "Devon Ross", initials: "DR",
    role: "Bench Jeweler", when: "Fri Jun 26 · 10:00 AM", type: "In-person", status: "Scheduled",
    interviewer: "William Jones", notes: "Bring portfolio; bench skills test.",
  },
  {
    id: "iv3", applicantId: "jess-wood", linkable: true, name: "Jess Wood", initials: "JW",
    role: "Sales Manager", when: "Mon Jun 15 · 1:00 PM", type: "Video", status: "Completed",
    interviewer: "William Jones", notes: "Strong leadership answers. Moved to offer.",
  },
  {
    id: "iv4", applicantId: "ana-raper", linkable: true, name: "Ana Raper", initials: "AR",
    role: "Sales Associate", when: "Wed Jun 17 · 3:30 PM", type: "Phone", status: "No-show",
    interviewer: "Maria King", notes: "Did not attend; left voicemail to reschedule.",
  },
];
