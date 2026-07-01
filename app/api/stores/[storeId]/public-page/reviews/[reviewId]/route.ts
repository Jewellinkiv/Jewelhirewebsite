import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPublicPageStore } from "@/lib/server/stores/public-page-store";

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ storeId: string; reviewId: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const review = await getPublicPageStore().updatePublicPageReview({
    storeId: params.storeId,
    reviewId: params.reviewId,
    status: body?.status,
  });
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  return NextResponse.json({ review });
});
