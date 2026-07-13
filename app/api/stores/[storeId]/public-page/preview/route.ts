import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPublicPageStore } from "@/lib/server/stores/public-page-store";
import { createPublicPreviewToken } from "@/lib/server/public-preview-token";

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
  const page = await getPublicPageStore().getStorePublicPage(storeId);
  if (!page) return NextResponse.json({ error: "Public page not found" }, { status: 404 });
  const token = createPublicPreviewToken({ storeId, slug: page.page.slug, ttlHours: 24 });
  const previewUrl = `/careers/${encodeURIComponent(page.page.slug)}?preview=${encodeURIComponent(token)}`;
  return NextResponse.json({ preview: { ...preview, previewUrl, expiresInHours: 24 } }, { status: 201 });
});
