import { NextResponse } from "next/server";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import {
  ApplicantNotificationPrefs,
  getApplicantNotificationPrefs,
  updateApplicantNotificationPrefs,
} from "@/lib/server/notification-preferences";

function pickPrefs(body: unknown): Partial<ApplicantNotificationPrefs> {
  const candidate = body && typeof body === "object" ? body as Record<string, unknown> : {};
  return {
    ...(typeof candidate.invites === "boolean" ? { invites: candidate.invites } : {}),
    ...(typeof candidate.interviews === "boolean" ? { interviews: candidate.interviews } : {}),
    ...(typeof candidate.status === "boolean" ? { status: candidate.status } : {}),
    ...(typeof candidate.marketing === "boolean" ? { marketing: candidate.marketing } : {}),
  };
}

export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(async function GET() {
  const { email } = await requireApplicantSelf("applicant.notification_prefs.read");
  const prefs = await getApplicantNotificationPrefs(email);
  if (!prefs) return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  return NextResponse.json({ prefs });
});

export const PATCH = withApiErrorHandling(async function PATCH(request: Request) {
  const { email } = await requireApplicantSelf("applicant.notification_prefs.update");
  const body = await request.json().catch(() => null);
  const patch = pickPrefs(body);
  const prefs = await updateApplicantNotificationPrefs({ email, prefs: patch });
  if (!prefs) return NextResponse.json({ error: "Applicant profile not found" }, { status: 404 });
  return NextResponse.json({ prefs });
});
