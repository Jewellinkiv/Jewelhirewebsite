import { NextResponse } from "next/server";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { listEarnedBadges } from "@/lib/courses";

export const dynamic = "force-dynamic";

// Course badges the signed-in applicant has earned. Shown on their portal + resume.
export const GET = withApiErrorHandling(async function GET() {
  const { session } = await requireApplicantSelf("applicant.badges");
  const items = listEarnedBadges(session.userId);
  return NextResponse.json({ count: items.length, items });
});
