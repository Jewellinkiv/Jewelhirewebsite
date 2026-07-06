import { NextResponse } from "next/server";
import { requireStoreAccess } from "@/lib/server/access-control";
import { getPublicPageStore } from "@/lib/server/stores/public-page-store";
import { getSettingsStore } from "@/lib/server/stores/settings-store";
import { withApiErrorHandling } from "@/lib/server/api-errors";

export const dynamic = "force-dynamic";

function buildStoreProfile(storeId: string, settings: Awaited<ReturnType<ReturnType<typeof getSettingsStore>["getStoreSettings"]>>, page: Awaited<ReturnType<ReturnType<typeof getPublicPageStore>["getStorePublicPage"]>>) {
  return {
    id: storeId,
    company: settings.organization.company,
    name: settings.organization.primaryStore || settings.organization.company,
    location: settings.organization.primaryStore,
    defaultManager: settings.organization.defaultManager,
    organization: settings.organization,
    workflow: settings.workflow,
    notifications: settings.notifications,
    publicPage: page
      ? {
          slug: page.store.careersUrl,
          status: page.config.status,
          headline: page.config.headline,
          about: page.config.about,
          logoText: page.config.logoText,
          logoUrl: page.config.logoUrl,
          theme: page.config.theme,
        }
      : undefined,
    updatedAt: settings.updatedAt,
  };
}

export const GET = withApiErrorHandling(async function GET(_request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "store.read");
  const settings = await getSettingsStore().getStoreSettings(storeId);
  const page = await getPublicPageStore().getStorePublicPage(storeId);
  return NextResponse.json({
    store: buildStoreProfile(storeId, settings, page),
    settings,
    publicPage: page,
  });
});

export const PATCH = withApiErrorHandling(async function PATCH(request: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  const storeId = await requireStoreAccess(params.storeId, "store.update");
  const body = await request.json().catch(() => null);
  const currentSettings = await getSettingsStore().getStoreSettings(storeId);
  const nextOrganization = {
    ...currentSettings.organization,
    ...(body?.organization || {}),
    ...(typeof body?.company === "string" ? { company: body.company } : {}),
    ...(typeof body?.name === "string" ? { primaryStore: body.name } : {}),
    ...(typeof body?.location === "string" ? { primaryStore: body.location } : {}),
    ...(typeof body?.defaultManager === "string" ? { defaultManager: body.defaultManager } : {}),
  };
  const settings = await getSettingsStore().updateStoreSettings({
    storeId,
    settings: {
      organization: nextOrganization,
      workflow: Array.isArray(body?.workflow) ? body.workflow : undefined,
      notifications: Array.isArray(body?.notifications) ? body.notifications : undefined,
    },
  });

  let page = await getPublicPageStore().getStorePublicPage(storeId);
  if (page && body?.publicPage) {
    page = await getPublicPageStore().saveStorePublicPage({
      storeId,
      config: {
        ...page.config,
        ...(typeof body.publicPage.headline === "string" ? { headline: body.publicPage.headline } : {}),
        ...(typeof body.publicPage.about === "string" ? { about: body.publicPage.about } : {}),
        ...(typeof body.publicPage.logoText === "string" ? { logoText: body.publicPage.logoText } : {}),
      },
    });
  }

  return NextResponse.json({
    store: buildStoreProfile(storeId, settings, page),
    settings,
    publicPage: page,
  });
});
