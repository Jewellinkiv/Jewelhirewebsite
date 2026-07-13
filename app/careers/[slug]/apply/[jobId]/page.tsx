import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconChevronLeft, IconDiamond, IconMapPin } from "@/components/icons";
import { LegalLinks } from "@/components/LegalLinks";
import { PublicApplyForm } from "@/components/PublicApplyForm";
import { PublicCareersTracker } from "@/components/PublicCareersTracker";
import { incrementLocalJobView } from "@/lib/local-job-store";
import { incrementPostgresPublicJobView } from "@/lib/server/postgres-phase1";
import { getPublicCareersSnapshot } from "@/lib/server/public-careers";
import { absolutePublicUrl, safeJsonLd } from "@/lib/server/public-url";
import { getStorageRuntime } from "@/lib/server/storage-runtime";

// Public job application page: /careers/[slug]/apply/[jobId]. Server-resolves
// the store + job from the careers slug (the old prototype hardcoded Sissy's
// slug and demo jobs — every store's applications would have landed in one
// store). Accepts the job's id or its slug so either form of link works.
export const dynamic = "force-dynamic";

async function resolve(slugParam: string, jobParam: string) {
  const snapshot = await getPublicCareersSnapshot(slugParam);
  if (!snapshot) return undefined;
  const job = snapshot.jobs.find((j) => j.id === jobParam || ("slug" in j && (j as { slug?: string }).slug === jobParam));
  if (!job) return undefined;
  return { snapshot, job };
}

export async function generateMetadata(props: { params: Promise<{ slug: string; jobId: string }> }): Promise<Metadata> {
  const params = await props.params;
  const resolved = await resolve(params.slug, params.jobId);
  if (!resolved) return { title: "Apply" };
  const title = `${resolved.job.title} · ${resolved.snapshot.store.name}`;
  const description = resolved.job.description || `Apply for ${resolved.job.title} at ${resolved.snapshot.store.name}.`;
  const canonical = absolutePublicUrl(`/careers/${encodeURIComponent(resolved.snapshot.page.slug)}/apply/${encodeURIComponent(resolved.job.id)}`);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", url: canonical, siteName: "JewelHire", title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicApplyPage(props: { params: Promise<{ slug: string; jobId: string }> }) {
  const params = await props.params;
  const resolved = await resolve(params.slug, params.jobId);
  if (!resolved) notFound();
  const { snapshot, job } = resolved;
  const { store, page } = snapshot;
  const jobDescription = [job.description, job.requirements?.length ? `Requirements: ${job.requirements.join("; ")}` : ""].filter(Boolean).join(" ");
  const jobPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: jobDescription || `Apply for ${job.title} at ${store.name}.`,
    ...(job.openedAt ? { datePosted: job.openedAt } : {}),
    employmentType: job.employmentType === "Part-time" ? "PART_TIME" : "FULL_TIME",
    directApply: true,
    url: absolutePublicUrl(`/careers/${encodeURIComponent(page.slug)}/apply/${encodeURIComponent(job.id)}`),
    hiringOrganization: { "@type": "Organization", name: store.name },
    ...(job.location ? {
      jobLocation: {
        "@type": "Place",
        address: { "@type": "PostalAddress", addressLocality: job.location },
      },
    } : {}),
  };

  // Count the view (same behavior as the public job GET API).
  if (getStorageRuntime() === "postgres") {
    await incrementPostgresPublicJobView(page.slug, job.id).catch(() => undefined);
  } else {
    incrementLocalJobView(store.id, job.id);
  }

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jobPostingJsonLd) }} />
      <PublicCareersTracker storeSlug={page.slug} event="application_start" jobId={job.id} />
      <header className="bg-white border-b border-line">
        <div className="max-w-[720px] mx-auto px-5 py-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#e8f1ff] text-primary flex items-center justify-center shrink-0"><IconDiamond size={20} /></span>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-head truncate">{store.name}</div>
            {store.locationLabel ? (
              <div className="text-[12.5px] text-muted flex items-center gap-1"><IconMapPin size={13} /> {store.locationLabel}</div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[720px] mx-auto px-5 py-8">
        <Link href={`/careers/${page.slug}`} className="inline-flex items-center gap-1 text-[13px] text-muted no-underline hover:text-body">
          <IconChevronLeft size={14} /> All open roles
        </Link>

        {/* Job summary */}
        <div className="mt-3 bg-white border border-line rounded-xl px-5 py-4">
          <h1 className="m-0 text-[20px] font-semibold text-head">{job.title}</h1>
          <div className="mt-1.5 text-[13px] text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{job.location}</span>
            <span>·</span>
            <span>{job.employmentType}</span>
            {job.compensationSummary ? (<><span>·</span><span>{job.compensationSummary}</span></>) : null}
          </div>
          <p className="mt-3 mb-0 text-[13.5px] text-body leading-relaxed">{job.description}</p>
          {job.requirements?.length ? (
            <ul className="mt-3 mb-0 pl-5 text-[13px] text-body leading-relaxed">
              {job.requirements.map((r) => <li key={r}>{r}</li>)}
            </ul>
          ) : null}
        </div>

        {/* Application form */}
        <h2 className="mt-8 mb-3 text-[16px] font-semibold text-head">Apply for this role</h2>
        <PublicApplyForm storeSlug={page.slug} jobId={job.id} jobTitle={job.title} storeName={store.name} />
      </main>

      <footer className="border-t border-line bg-white">
        <div className="max-w-[720px] mx-auto px-5 py-4 text-[12px] text-muted flex items-center justify-between">
          <span>{store.name}</span>
          <span className="flex items-center gap-3">Hiring powered by <span className="font-semibold text-head">JewelHire</span><LegalLinks /></span>
        </div>
      </footer>
    </div>
  );
}
