import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { getPublicPageStore } from "@/lib/server/stores/public-page-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const GET = withApiErrorHandling(async function GET(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "public_page.reviews.list");
  const url = new URL(request.url);
  const includeHidden = url.searchParams.get("includeHidden") === "true";
  const items = await getPublicPageStore().listPublicPageReviews({ storeId, includeHidden });
  return NextResponse.json({ count: items.length, items });
});
