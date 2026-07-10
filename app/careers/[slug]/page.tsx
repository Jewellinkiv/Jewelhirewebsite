import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconChevronRight, IconDiamond, IconMapPin, IconStar } from "@/components/icons";
import { getPublicCareersSnapshot } from "@/lib/server/public-careers";

// The store's PUBLIC careers page — the hyperlink owners embed on their own
// website. No session, no app shell: fully server-rendered from the published
// public-page config + open jobs so it works as a plain link and for SEO.
export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const snapshot = await getPublicCareersSnapshot(params.slug);
  if (!snapshot) return { title: "Careers" };
  return {
    title: `Careers · ${snapshot.store.name}`,
    description: snapshot.page.about,
  };
}

export default async function PublicCareersPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const snapshot = await getPublicCareersSnapshot(params.slug);
  if (!snapshot) notFound();
  const { store, page, jobs } = snapshot;

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* Store header */}
      <header className="bg-white border-b border-line">
        <div className="max-w-[860px] mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-[#e8f1ff] text-primary flex items-center justify-center shrink-0"><IconDiamond size={20} /></span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-head truncate">{store.name}</div>
              {store.locationLabel ? (
                <div className="text-[12.5px] text-muted flex items-center gap-1"><IconMapPin size={13} /> {store.locationLabel}</div>
              ) : null}
            </div>
          </div>
          {page.reviewSummary?.count ? (
            <div className="text-[12.5px] text-body flex items-center gap-1 whitespace-nowrap">
              <IconStar size={14} className="text-[#f0a500]" />
              <span className="font-semibold text-head">{page.reviewSummary.rating}</span>
              <span className="text-muted">({page.reviewSummary.count} reviews)</span>
            </div>
          ) : null}
        </div>
      </header>

      <main className="flex-1 w-full max-w-[860px] mx-auto px-5 py-8">
        {/* Hero */}
        <h1 className="m-0 text-[26px] sm:text-[32px] font-semibold text-head leading-tight">{page.headline}</h1>
        <p className="mt-3 text-[15px] text-body max-w-[640px] leading-relaxed">{page.about}</p>

        {/* Benefits */}
        {page.benefits?.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {page.benefits.map((b) => (
              <span key={b} className="text-[12.5px] font-medium text-body bg-white border border-line rounded-full px-3 py-1.5">{b}</span>
            ))}
          </div>
        ) : null}

        {/* Open roles */}
        <h2 className="mt-10 mb-3 text-[17px] font-semibold text-head">Open roles{jobs.length ? ` (${jobs.length})` : ""}</h2>
        {jobs.length ? (
          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/careers/${page.slug}/apply/${job.id}`}
                className="group bg-white border border-line rounded-xl px-5 py-4 no-underline hover:border-primary transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-head group-hover:text-primary">{job.title}</div>
                    <div className="mt-1 text-[12.5px] text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>{job.location}</span>
                      <span>·</span>
                      <span>{job.employmentType}</span>
                      {job.compensationSummary ? (<><span>·</span><span>{job.compensationSummary}</span></>) : null}
                    </div>
                    <p className="mt-2 mb-0 text-[13px] text-body leading-relaxed line-clamp-2">{job.description}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[13px] font-medium text-primary">
                    Apply <IconChevronRight size={15} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-line rounded-xl px-5 py-8 text-center text-[13.5px] text-muted">
            No open roles right now — check back soon.
          </div>
        )}
      </main>

      <footer className="border-t border-line bg-white">
        <div className="max-w-[860px] mx-auto px-5 py-4 text-[12px] text-muted flex items-center justify-between">
          <span>{store.name}</span>
          <span className="flex items-center gap-1.5">Hiring powered by <span className="font-semibold text-head">JewelHire</span></span>
        </div>
      </footer>
    </div>
  );
}
