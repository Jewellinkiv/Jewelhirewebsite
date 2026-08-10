import { NextRequest, NextResponse } from "next/server";
import { requireApplicantSelf } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { getCourseStore } from "@/lib/server/stores/course-store";
import { listPostgresApplicantInvites } from "@/lib/server/postgres-phase1";
import { CERT_COMPONENTS, GEMMATCH_PERSONALITY_ASSESSMENT_LABEL } from "@/lib/jewelcert";

export const dynamic = "force-dynamic";

type BundleItem = {
  key: string;
  type: "profile" | "course" | "test" | "assessment";
  label: string;
  href: string | null;
  done: boolean;
};

// Named packages expand to their component ids (mirrors PACKAGE_REQUIREMENTS in
// lib/local-api-store.ts). Seeded/"screen" JewelCert invites store a named
// package id rather than a "+"-joined component list; without expanding it here
// the bundle landing page resolves to ZERO items (empty page).
const PACKAGE_COMPONENTS: Record<string, string[]> = {
  "package-sales-associate-screen": ["gemmatch", "sales-personality", "jewelry-basic-knowledge"],
  "package-bench-jeweler-screen": ["gemmatch", "jewelry-basic-knowledge"],
};

// Turn an invite's assessmentPackageId into its launchable component parts.
// Handles both formats: a "+"-joined explicit list (new send flow) and a named
// package (seed/screen invites). Unknown package-* ids expand to nothing.
function expandPackageParts(assessmentPackageId: string): string[] {
  const out: string[] = [];
  for (const part of (assessmentPackageId || "").split("+").map((p) => p.trim()).filter(Boolean)) {
    if (part.startsWith("package-")) {
      out.push(...(PACKAGE_COMPONENTS[part] || []));
    } else {
      out.push(part);
    }
  }
  return [...new Set(out)];
}

// Fallback label for a built-in component id not found in CERT_COMPONENTS
// (e.g. the "jewelry-basic-knowledge" alias) — prettify instead of showing the raw slug.
function prettyLabel(id: string): string {
  return id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
      ? await listPostgresApplicantInvites(email, null, session)
      : getApplicantStore().listApplicantInvites(email);
  const invite = invites.find((i) => i.id === params.id) as
    | { id: string; kind: string; status: string; assessmentPackageId?: string; job?: { title?: string }; store?: { name?: string } }
    | undefined;

  if (!invite || invite.kind !== "JewelCert") {
    return NextResponse.json({ error: { code: "not_found", message: "Invite not found." } }, { status: 404 });
  }

  const parts = expandPackageParts(invite.assessmentPackageId || "");
  const courseStore = getCourseStore();
  const earned = new Set((await courseStore.listEarnedBadges(session.userId)).map((b) => b.courseId));
  const courseIds = parts.filter((p) => p.startsWith("course:")).map((p) => p.replace(/^course:/, ""));
  const courseTitles = await courseStore.courseTitles(courseIds);
  const bundleDone = invite.status === "completed";

  const items: BundleItem[] = parts.map((part) => {
    if (part === "gemmatch") {
      return { key: part, type: "profile", label: GEMMATCH_PERSONALITY_ASSESSMENT_LABEL, href: `/jewelcert/${invite.id}`, done: bundleDone };
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
    return { key: part, type: "test", label: component?.label || prettyLabel(part), href: null, done: false };
  });

  return NextResponse.json({
    invite: { id: invite.id, status: invite.status, role: invite.job?.title || "this role", store: invite.store?.name || "the store" },
    items,
  });
});
