// Shared invite / calendar defaults. In production these come from the org's
// saved Settings; here they're mock defaults read by both Settings and Interviews
// so the connected status and invite details stay consistent.

export type CalProvider = "google" | "microsoft";

export interface InviteSettings {
  calendarProvider: CalProvider | null; // null = not connected
  account: string;
  fromName: string;
  replyTo: string;
  timezone: string; // e.g. "America/Chicago (CT)"
  defaultDuration: string; // e.g. "45 min"
  location: string;
  addLinks: boolean;
  attachIcs: boolean;
  remind24: boolean;
  remind1: boolean;
  noteTemplate: string;
}

export const PROVIDER_LABEL: Record<CalProvider, string> = {
  google: "Google Calendar",
  microsoft: "Microsoft Outlook",
};

export const INVITE_SETTINGS: InviteSettings = {
  calendarProvider: "google",
  account: "hiring@sissyslogcabin.com",
  fromName: "Sissy's Log Cabin Hiring",
  replyTo: "hiring@sissyslogcabin.com",
  timezone: "America/Chicago (CT)",
  defaultDuration: "45 min",
  location: "Sissy's Log Cabin · 1023 Main St, Little Rock",
  addLinks: true,
  attachIcs: true,
  remind24: true,
  remind1: false,
  noteTemplate:
    "Hi {{candidate}}, we'd love to meet you for the {{role}} role at {{location}} on {{time}}. Reply here with any questions — looking forward to it!",
};
