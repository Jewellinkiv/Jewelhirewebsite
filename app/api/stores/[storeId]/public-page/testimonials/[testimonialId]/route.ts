import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPublicPageStore } from "@/lib/server/stores/public-page-store";

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ storeId: string; testimonialId: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const testimonial = await getPublicPageStore().updatePublicPageTestimonial({
    storeId: params.storeId,
    testimonialId: params.testimonialId,
    name: body?.name,
    rating: body?.rating,
    text: body?.text,
    status: body?.status,
  });
  if (!testimonial) return NextResponse.json({ error: "Testimonial not found" }, { status: 404 });
  return NextResponse.json({ testimonial });
});

export const DELETE = withApiErrorHandling(async function DELETE(_request: Request, props: { params: Promise<{ storeId: string; testimonialId: string }> }) {
  const params = await props.params;
  const testimonial = await getPublicPageStore().deletePublicPageTestimonial({
    storeId: params.storeId,
    testimonialId: params.testimonialId,
  });
  if (!testimonial) return NextResponse.json({ error: "Testimonial not found" }, { status: 404 });
  return NextResponse.json({ testimonial });
});
