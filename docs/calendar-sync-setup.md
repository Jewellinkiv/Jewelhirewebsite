# Calendar sync (Google Calendar + Microsoft Outlook)

Two-way calendar integration for interview scheduling. When a store connects a
calendar, new interviews are written to it as events (with the applicant as an
attendee), and the store's busy times can be checked to avoid double-booking.
OAuth tokens are stored **encrypted** (AES-256-GCM, keyed off `AUTH_SECRET`).

## Architecture (already built)

- `db/migrations/0010_calendar_connections.sql` — `store_calendar_connections`
  (encrypted per-store tokens) + `interview_calendar_events` (interview→event map).
- `lib/server/calendar/` — `crypto` (token encryption), `store` (persistence),
  `google` / `microsoft` (OAuth + Graph/Calendar API), `index` (facade:
  `completeConnection`, `scheduleInterviewCalendar`, `isWindowAvailable`,
  `calendarStatus`, `disconnectCalendar`), `oauth-state` (signed state).
- `app/api/integrations/calendar/[provider]/start` + `/callback` — OAuth flow.
- `app/api/integrations/calendar` — GET status / DELETE disconnect.
- Interview creation (`.../interviews/new-candidate`) calls
  `scheduleInterviewCalendar` (best-effort — never blocks the interview).
- `components/CalendarEmailSettings.tsx` — real Connect/Disconnect UI.

## What you must set up before it works in production

### 1. Google Calendar
1. In Google Cloud console (project `jewelhire-prod-20260626`): **enable the
   Google Calendar API**.
2. OAuth consent screen → add scopes:
   `.../auth/calendar.events` and `.../auth/calendar.freebusy`.
   These are **sensitive/restricted** scopes → submit for **Google verification**
   (can take days–weeks; the feature won't work for external users until approved).
3. OAuth client → add the redirect URI:
   `https://app.jewelhire.com/api/integrations/calendar/google/callback`
4. Credentials: the code uses `GOOGLE_CALENDAR_CLIENT_ID` /
   `GOOGLE_CALENDAR_CLIENT_SECRET` if set, otherwise falls back to the existing
   login `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Simplest: add the calendar
   scopes to the existing login client (users re-consent). Otherwise create a
   dedicated client and mount `GOOGLE_CALENDAR_CLIENT_ID` plus the
   secret-backed `GOOGLE_CALENDAR_CLIENT_SECRET` on Cloud Run.

### 2. Microsoft Outlook
1. Azure AD → App registration (can reuse the existing `OUTLOOK_CLIENT_ID`).
2. API permissions → Microsoft Graph **delegated** `Calendars.ReadWrite` +
   `offline_access` → grant admin consent.
3. Redirect URI:
   `https://app.jewelhire.com/api/integrations/calendar/microsoft/callback`
4. Mount `OUTLOOK_CLIENT_ID`, secret-backed `OUTLOOK_CLIENT_SECRET`, and
   `OUTLOOK_TENANT_ID` on Cloud Run. `OUTLOOK_TENANT_ID=common` works for a
   multi-tenant app; use the directory tenant id for a single-tenant app.

### 3. Deploy
Apply migration `0010` to prod, then deploy the branch. No new encryption secret
is required — token encryption derives its key from the existing `AUTH_SECRET`.
Provider client secrets still need to be mounted if the provider is enabled.

Relevant env vars are listed in `.env.example`, and `qa:config` treats
`GOOGLE_CALENDAR_CLIENT_SECRET` and `OUTLOOK_CLIENT_SECRET` as private if they
are mounted.

## Test checklist (once creds are live)
1. Settings → Connect Google → consent → returns to `/settings?calendar=connected`;
   the provider shows Connected with the account email.
2. Schedule a new-candidate interview → event appears on the connected calendar
   with the applicant as attendee.
3. Disconnect → the row is removed; scheduling no longer writes events.
4. Token refresh: after ~1h the stored access token auto-refreshes on next use.

## Known follow-ups
- Interviews scheduled from the existing-application route
  (`app/api/applications/[id]/interviews`) are not yet calendar-synced (that path
  has no attendee email handy and sends no email today) — wire it when needed.
- `isWindowAvailable` (free/busy) is implemented but not yet surfaced in the
  scheduling UI to actively block double-booking.
