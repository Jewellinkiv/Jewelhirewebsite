import type { CalendarProvider } from "@/lib/server/calendar/store";

export type { CalendarProvider };

export type CalendarEventInput = {
  summary: string;
  description?: string;
  startISO: string; // ISO 8601 start
  endISO: string; // ISO 8601 end
  attendeeEmail?: string | null;
  attendeeName?: string | null;
  location?: string | null;
};

export type CreatedEvent = { eventId: string; htmlLink: string | null };

export type TokenExchangeResult = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
  accountEmail: string | null;
};

export type RefreshResult = {
  accessToken: string;
  expiresAt: Date | null;
};

export const CALENDAR_PROVIDERS: CalendarProvider[] = ["google", "microsoft"];
