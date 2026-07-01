import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPublicPageStore } from "@/lib/server/stores/public-page-store";

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const items = await getPublicPageStore().listPublicPageTestimonials(params.storeId);
  return NextResponse.json({ count: items.length, items });
});

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!name || !text) return NextResponse.json({ error: "name and text are required" }, { status: 400 });

  const testimonial = await getPublicPageStore().createPublicPageTestimonial({
    storeId: params.storeId,
    name,
    text,
    rating: body?.rating,
  });
  if (!testimonial) return NextResponse.json({ error: "Public page not found" }, { status: 404 });
  return NextResponse.json({ testimonial }, { status: 201 });
});
