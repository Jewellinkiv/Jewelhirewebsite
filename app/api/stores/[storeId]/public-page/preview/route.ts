import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPublicPageStore } from "@/lib/server/stores/public-page-store";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "public_page.preview.list");
  const page = await getPublicPageStore().getStorePublicPage(storeId);
  if (!page) return NextResponse.json({ error: "Public page not found" }, { status: 404 });
  return NextResponse.json({ storeId, count: page.previews.length, items: page.previews });
});

export const POST = withApiErrorHandling(async function POST(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "public_page.preview.create");
  const preview = await getPublicPageStore().createPublicPagePreview(storeId);
  if (!preview) return NextResponse.json({ error: "Public page not found" }, { status: 404 });
  return NextResponse.json({ preview }, { status: 201 });
});
