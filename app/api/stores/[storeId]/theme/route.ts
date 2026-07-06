import { NextResponse } from "next/server";
import { FONTS, PublicTheme, TEMPLATES } from "@/lib/public-templates";
import { requireStoreAccess } from "@/lib/server/access-control";
import { getPublicPageStore } from "@/lib/server/stores/public-page-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const dynamic = "force-dynamic";

const themeKeys = ["primary", "accent", "bg", "text", "fontId"] as const;

function pickThemePatch(body: unknown): Partial<PublicTheme> {
  if (!body || typeof body !== "object") return {};
  const input = (body as { theme?: unknown }).theme && typeof (body as { theme?: unknown }).theme === "object" ? (body as { theme: Record<string, unknown> }).theme : (body as Record<string, unknown>);
  return themeKeys.reduce<Partial<PublicTheme>>((patch, key) => {
    if (typeof input[key] === "string" && input[key].trim()) {
      patch[key] = input[key].trim();
    }
    return patch;
  }, {});
}

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "theme.read");
  const page = await getPublicPageStore().getStorePublicPage(storeId);
  if (!page) return NextResponse.json({ error: "Public page not found" }, { status: 404 });
  return NextResponse.json({
    storeId,
    theme: page.config.theme,
    templateId: page.config.templateId,
    fonts: FONTS,
    templates: TEMPLATES,
  });
});

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "theme.update");
  const body = await request.json().catch(() => null);
  const page = await getPublicPageStore().getStorePublicPage(storeId);
  if (!page) return NextResponse.json({ error: "Public page not found" }, { status: 404 });

  const theme = {
    ...page.config.theme,
    ...pickThemePatch(body),
  };
  const updated = await getPublicPageStore().saveStorePublicPage({
    storeId,
    config: {
      ...page.config,
      theme,
    },
  });
  if (!updated) return NextResponse.json({ error: "Public page not found" }, { status: 404 });
  return NextResponse.json({
    storeId,
    theme: updated.config.theme,
    templateId: updated.config.templateId,
    publicPage: updated,
  });
});
