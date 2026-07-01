import { NextResponse } from "next/server";
import { getPublicPageStore } from "@/lib/server/stores/public-page-store";

export async function GET(_request: Request, props: { params: Promise<{ storeSlug: string }> }) {
  const params = await props.params;
  const page = await getPublicPageStore().getPublishedPublicPage(params.storeSlug);
  if (!page) return NextResponse.json({ error: "Public store page not found" }, { status: 404 });
  return NextResponse.json(page);
}
