import { NextResponse } from "next/server";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import {
  ApplicantNotificationPrefs,
  getPostgresApplicantNotificationPrefs,
  updatePostgresApplicantNotificationPrefs,
} from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

const DEFAULT_PREFS: ApplicantNotificationPrefs = {
  invites: true,
  interviews: true,
  status: true,
  marketing: false,
};

const localPrefs = new Map<string, ApplicantNotificationPrefs>();

function emailKey(email?: string | null) {
  return (email || "maya.chen@email.com").trim().toLowerCase();
}

function pickPrefs(body: any): Partial<ApplicantNotificationPrefs> {
  return {
    ...(typeof body?.invites === "boolean" ? { invites: body.invites } : {}),
    ...(typeof body?.interviews === "boolean" ? { interviews: body.interviews } : {}),
    ...(typeof body?.status === "boolean" ? { status: body.status } : {}),
    ...(typeof body?.marketing === "boolean" ? { marketing: body.marketing } : {}),
  };
}

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET() {
  const { email } = await requireApplicantSelf("applicant.notification_prefs.read");
  const prefs =
    getStorageRuntime() === "postgres"
      ? await getPostgresApplicantNotificationPrefs(email)
      : localPrefs.get(emailKey(email)) || DEFAULT_PREFS;
  if (!prefs) return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  return NextResponse.json({ prefs });
});

export const PATCH = withApiErrorHandling(async function PATCH(request: Request) {
  const { email } = await requireApplicantSelf("applicant.notification_prefs.update");
  const body = await request.json().catch(() => null);
  const patch = pickPrefs(body);
  if (getStorageRuntime() === "postgres") {
    const prefs = await updatePostgresApplicantNotificationPrefs({ email, prefs: patch });
    if (!prefs) return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
    return NextResponse.json({ prefs });
  }

  const key = emailKey(email);
  const current = localPrefs.get(key) || DEFAULT_PREFS;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  localPrefs.set(key, next);
  return NextResponse.json({ prefs: next });
});
