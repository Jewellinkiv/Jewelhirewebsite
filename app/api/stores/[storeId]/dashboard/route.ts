import { NextResponse } from "next/server";
import { CAREERS, ACTIVITY, LOCATION_FLOORS, floorRead } from "@/lib/dashboard";
import { TEAM, TEAM_MIX, FLOOR_TYPE } from "@/lib/data";
import { requireStoreAccess } from "@/lib/server/access-control";
import { getPostgresStoreDashboard } from "@/lib/server/postgres-phase1";
import { getStorageRuntime } from "@/lib/server/storage-runtime";
import { getApplicantStore } from "@/lib/server/stores/applicant-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  if (getStorageRuntime() === "postgres") {
    const storeId = await requireStoreAccess(params.storeId, "dashboard.read");
    const dashboard = await getPostgresStoreDashboard(storeId);
    return NextResponse.json(dashboard);
  }

  const applications = await getApplicantStore().listStoreApplications({ storeId: params.storeId });
  const completedGemMatches = applications.filter((application) =>
    ["gemmatch", "interview", "offer", "hired"].includes(application.stage),
  ).length;
  const hired = applications.filter((application) => application.stage === "hired").length;
  const activeJobs = new Set(applications.map((application) => application.jobId)).size || 3;
  const floor = floorRead(TEAM_MIX, FLOOR_TYPE, TEAM.length, TEAM.length + 2);

  return NextResponse.json({
    storeId: params.storeId,
    floor,
    kpis: {
      activeJobs,
      applicants: applications.length,
      hired,
      avgFit: 78,
      gemmatchCompletion: applications.length ? Math.round((completedGemMatches / applications.length) * 100) : 0,
    },
    careers: CAREERS,
    locations: LOCATION_FLOORS,
    activity: ACTIVITY,
  });
});
