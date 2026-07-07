import {
  deleteConnection,
  getConnection,
  listConnections,
  saveInterviewEvent,
  updateAccessToken,
  upsertConnection,
  type CalendarProvider,
  type ConnectionStatus,
} from "@/lib/server/calendar/store";
import {
  googleAuthUrl,
  googleConfigured,
  googleCreateEvent,
  googleExchangeCode,
  googleIsFree,
  googleRefresh,
} from "@/lib/server/calendar/google";
import {
  microsoftAuthUrl,
  microsoftConfigured,
  microsoftCreateEvent,
  microsoftExchangeCode,
  microsoftIsFree,
  microsoftRefresh,
} from "@/lib/server/calendar/microsoft";
import type { CalendarEventInput } from "@/lib/server/calendar/types";

export { CALENDAR_PROVIDERS } from "@/lib/server/calendar/types";
export type { CalendarProvider, ConnectionStatus };

export function providerConfigured(provider: CalendarProvider): boolean {
  return provider === "google" ? googleConfigured() : microsoftConfigured();
}

export function buildAuthUrl(provider: CalendarProvider, redirectUri: string, state: string): string {
  return provider === "google" ? googleAuthUrl(redirectUri, state) : microsoftAuthUrl(redirectUri, state);
}

// Exchange the OAuth code and persist the (encrypted) connection for this store.
export async function completeConnection(provider: CalendarProvider, code: string, redirectUri: string, storeId: string): Promise<void> {
  const tokens = provider === "google" ? await googleExchangeCode(code, redirectUri) : await microsoftExchangeCode(code, redirectUri);
  await upsertConnection({
    storeId,
    provider,
    accountEmail: tokens.accountEmail,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    scope: tokens.scope,
    expiresAt: tokens.expiresAt,
  });
}

// Return a currently-valid access token, refreshing (and persisting) if expired.
async function validAccessToken(storeId: string, provider: CalendarProvider): Promise<{ accessToken: string; accountEmail: string | null } | null> {
  const conn = await getConnection(storeId, provider);
  if (!conn) return null;
  const expired = conn.expiresAt ? conn.expiresAt.getTime() - Date.now() < 60_000 : false;
  if (!expired) return { accessToken: conn.accessToken, accountEmail: conn.accountEmail };
  if (!conn.refreshToken) return null; // can't refresh; caller treats as disconnected
  const refreshed = provider === "google" ? await googleRefresh(conn.refreshToken) : await microsoftRefresh(conn.refreshToken);
  await updateAccessToken(storeId, provider, refreshed.accessToken, refreshed.expiresAt);
  return { accessToken: refreshed.accessToken, accountEmail: conn.accountEmail };
}

export type InterviewEventResult = { provider: CalendarProvider; ok: boolean; htmlLink?: string | null; error?: string };

// Create the interview event on every calendar the store has connected. Best
// effort per provider — a failure on one never throws or blocks the others (or
// the interview itself, since callers invoke this after the interview is saved).
export async function createInterviewEvent(input: {
  storeId: string;
  interviewId: string;
  event: CalendarEventInput;
}): Promise<InterviewEventResult[]> {
  const connections = await listConnections(input.storeId);
  const results: InterviewEventResult[] = [];
  for (const { provider } of connections) {
    try {
      const token = await validAccessToken(input.storeId, provider);
      if (!token) {
        results.push({ provider, ok: false, error: "not_connected_or_refresh_failed" });
        continue;
      }
      const created =
        provider === "google"
          ? await googleCreateEvent(token.accessToken, input.event)
          : await microsoftCreateEvent(token.accessToken, input.event);
      await saveInterviewEvent(input.interviewId, provider, created.eventId, created.htmlLink);
      results.push({ provider, ok: true, htmlLink: created.htmlLink });
    } catch (error) {
      results.push({ provider, ok: false, error: error instanceof Error ? error.message : "unknown" });
    }
  }
  return results;
}

// Best-effort: build an interview calendar event from raw interview fields and
// create it on the store's connected calendars. Never throws — a calendar issue
// must not fail the interview itself. Returns [] if there's nothing schedulable.
export async function scheduleInterviewCalendar(input: {
  storeId: string;
  interviewId: string;
  startsAt?: string | null;
  endsAt?: string | null;
  durationMinutes?: number | null;
  role?: string | null;
  candidateName?: string | null;
  candidateEmail?: string | null;
  locationDetails?: string | null;
}): Promise<InterviewEventResult[]> {
  try {
    if (!input.startsAt) return [];
    const start = new Date(input.startsAt);
    if (Number.isNaN(start.getTime())) return [];
    let end = input.endsAt ? new Date(input.endsAt) : null;
    if (!end || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      const mins = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 45;
      end = new Date(start.getTime() + mins * 60_000);
    }
    const who = input.candidateName?.trim();
    const summary = `Interview${input.role ? ` — ${input.role}` : ""}${who ? ` with ${who}` : ""}`;
    return await createInterviewEvent({
      storeId: input.storeId,
      interviewId: input.interviewId,
      event: {
        summary,
        description: "Scheduled via JewelHire.",
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        attendeeEmail: input.candidateEmail || undefined,
        attendeeName: who || undefined,
        location: input.locationDetails || undefined,
      },
    });
  } catch {
    return [];
  }
}

// True only if EVERY connected calendar reports the window free. No connections
// => treated as available (nothing to check against).
export async function isWindowAvailable(storeId: string, startISO: string, endISO: string): Promise<boolean> {
  const connections = await listConnections(storeId);
  for (const { provider } of connections) {
    const token = await validAccessToken(storeId, provider);
    if (!token) continue;
    const free =
      provider === "google"
        ? await googleIsFree(token.accessToken, startISO, endISO)
        : await microsoftIsFree(token.accessToken, token.accountEmail, startISO, endISO);
    if (!free) return false;
  }
  return true;
}

export async function calendarStatus(storeId: string): Promise<ConnectionStatus[]> {
  return listConnections(storeId);
}

export async function disconnectCalendar(storeId: string, provider: CalendarProvider): Promise<void> {
  await deleteConnection(storeId, provider);
}
