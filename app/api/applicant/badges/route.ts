import { NextResponse } from "next/server";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getCourseStore } from "@/lib/server/stores/course-store";

export const dynamic = "force-dynamic";

// Course badges the signed-in applicant has earned. Shown on their portal + resume.
export const GET = withApiErrorHandling(async function GET() {
  const { session } = await requireApplicantSelf("applicant.badges");
  const items = await getCourseStore().listEarnedBadges(session.userId);
  return NextResponse.json({ count: items.length, items });
});
