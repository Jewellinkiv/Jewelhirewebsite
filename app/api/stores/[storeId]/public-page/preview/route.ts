import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPublicPageStore } from "@/lib/server/stores/public-page-store";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const page = await getPublicPageStore().getStorePublicPage(params.storeId);
  if (!page) return NextResponse.json({ error: "Public page not found" }, { status: 404 });
  return NextResponse.json({ storeId: params.storeId, count: page.previews.length, items: page.previews });
});

export const POST = withApiErrorHandling(async function POST(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const preview = await getPublicPageStore().createPublicPagePreview(params.storeId);
  if (!preview) return NextResponse.json({ error: "Public page not found" }, { status: 404 });
  return NextResponse.json({ preview }, { status: 201 });
});
