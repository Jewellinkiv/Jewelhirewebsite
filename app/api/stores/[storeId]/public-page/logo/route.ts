import { NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/server/api-errors";
import { getPublicPageStore } from "@/lib/server/stores/public-page-store";

export const POST = withApiErrorHandling(async function POST(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });

    const result = await getPublicPageStore().savePublicPageLogo({
      storeId: params.storeId,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      altText: String(form.get("altText") || ""),
    });
    if (!result) return NextResponse.json({ error: "Public page not found" }, { status: 404 });
    return NextResponse.json(result, { status: 201 });
  }

  const body = await request.json().catch(() => null);
  const result = await getPublicPageStore().savePublicPageLogo({
    storeId: params.storeId,
    filename: body?.filename,
    mimeType: body?.mimeType,
    size: body?.size,
    url: body?.url,
    altText: body?.altText,
  });
  if (!result) return NextResponse.json({ error: "Public page not found" }, { status: 404 });
  return NextResponse.json(result, { status: 201 });
});
