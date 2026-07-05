import { NextResponse } from "next/server";
import { CERT_COMPONENTS, CERT_COURSES, type CertComponent, type CertCourseRef } from "@/lib/jewelcert";
import { getSessionContext } from "@/lib/server/access-control";
import { getAssessmentStore } from "@/lib/server/stores/assessment-store";
import { getCourseStore } from "@/lib/server/stores/course-store";

export const dynamic = "force-dynamic";

function assessmentKind(kind: string): CertComponent["kind"] {
  return kind === "Knowledge check" ? "knowledge" : "test";
}

export async function GET() {
  const session = await getSessionContext();
  const storeId = session.activeStoreId || session.storeIds[0] || "store-sissys-little-rock";
  const storeAssessments = await getAssessmentStore().listStoreAssessments(storeId);
  const publishedAssessments: CertComponent[] = storeAssessments
    .filter((assessment) => assessment.status === "Published")
    .map((assessment) => ({
      id: `assessment:${assessment.id}`,
      label: assessment.title,
      desc: assessment.description || assessment.kind,
      kind: assessmentKind(assessment.kind),
      meta: `${assessment.questions.length} question${assessment.questions.length === 1 ? "" : "s"}`,
    }));

  // Courses a store can attach to a JewelCert: global admin courses + this
  // store's own published courses, on top of the legacy course refs.
  const courseRefs: CertCourseRef[] = (await getCourseStore().listPublicCoursesForStore(storeId)).map((course) => ({
    slug: course.id,
    title: course.title,
  }));

  return NextResponse.json({
    components: [...CERT_COMPONENTS, ...publishedAssessments],
    courses: [...CERT_COURSES, ...courseRefs],
  });
}
