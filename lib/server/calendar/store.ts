import { getPostgresPool } from "@/lib/server/postgres";
import { decryptToken, encryptToken } from "@/lib/server/calendar/crypto";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

export type CalendarProvider = "google" | "microsoft";

export type StoredConnection = {
  storeId: string;
  provider: CalendarProvider;
  accountEmail: string | null;
  accessToken: string;
  refreshToken: string | null;
  scope: string | null;
  expiresAt: Date | null;
};

export type ConnectionStatus = {
  provider: CalendarProvider;
  accountEmail: string | null;
  connectedAt: string;
};

type LocalCalendarConnection = StoredConnection & { connectedAt: Date };
type LocalCalendarEvent = { eventId: string; htmlLink: string | null };
type LocalCalendarGlobal = typeof globalThis & {
  __jewelhireCalendarConnections?: Map<string, LocalCalendarConnection>;
  __jewelhireCalendarEvents?: Map<string, LocalCalendarEvent>;
};

function localConnectionKey(storeId: string, provider: CalendarProvider) {
  return `${storeId}:${provider}`;
}

function localEventKey(interviewId: string, provider: CalendarProvider) {
  return `${interviewId}:${provider}`;
}

function localConnections() {
  const globalStore = globalThis as LocalCalendarGlobal;
  globalStore.__jewelhireCalendarConnections ??= new Map();
  return globalStore.__jewelhireCalendarConnections;
}

function localEvents() {
  const globalStore = globalThis as LocalCalendarGlobal;
  globalStore.__jewelhireCalendarEvents ??= new Map();
  return globalStore.__jewelhireCalendarEvents;
}

function localRuntime() {
  return getStorageRuntime() === "local";
}

export async function upsertConnection(input: {
  storeId: string;
  provider: CalendarProvider;
  accountEmail?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  scope?: string | null;
  expiresAt?: Date | null;
}): Promise<void> {
  if (localRuntime()) {
    const existing = localConnections().get(localConnectionKey(input.storeId, input.provider));
    localConnections().set(localConnectionKey(input.storeId, input.provider), {
      storeId: input.storeId,
      provider: input.provider,
      accountEmail: input.accountEmail ?? null,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? existing?.refreshToken ?? null,
      scope: input.scope ?? null,
      expiresAt: input.expiresAt ?? null,
      connectedAt: existing?.connectedAt ?? new Date(),
    });
    return;
  }

  await getPostgresPool().query(
    `insert into store_calendar_connections
       (store_id, provider, account_email, access_token_enc, refresh_token_enc, scope, expires_at, connected_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, now(), now())
     on conflict (store_id, provider) do update set
       account_email = excluded.account_email,
       access_token_enc = excluded.access_token_enc,
       -- keep the existing refresh token if a refresh response omits it
       refresh_token_enc = coalesce(excluded.refresh_token_enc, store_calendar_connections.refresh_token_enc),
       scope = excluded.scope,
       expires_at = excluded.expires_at,
       updated_at = now()`,
    [
      input.storeId,
      input.provider,
      input.accountEmail ?? null,
      encryptToken(input.accessToken),
      input.refreshToken ? encryptToken(input.refreshToken) : null,
      input.scope ?? null,
      input.expiresAt ?? null,
    ],
  );
}

export async function getConnection(storeId: string, provider: CalendarProvider): Promise<StoredConnection | null> {
  if (localRuntime()) {
    const conn = localConnections().get(localConnectionKey(storeId, provider));
    if (!conn) return null;
    return {
      storeId: conn.storeId,
      provider: conn.provider,
      accountEmail: conn.accountEmail,
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken,
      scope: conn.scope,
      expiresAt: conn.expiresAt,
    };
  }

  const res = await getPostgresPool().query<{
    account_email: string | null;
    access_token_enc: string;
    refresh_token_enc: string | null;
    scope: string | null;
    expires_at: Date | null;
  }>(
    `select account_email, access_token_enc, refresh_token_enc, scope, expires_at
       from store_calendar_connections where store_id = $1 and provider = $2`,
    [storeId, provider],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    storeId,
    provider,
    accountEmail: row.account_email,
    accessToken: decryptToken(row.access_token_enc),
    refreshToken: row.refresh_token_enc ? decryptToken(row.refresh_token_enc) : null,
    scope: row.scope,
    expiresAt: row.expires_at,
  };
}

// Persist a refreshed access token (and its new expiry) without touching the
// refresh token.
export async function updateAccessToken(storeId: string, provider: CalendarProvider, accessToken: string, expiresAt: Date | null): Promise<void> {
  if (localRuntime()) {
    const key = localConnectionKey(storeId, provider);
    const conn = localConnections().get(key);
    if (conn) localConnections().set(key, { ...conn, accessToken, expiresAt });
    return;
  }

  await getPostgresPool().query(
    `update store_calendar_connections
       set access_token_enc = $3, expires_at = $4, updated_at = now()
     where store_id = $1 and provider = $2`,
    [storeId, provider, encryptToken(accessToken), expiresAt],
  );
}

export async function deleteConnection(storeId: string, provider: CalendarProvider): Promise<void> {
  if (localRuntime()) {
    localConnections().delete(localConnectionKey(storeId, provider));
    return;
  }

  await getPostgresPool().query(
    `delete from store_calendar_connections where store_id = $1 and provider = $2`,
    [storeId, provider],
  );
}

export async function listConnections(storeId: string): Promise<ConnectionStatus[]> {
  if (localRuntime()) {
    return Array.from(localConnections().values())
      .filter((conn) => conn.storeId === storeId)
      .map((conn) => ({ provider: conn.provider, accountEmail: conn.accountEmail, connectedAt: conn.connectedAt.toISOString() }));
  }

  const res = await getPostgresPool().query<{ provider: CalendarProvider; account_email: string | null; connected_at: Date }>(
    `select provider, account_email, connected_at from store_calendar_connections where store_id = $1`,
    [storeId],
  );
  return res.rows.map((r) => ({ provider: r.provider, accountEmail: r.account_email, connectedAt: r.connected_at.toISOString() }));
}

export async function saveInterviewEvent(interviewId: string, provider: CalendarProvider, eventId: string, htmlLink: string | null): Promise<void> {
  if (localRuntime()) {
    localEvents().set(localEventKey(interviewId, provider), { eventId, htmlLink });
    return;
  }

  await getPostgresPool().query(
    `insert into interview_calendar_events (interview_id, provider, event_id, html_link, created_at, updated_at)
     values ($1, $2, $3, $4, now(), now())
     on conflict (interview_id, provider) do update set event_id = excluded.event_id, html_link = excluded.html_link, updated_at = now()`,
    [interviewId, provider, eventId, htmlLink],
  );
}

export async function getInterviewEvent(interviewId: string, provider: CalendarProvider): Promise<{ eventId: string; htmlLink: string | null } | null> {
  if (localRuntime()) {
    return localEvents().get(localEventKey(interviewId, provider)) ?? null;
  }

  const res = await getPostgresPool().query<{ event_id: string; html_link: string | null }>(
    `select event_id, html_link from interview_calendar_events where interview_id = $1 and provider = $2`,
    [interviewId, provider],
  );
  const row = res.rows[0];
  return row ? { eventId: row.event_id, htmlLink: row.html_link } : null;
}
