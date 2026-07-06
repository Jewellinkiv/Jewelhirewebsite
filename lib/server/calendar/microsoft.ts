import type { CalendarEventInput, CreatedEvent, RefreshResult, TokenExchangeResult } from "@/lib/server/calendar/types";

// Microsoft Graph provider: OAuth (authorization-code w/ offline_access) + event
// write via Graph. Credentials come from OUTLOOK_CLIENT_ID/SECRET/TENANT_ID.

const GRAPH_ME = "https://graph.microsoft.com/v1.0/me";
const GRAPH_EVENTS = "https://graph.microsoft.com/v1.0/me/events";
const GRAPH_SCHEDULE = "https://graph.microsoft.com/v1.0/me/calendar/getSchedule";
const SCOPES = ["openid", "email", "offline_access", "https://graph.microsoft.com/Calendars.ReadWrite"];

function tenant(): string {
  return (process.env.OUTLOOK_TENANT_ID || "common").trim();
}
export function microsoftClientId(): string {
  return (process.env.OUTLOOK_CLIENT_ID || "").trim();
}
function microsoftClientSecret(): string {
  return (process.env.OUTLOOK_CLIENT_SECRET || "").trim();
}
export function microsoftConfigured(): boolean {
  return Boolean(microsoftClientId() && microsoftClientSecret());
}

function authEndpoint(): string {
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize`;
}
function tokenEndpoint(): string {
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`;
}

export function microsoftAuthUrl(redirectUri: string, state: string): string {
  const url = new URL(authEndpoint());
  url.searchParams.set("client_id", microsoftClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

function expiryFrom(expiresIn?: number): Date | null {
  return typeof expiresIn === "number" ? new Date(Date.now() + expiresIn * 1000) : null;
}

async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(GRAPH_ME, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const body = (await res.json()) as { mail?: string; userPrincipalName?: string };
    return body.mail || body.userPrincipalName || null;
  } catch {
    return null;
  }
}

export async function microsoftExchangeCode(code: string, redirectUri: string): Promise<TokenExchangeResult> {
  const res = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: microsoftClientId(),
      client_secret: microsoftClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: SCOPES.join(" "),
    }),
  });
  const body = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Microsoft token exchange failed: ${body.error_description || body.error || res.status}`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || null,
    expiresAt: expiryFrom(body.expires_in),
    scope: body.scope || null,
    accountEmail: await fetchAccountEmail(body.access_token),
  };
}

export async function microsoftRefresh(refreshToken: string): Promise<RefreshResult> {
  const res = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: microsoftClientId(),
      client_secret: microsoftClientSecret(),
      grant_type: "refresh_token",
      scope: SCOPES.join(" "),
    }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Microsoft token refresh failed: ${body.error_description || body.error || res.status}`);
  }
  return { accessToken: body.access_token, expiresAt: expiryFrom(body.expires_in) };
}

// Graph wants a naive dateTime + a timeZone name. Normalize any ISO input to UTC.
function toGraphDateTime(iso: string): { dateTime: string; timeZone: string } {
  return { dateTime: new Date(iso).toISOString().replace("Z", ""), timeZone: "UTC" };
}

export async function microsoftCreateEvent(accessToken: string, event: CalendarEventInput): Promise<CreatedEvent> {
  const payload: Record<string, unknown> = {
    subject: event.summary,
    body: { contentType: "text", content: event.description || "" },
    start: toGraphDateTime(event.startISO),
    end: toGraphDateTime(event.endISO),
  };
  if (event.location) payload.location = { displayName: event.location };
  if (event.attendeeEmail) {
    payload.attendees = [{ emailAddress: { address: event.attendeeEmail, name: event.attendeeName || undefined }, type: "required" }];
  }
  const res = await fetch(GRAPH_EVENTS, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as { id?: string; webLink?: string; error?: { message?: string } };
  if (!res.ok || !body.id) {
    throw new Error(`Microsoft event create failed: ${body.error?.message || res.status}`);
  }
  return { eventId: body.id, htmlLink: body.webLink || null };
}

export async function microsoftIsFree(accessToken: string, accountEmail: string | null, startISO: string, endISO: string): Promise<boolean> {
  if (!accountEmail) return true;
  try {
    const res = await fetch(GRAPH_SCHEDULE, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        schedules: [accountEmail],
        startTime: toGraphDateTime(startISO),
        endTime: toGraphDateTime(endISO),
        availabilityViewInterval: 30,
      }),
    });
    if (!res.ok) return true; // fail-open
    const body = (await res.json()) as { value?: Array<{ scheduleItems?: unknown[] }> };
    return (body.value?.[0]?.scheduleItems?.length ?? 0) === 0;
  } catch {
    return true;
  }
}
