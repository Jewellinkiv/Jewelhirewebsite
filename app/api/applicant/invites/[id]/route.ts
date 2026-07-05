import { NextRequest, NextResponse } from "next/server";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getCourseStore } from "@/lib/server/stores/course-store";
import { listPostgresApplicantInvites } from "@/lib/server/postgres-phase1";
import { CERT_COMPONENTS } from "@/lib/jewelcert";

export const dynamic = "force-dynamic";

type BundleItem = {
  key: string;
  type: "profile" | "course" | "test" | "assessment";
  label: string;
  href: string | null;
  done: boolean;
};

// Resolve a JewelCert (bundle) invite into its launchable components so the
// applicant's bundle landing page can render + track each one.
export const GET = withApiErrorHandling(async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const { session, email } = await requireApplicantSelf("applicant.invite.detail");

  const invites =
    getStorageRuntime() === "postgres"
      ? await listPostgresApplicantInvites(email, null)
      : getApplicantStore().listApplicantInvites(email);
  const invite = invites.find((i) => i.id === params.id) as
    | { id: string; kind: string; status: string; assessmentPackageId?: string; job?: { title?: string } }
    | undefined;

  if (!invite || invite.kind !== "JewelCert") {
    return NextResponse.json({ error: { code: "not_found", message: "Invite not found." } }, { status: 404 });
  }

  const parts = (invite.assessmentPackageId || "").split("+").filter((p) => p && !p.startsWith("package-"));
  const courseStore = getCourseStore();
  const earned = new Set((await courseStore.listEarnedBadges(session.userId)).map((b) => b.courseId));
  const courseIds = parts.filter((p) => p.startsWith("course:")).map((p) => p.replace(/^course:/, ""));
  const courseTitles = await courseStore.courseTitles(courseIds);
  const bundleDone = invite.status === "completed";

  const items: BundleItem[] = parts.map((part) => {
    if (part === "gemmatch") {
      return { key: part, type: "profile", label: "JewelCert personality profile", href: `/jewelcert/${invite.id}`, done: bundleDone };
    }
    if (part.startsWith("course:")) {
      const id = part.replace(/^course:/, "");
      return { key: part, type: "course", label: courseTitles.get(id) || "Course", href: `/course/${id}`, done: earned.has(id) };
    }
    if (part.startsWith("assessment:")) {
      return { key: part, type: "assessment", label: "Store assessment", href: null, done: false };
    }
    // Built-in cert component (12-essentials, sales-personality, jewelry-knowledge, …)
    const component = CERT_COMPONENTS.find((c) => c.id === part);
    return { key: part, type: "test", label: component?.label || part, href: null, done: false };
  });

  return NextResponse.json({
    invite: { id: invite.id, status: invite.status, role: invite.job?.title || "this role" },
    items,
  });
});
