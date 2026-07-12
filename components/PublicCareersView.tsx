import Link from "next/link";
import type { CSSProperties } from "react";
import { IconChevronRight, IconDiamond, IconMapPin, IconStar } from "@/components/icons";
import { LegalLinks } from "@/components/LegalLinks";
import { fontStack, type PublicPageConfig } from "@/lib/public-templates";

export type CareersStoreView = {
  name: string;
  locationLabel?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
};

export type CareersPageView = {
  slug: string;
  headline: string;
  about: string;
  benefits?: string[];
  reviewSummary?: { rating: number; count: number };
};

export type CareersJobView = {
  id: string;
  title: string;
  location?: string;
  employmentType?: string;
  type?: string;
  compensationSummary?: string;
  salary?: string;
  description?: string;
  blurb?: string;
  requirements?: string[];
  openedAt?: string;
};

function Stars({ rating, color }: { rating: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((index) => (
        <IconStar key={index} size={14} style={{ color: index < Math.round(rating) ? color : "#d7dce6" }} />
      ))}
    </span>
  );
}

function applyPath(page: CareersPageView, job: CareersJobView) {
  return `/careers/${encodeURIComponent(page.slug)}/apply/${encodeURIComponent(job.id)}`;
}

export function PublicCareersView({
  store,
  page,
  jobs,
  config,
  interactive = true,
  preview = false,
}: {
  store: CareersStoreView;
  page: CareersPageView;
  jobs: CareersJobView[];
  config: PublicPageConfig;
  interactive?: boolean;
  preview?: boolean;
}) {
  const theme = config.theme;
  const location = store.locationLabel || store.location || jobs.find((job) => job.location)?.location || "";
  const rating = page.reviewSummary?.rating || store.rating || 0;
  const reviewCount = page.reviewSummary?.count || store.reviewCount || 0;
  const testimonials = config.showReviews
    ? config.testimonials.filter((testimonial) => testimonial.status !== "hidden" && testimonial.text.trim())
    : [];
  const rootStyle = {
    "--careers-primary": theme.primary,
    "--careers-accent": theme.accent,
    "--careers-bg": theme.bg,
    "--careers-text": theme.text,
    background: theme.bg,
    color: theme.text,
    fontFamily: fontStack(theme.fontId),
  } as CSSProperties;

  return (
    <div className={preview ? "min-h-full" : "min-h-screen"} style={rootStyle}>
      {preview ? (
        <div className="bg-[#0b1f3a] px-4 py-2 text-center text-[12px] font-semibold text-white">
          Private preview · Applicants cannot submit from this page
        </div>
      ) : null}
      <header className="border-b bg-white/95" style={{ borderColor: `${theme.text}1f` }}>
        <div className="mx-auto flex max-w-[920px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: theme.primary }}>
              <IconDiamond size={20} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold">{config.logoText || store.name}</div>
              {location ? <div className="mt-0.5 flex items-center gap-1 text-[12px] opacity-70"><IconMapPin size={13} /> {location}</div> : null}
            </div>
          </div>
          {rating > 0 && reviewCount > 0 ? (
            <div className="hidden items-center gap-1.5 whitespace-nowrap text-[12px] sm:flex">
              <Stars rating={rating} color={theme.accent} />
              <span className="font-semibold">{rating}</span>
              <span className="opacity-60">({reviewCount})</span>
            </div>
          ) : null}
        </div>
      </header>

      <main>
        <section className="border-b" style={{ borderColor: `${theme.text}1f` }}>
          <div className="mx-auto max-w-[920px] px-4 py-10 sm:px-6 sm:py-14">
            <p className="m-0 text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: theme.primary }}>Careers</p>
            <h1 className="mt-2 max-w-[700px] text-[30px] font-extrabold leading-[1.08] sm:text-[44px]">{config.headline || page.headline}</h1>
            <p className="mt-4 max-w-[680px] text-[15px] leading-7 opacity-80 sm:text-[16px]">{config.about || page.about}</p>
            {page.benefits?.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {page.benefits.map((benefit) => (
                  <span key={benefit} className="rounded-full border bg-white/70 px-3 py-1.5 text-[12px] font-semibold" style={{ borderColor: `${theme.text}1f` }}>{benefit}</span>
                ))}
              </div>
            ) : null}
            {interactive ? (
              <a href="#open-positions" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-[14px] font-bold text-white no-underline" style={{ background: theme.primary }}>
                View open positions
              </a>
            ) : (
              <span className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-[14px] font-bold text-white" style={{ background: theme.primary }}>
                View open positions
              </span>
            )}
          </div>
        </section>

        {config.hours.length ? (
          <section className="border-b" style={{ borderColor: `${theme.text}1f` }}>
            <div className="mx-auto max-w-[920px] px-4 py-6 sm:px-6">
              <h2 className="m-0 text-[12px] font-bold uppercase tracking-[0.12em] opacity-60">Store hours</h2>
              <div className="mt-3 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                {config.hours.filter((item) => item.day.trim() || item.hours.trim()).map((item, index) => (
                  <div key={`${item.day}-${index}`} className="flex justify-between gap-4 rounded-lg bg-white/60 px-3 py-2">
                    <span className="font-semibold">{item.day}</span><span className="text-right opacity-75">{item.hours}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section id="open-positions" className="border-b" style={{ borderColor: `${theme.text}1f` }}>
          <div className="mx-auto max-w-[920px] px-4 py-9 sm:px-6 sm:py-12">
            <h2 className="m-0 text-[20px] font-bold">Open positions{jobs.length ? ` (${jobs.length})` : ""}</h2>
            {jobs.length ? (
              <div className={config.jobLayout === "cards" ? "mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" : "mt-4 flex flex-col gap-3"}>
                {jobs.map((job) => {
                  const content = (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-bold">{job.title}</div>
                        <div className="mt-1 flex flex-wrap gap-x-2 text-[12px] opacity-65">
                          {job.location ? <span>{job.location}</span> : null}
                          {job.employmentType || job.type ? <span>{job.employmentType || job.type}</span> : null}
                          {job.compensationSummary || job.salary ? <span>{job.compensationSummary || job.salary}</span> : null}
                        </div>
                        {job.description || job.blurb ? <p className="mt-2 line-clamp-3 text-[13px] leading-5 opacity-80">{job.description || job.blurb}</p> : null}
                      </div>
                      <span className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-full px-4 py-2 text-[13px] font-bold text-white" style={{ background: theme.primary }}>
                        Apply <IconChevronRight size={14} />
                      </span>
                    </>
                  );
                  const className = `flex ${config.jobLayout === "cards" ? "h-full flex-col items-start" : "flex-col sm:flex-row sm:items-center"} gap-4 rounded-xl border bg-white/75 p-4 no-underline`;
                  return interactive ? (
                    <Link key={job.id} href={applyPath(page, job)} className={className} style={{ borderColor: `${theme.text}1f`, color: theme.text }}>{content}</Link>
                  ) : (
                    <div key={job.id} className={className} style={{ borderColor: `${theme.text}1f`, color: theme.text }}>{content}</div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border bg-white/70 px-5 py-9 text-center text-[13px] opacity-70" style={{ borderColor: `${theme.text}1f` }}>
                No open roles right now — check back soon.
              </div>
            )}
          </div>
        </section>

        {testimonials.length ? (
          <section className="border-b" style={{ borderColor: `${theme.text}1f` }}>
            <div className="mx-auto max-w-[920px] px-4 py-9 sm:px-6 sm:py-12">
              <h2 className="m-0 text-[20px] font-bold">What people say</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {testimonials.map((testimonial, index) => (
                  <blockquote key={testimonial.id || `${testimonial.name}-${index}`} className="m-0 rounded-xl border bg-white/70 p-5" style={{ borderColor: `${theme.text}1f` }}>
                    <Stars rating={testimonial.rating} color={theme.accent} />
                    <p className="mt-3 text-[14px] leading-6">“{testimonial.text}”</p>
                    <footer className="mt-3 text-[12px] font-bold opacity-70">{testimonial.name}</footer>
                  </blockquote>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="px-4 py-10 text-center text-white sm:px-6 sm:py-12" style={{ background: theme.primary }}>
          <h2 className="m-0 text-[24px] font-extrabold">Apply in minutes</h2>
          <p className="mx-auto mt-2 max-w-[520px] text-[14px] leading-6 text-white/80">Choose an open role and send the essentials from any phone—no account required.</p>
          {jobs[0] ? interactive ? (
            <Link href={applyPath(page, jobs[0])} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full px-7 py-3 text-[14px] font-bold text-white no-underline" style={{ background: theme.accent }}>
              Start an application
            </Link>
          ) : (
            <span className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full px-7 py-3 text-[14px] font-bold text-white" style={{ background: theme.accent }}>Start an application</span>
          ) : null}
        </section>
      </main>

      <footer className="border-t bg-white/90" style={{ borderColor: `${theme.text}1f` }}>
        <div className="mx-auto flex max-w-[920px] flex-col items-start gap-2 px-4 py-4 text-[11px] opacity-65 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>{store.name}</span>
          <span className="flex flex-wrap items-center gap-2">Hiring powered by <strong>JewelHire</strong>{interactive ? <LegalLinks /> : null}</span>
        </div>
      </footer>
    </div>
  );
}
