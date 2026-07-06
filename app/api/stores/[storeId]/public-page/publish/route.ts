import { NextResponse } from "next/server";
import { PublicPageConfig } from "@/lib/public-templates";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPublicPageStore } from "@/lib/server/stores/public-page-store";

const statuses: PublicPageConfig["status"][] = ["draft", "published", "paused"];

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "public_page.publish");
  const body = await request.json().catch(() => null);
  const status = statuses.includes(body?.status) ? body.status : undefined;
  if (!status) return NextResponse.json({ error: "Supported status is required" }, { status: 400 });
  const page = await getPublicPageStore().publishStorePublicPage({ storeId, status });
  if (!page) return NextResponse.json({ error: "Public page not found" }, { status: 404 });
  return NextResponse.json(page);
});
