import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { calendarStatus, disconnectCalendar, providerConfigured, type CalendarProvider } from "@/lib/server/calendar";

export const runtime = "nodejs";

function isProvider(value: string | null): value is CalendarProvider {
  return value === "google" || value === "microsoft";
}

// Connection status for the store's calendar settings UI.
export async function GET(request: Request) {
  const storeId = new URL(request.url).searchParams.get("storeId") || "";
  try {
    await requireStoreAccess(storeId, "calendar.status");
  } catch {
    return NextResponse.json({ error: { code: "forbidden", message: "No access to this store." } }, { status: 403 });
  }
  return NextResponse.json({
    connections: await calendarStatus(storeId),
    configured: { google: providerConfigured("google"), microsoft: providerConfigured("microsoft") },
  });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId") || "";
  const provider = url.searchParams.get("provider");
  if (!isProvider(provider)) {
    return NextResponse.json({ error: { code: "bad_provider", message: "Unknown provider." } }, { status: 400 });
  }
  try {
    await requireStoreAccess(storeId, "calendar.disconnect");
  } catch {
    return NextResponse.json({ error: { code: "forbidden", message: "No access to this store." } }, { status: 403 });
  }
  await disconnectCalendar(storeId, provider);
  return NextResponse.json({ ok: true });
}
