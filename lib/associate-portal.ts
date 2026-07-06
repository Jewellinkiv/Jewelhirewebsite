// Associate-portal mock data: invites to complete, interview invites to RSVP,
// and assigned training packages. Job-seeker owned (Phase 1, private).

import { ProfileCode } from "./gemmatch";

export interface AssociateInvite {
  id: string;
  store: string;
  role: string;
  kind: "GemMatch" | "JewelCert" | "Knowledge check";
  sentAt: string;
  status: "To do" | "In progress" | "Completed";
  estMinutes: number;
}

export const ASSOC_INVITES: AssociateInvite[] = [
  { id: "inv-sissys", store: "Sissy's Log Cabin", role: "Luxury Sales Associate", kind: "GemMatch", sentAt: "Jun 12, 2026", status: "To do", estMinutes: 3 },
  { id: "inv-sterling", store: "Sterling & Vine", role: "Client Service Associate", kind: "Knowledge check", sentAt: "Jun 18, 2026", status: "In progress", estMinutes: 10 },
  { id: "inv-harbor", store: "Harbor Gold", role: "Sales Manager", kind: "JewelCert", sentAt: "Jun 4, 2026", status: "Completed", estMinutes: 15 },
];

export interface AssociateInterview {
  id: string;
  store: string;
  role: string;
  when: string;
  startIso?: string;
  type: "In-person" | "Video" | "Phone";
  location: string;
  meetLink?: string;
  interviewer: string;
  guests?: string[];
  rsvp: "Pending" | "Accepted" | "Declined";
  // Only "scheduled" interviews are RSVP-actionable; completed/cancelled/no_show are read-only.
  // Optional so the static ASSOC_INTERVIEWS seed (no status) stays interactive as a fallback.
  status?: "scheduled" | "completed" | "cancelled" | "no_show";
}

export const ASSOC_INTERVIEWS: AssociateInterview[] = [
  { id: "aiv1", store: "Harbor Gold", role: "Sales Manager", when: "Thu Jun 25 · 2:30 PM", type: "Video", location: "Google Meet", meetLink: "meet.google.com/abc-defg-hij", interviewer: "Leo Park", guests: ["nina@harborgold.com"], rsvp: "Pending" },
  { id: "aiv2", store: "Sterling & Vine", role: "Client Service Associate", when: "Mon Jun 29 · 11:00 AM", type: "In-person", location: "412 Kavanaugh Blvd, Little Rock", interviewer: "Dana Cole", rsvp: "Accepted" },
];

export interface TrainingAssignment {
  id: string;
  course: string;
  package: string;
  assignedBy: string;
  progress: number; // 0-100
  status: "Not started" | "In progress" | "Completed";
  lessons: number;
  credentialed: boolean;
}

export const ASSOC_TRAINING: TrainingAssignment[] = [
  { id: "tr1", course: "Diamond Fundamentals", package: "New Associate Onboarding", assignedBy: "Sissy's Log Cabin", progress: 100, status: "Completed", lessons: 6, credentialed: true },
  { id: "tr2", course: "Clienteling & Follow-up", package: "New Associate Onboarding", assignedBy: "Sissy's Log Cabin", progress: 45, status: "In progress", lessons: 8, credentialed: false },
  { id: "tr3", course: "Bridal Consultation Basics", package: "Sales Skills", assignedBy: "Harbor Gold", progress: 0, status: "Not started", lessons: 5, credentialed: false },
];

export const GEMMATCH_RESULT: { type: string; primary: ProfileCode; secondary: ProfileCode; mix: Record<ProfileCode, number> } = {
  type: "Trailblazer",
  primary: "V",
  secondary: "D",
  mix: { V: 44, C: 16, F: 10, D: 30 },
};
