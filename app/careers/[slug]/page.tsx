import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicCareersView } from "@/components/PublicCareersView";
import { PublicCareersTracker } from "@/components/PublicCareersTracker";
import { getPublicCareersSnapshot } from "@/lib/server/public-careers";
import { absolutePublicUrl, safeJsonLd } from "@/lib/server/public-url";

// The store's PUBLIC careers page — the hyperlink owners embed on their own
// website. No session, no app shell: fully server-rendered from the published
// public-page config + open jobs so it works as a plain link and for SEO.
export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ slug: string }>; searchParams?: Promise<{ preview?: string }> }): Promise<Metadata> {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const snapshot = await getPublicCareersSnapshot(params.slug, searchParams?.preview);
  if (!snapshot) return { title: "Careers" };
  const canonical = absolutePublicUrl(`/careers/${encodeURIComponent(snapshot.page.slug)}`);
  return {
    title: `Careers · ${snapshot.store.name}`,
    description: snapshot.page.about,
    alternates: snapshot.isPreview ? undefined : { canonical },
    openGraph: snapshot.isPreview ? undefined : {
      type: "website",
      url: canonical,
      siteName: "JewelHire",
      title: `${snapshot.store.name} careers`,
      description: snapshot.page.about,
    },
    twitter: snapshot.isPreview ? undefined : {
      card: "summary",
      title: `${snapshot.store.name} careers`,
      description: snapshot.page.about,
    },
    robots: snapshot.isPreview ? { index: false, follow: false } : undefined,
  };
}

export default async function PublicCareersPage(props: { params: Promise<{ slug: string }>; searchParams?: Promise<{ preview?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const snapshot = await getPublicCareersSnapshot(params.slug, searchParams?.preview);
  if (!snapshot) notFound();
  const jsonLd = snapshot.isPreview ? undefined : {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${snapshot.store.name} careers`,
    description: snapshot.page.about,
    url: absolutePublicUrl(`/careers/${encodeURIComponent(snapshot.page.slug)}`),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: snapshot.jobs.length,
      itemListElement: snapshot.jobs.map((job, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: job.title,
        url: absolutePublicUrl(`/careers/${encodeURIComponent(snapshot.page.slug)}/apply/${encodeURIComponent(job.id)}`),
      })),
    },
  };
  return (
    <>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} /> : null}
      {!snapshot.isPreview ? <PublicCareersTracker storeSlug={snapshot.page.slug} event="page_view" /> : null}
      <PublicCareersView store={snapshot.store} page={snapshot.page} jobs={snapshot.jobs} config={snapshot.config} interactive={!snapshot.isPreview} preview={snapshot.isPreview} />
    </>
  );
}
