import { NextResponse } from "next/server";
import { PublicPageConfig } from "@/lib/public-templates";
import { requireStoreAccess } from "@/lib/server/access-control";
import { getPublicPageStore } from "@/lib/server/stores/public-page-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "public_page.read");
  const page = await getPublicPageStore().getStorePublicPage(storeId);
  if (!page) return NextResponse.json({ error: "Public page not found" }, { status: 404 });
  return NextResponse.json(page);
});

export const PUT = withApiErrorHandling(async function PUT(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "public_page.update");
  const body = await request.json().catch(() => null);
  if (!body?.config) {
    return NextResponse.json({ error: "config is required" }, { status: 400 });
  }
  const page = await getPublicPageStore().saveStorePublicPage({ storeId, config: body.config as PublicPageConfig });
  if (!page) return NextResponse.json({ error: "Public page not found" }, { status: 404 });
  return NextResponse.json(page);
});
