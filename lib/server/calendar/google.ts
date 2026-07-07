import type { CalendarEventInput, CreatedEvent, RefreshResult, TokenExchangeResult } from "@/lib/server/calendar/types";

// Google Calendar provider: OAuth (authorization-code w/ offline access) + event
// write via the Calendar API. Client credentials come from GOOGLE_CALENDAR_CLIENT_ID
// (falls back to the login GOOGLE_CLIENT_ID if the calendar scope was added there).

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";
const EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const FREEBUSY_ENDPOINT = "https://www.googleapis.com/calendar/v3/freeBusy";

const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"];

export function googleClientId(): string {
  return (process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "").trim();
}
function googleClientSecret(): string {
  return (process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "").trim();
}
export function googleConfigured(): boolean {
  return Boolean(googleClientId() && googleClientSecret());
}

export function googleAuthUrl(redirectUri: string, state: string): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", googleClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline"); // request a refresh token
  url.searchParams.set("prompt", "consent"); // force refresh-token issuance on reconnect
  url.searchParams.set("include_granted_scopes", "true");
  return url.toString();
}

function expiryFrom(expiresIn?: number): Date | null {
  return typeof expiresIn === "number" ? new Date(Date.now() + expiresIn * 1000) : null;
}

async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(USERINFO_ENDPOINT, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const body = (await res.json()) as { email?: string };
    return body.email || null;
  } catch {
    return null;
  }
}

export async function googleExchangeCode(code: string, redirectUri: string): Promise<TokenExchangeResult> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const body = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Google token exchange failed: ${body.error_description || body.error || res.status}`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || null,
    expiresAt: expiryFrom(body.expires_in),
    scope: body.scope || null,
    accountEmail: await fetchAccountEmail(body.access_token),
  };
}

export async function googleRefresh(refreshToken: string): Promise<RefreshResult> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Google token refresh failed: ${body.error_description || body.error || res.status}`);
  }
  return { accessToken: body.access_token, expiresAt: expiryFrom(body.expires_in) };
}

export async function googleCreateEvent(accessToken: string, event: CalendarEventInput): Promise<CreatedEvent> {
  const payload: Record<string, unknown> = {
    summary: event.summary,
    description: event.description,
    location: event.location || undefined,
    start: { dateTime: event.startISO },
    end: { dateTime: event.endISO },
  };
  if (event.attendeeEmail) {
    payload.attendees = [{ email: event.attendeeEmail, displayName: event.attendeeName || undefined }];
  }
  const res = await fetch(`${EVENTS_ENDPOINT}?sendUpdates=all`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as { id?: string; htmlLink?: string; error?: { message?: string } };
  if (!res.ok || !body.id) {
    throw new Error(`Google event create failed: ${body.error?.message || res.status}`);
  }
  return { eventId: body.id, htmlLink: body.htmlLink || null };
}

// Returns true if the account is free for the whole window (no busy overlap).
export async function googleIsFree(accessToken: string, startISO: string, endISO: string): Promise<boolean> {
  try {
    const res = await fetch(FREEBUSY_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ timeMin: startISO, timeMax: endISO, items: [{ id: "primary" }] }),
    });
    if (!res.ok) return true; // fail-open: don't block scheduling on a free/busy hiccup
    const body = (await res.json()) as { calendars?: { primary?: { busy?: unknown[] } } };
    return (body.calendars?.primary?.busy?.length ?? 0) === 0;
  } catch {
    return true;
  }
}
