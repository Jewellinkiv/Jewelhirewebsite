"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common";
import { STORE, STORE_JOBS } from "@/lib/public-store";
import {
  TEMPLATES, FONTS, fontStack, DEFAULT_HOURS, DEFAULT_TESTIMONIALS,
  PublicPageConfig, JobLayout, Testimonial,
} from "@/lib/public-templates";
import { StorePublicPageRecord } from "@/lib/applicant-lifecycle";
import {
  IconStar, IconMapPin, IconDiamond, IconChevronLeft, IconChevronRight,
  IconPlus, IconX, IconPalette, IconLink,
} from "@/components/icons";

function Stars({ rating, size = 15, color = "#f0a500" }: { rating: number; size?: number; color?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ color: i < Math.round(rating) ? color : "#d7dce6" }}>
          <IconStar size={size} />
        </span>
      ))}
    </span>
  );
}

const T0 = TEMPLATES[0];
const STORE_ID = "store-sissys-little-rock";

type PublicPageResponse = {
  page?: StorePublicPageRecord;
  store?: typeof STORE & { careersUrl?: string };
  config: PublicPageConfig;
};

function publicStoreUrl(slug: string) {
  const candidate = slug.trim().replace(/^\/+|\/+$/g, "");
  const normalized = candidate && !candidate.includes("/") && !candidate.includes(".") ? candidate : "sissys-log-cabin-careers";
  if (typeof window === "undefined") return `/api/public/stores/${normalized}`;
  return new URL(`/api/public/stores/${normalized}`, window.location.origin).toString();
}

async function writeClipboardText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("input");
  input.value = value;
  input.setAttribute("readonly", "true");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(input);
  if (!copied) throw new Error("Clipboard copy failed");
}

export default function PublicPageBuilder() {
  const [cfg, setCfg] = useState<PublicPageConfig>({
    templateId: T0.id,
    logoText: "Sissy's Log Cabin",
    theme: { ...T0.theme },
    jobLayout: T0.jobLayout,
    headline: "Build a career in fine jewelry.",
    about: STORE.about,
    hours: DEFAULT_HOURS.map((h) => ({ ...h })),
    showReviews: true,
    testimonials: DEFAULT_TESTIMONIALS.map((t) => ({ ...t })),
    status: "draft",
  });
  const [slide, setSlide] = useState(0);
  const [notice, setNotice] = useState("");
  const [publicSlug, setPublicSlug] = useState("sissys-log-cabin-careers");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stores/${STORE_ID}/public-page`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: PublicPageResponse) => {
        if (cancelled) return;
        setCfg(data.config);
        setPublicSlug(data.page?.slug || data.store?.careersUrl || "sissys-log-cabin-careers");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)!;
    setCfg((c) => ({ ...c, templateId: id, theme: { ...t.theme }, jobLayout: t.jobLayout }));
  };
  const setTheme = (k: keyof PublicPageConfig["theme"], v: string) => setCfg((c) => ({ ...c, theme: { ...c.theme, [k]: v } }));
  const setHour = (i: number, k: "day" | "hours", v: string) => setCfg((c) => ({ ...c, hours: c.hours.map((h, j) => (j === i ? { ...h, [k]: v } : h)) }));
  const addHour = () => setCfg((c) => ({ ...c, hours: [...c.hours, { day: "", hours: "" }] }));
  const rmHour = (i: number) => setCfg((c) => ({ ...c, hours: c.hours.filter((_, j) => j !== i) }));
  const setTest = (i: number, k: keyof Testimonial, v: string | number) => setCfg((c) => ({ ...c, testimonials: c.testimonials.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const addTest = () => setCfg((c) => ({ ...c, testimonials: [...c.testimonials, { name: "", rating: 5, text: "" }] }));
  const rmTest = (i: number) => { setCfg((c) => ({ ...c, testimonials: c.testimonials.filter((_, j) => j !== i) })); setSlide(0); };

  const saveConfig = async (nextConfig = cfg) => {
    const response = await fetch(`/api/stores/${STORE_ID}/public-page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: nextConfig }),
    });
    if (!response.ok) {
      setNotice("Public page could not be saved locally.");
      return;
    }
    const data = await response.json() as { config: PublicPageConfig };
    setCfg(data.config);
    setNotice("Public page saved.");
  };

  const publishStatus = async (status: PublicPageConfig["status"]) => {
    const nextConfig = { ...cfg, status };
    setCfg(nextConfig);
    const response = await fetch(`/api/stores/${STORE_ID}/public-page/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      setNotice("Publish status could not be updated locally.");
      return;
    }
    const data = await response.json() as { config: PublicPageConfig };
    setCfg(data.config);
    setNotice(`Public page ${status}.`);
  };

  const copyLink = async () => {
    const url = publicStoreUrl(publicSlug);
    try {
      await writeClipboardText(url);
      setNotice("Careers page link copied.");
    } catch {
      setNotice(`Copy this link: ${url}`);
    }
  };

  const t = cfg.theme;
  const font = fontStack(t.fontId);
  const input = "w-full border border-line rounded-md px-2.5 py-2 text-[13px] text-body outline-none focus:border-primary bg-white";
  const label = "text-[11.5px] font-semibold text-head mb-1 block";
  const statusStyle = cfg.status === "published" ? "bg-[#dff3e8] text-[#0f6e56]" : cfg.status === "paused" ? "bg-[#fff4e2] text-[#9a6a12]" : "bg-[#eef2f7] text-[#5b6472]";
  const tCount = cfg.testimonials.length;
  const cur = tCount ? cfg.testimonials[Math.min(slide, tCount - 1)] : null;
  const publicUrl = publicStoreUrl(publicSlug);

  return (
    <div>
      <PageHeader
        title="Public hiring page"
        subtitle="Pick a template, brand it, and publish. Applicants only see and apply to your store."
        action={
          <button onClick={copyLink} className="btn-outline inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px]"><IconLink size={16} /> Copy link</button>
        }
      />

      {notice && (
        <div className="mb-4 rounded-md border border-[#cdeadd] bg-[#e1f5ee] px-3.5 py-2.5 text-[13px] text-[#0f6e56]">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-[18px] items-start">
        {/* ---------- SETTINGS ---------- */}
        <div className="bg-panel border border-line rounded p-4 space-y-5 xl:sticky xl:top-[68px]">
          {/* template */}
          <div>
            <div className={label}>Template</div>
            <div className="grid grid-cols-1 gap-2">
              {TEMPLATES.map((tp) => (
                <button key={tp.id} onClick={() => applyTemplate(tp.id)}
                  className={`text-left border rounded-md p-2.5 ${cfg.templateId === tp.id ? "border-primary bg-[#eef4ff]" : "border-line hover:bg-rowhover"}`}>
                  <div className="flex items-center gap-2">
                    <span className="flex gap-1">
                      {[tp.theme.primary, tp.theme.accent, tp.theme.bg].map((c) => <span key={c} className="w-3.5 h-3.5 rounded-full border border-line" style={{ background: c }} />)}
                    </span>
                    <span className="text-[13px] font-semibold text-head">{tp.name}</span>
                  </div>
                  <div className="text-[11.5px] text-muted mt-1">{tp.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          {/* brand */}
          <div>
            <div className={label}><span className="inline-flex items-center gap-1.5"><IconPalette size={14} /> Logo &amp; colors</span></div>
            <input className={input} value={cfg.logoText} onChange={(e) => setCfg((c) => ({ ...c, logoText: e.target.value }))} placeholder="Logo / store name" />
            <div className="grid grid-cols-2 gap-2 mt-2">
              {([["primary", "Primary"], ["accent", "Accent"], ["bg", "Background"], ["text", "Text"]] as const).map(([k, lbl]) => (
                <label key={k} className="flex items-center gap-2 text-[12px] text-body border border-line rounded-md px-2 py-1.5">
                  <input type="color" value={t[k]} onChange={(e) => setTheme(k, e.target.value)} className="w-6 h-6 rounded border-0 bg-transparent p-0 cursor-pointer" />
                  {lbl}
                </label>
              ))}
            </div>
            <div className="mt-2">
              <span className={label}>Font</span>
              <select className={input} value={t.fontId} onChange={(e) => setTheme("fontId", e.target.value)}>
                {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          </div>

          {/* content */}
          <div>
            <div className={label}>Headline &amp; about</div>
            <input className={input} value={cfg.headline} onChange={(e) => setCfg((c) => ({ ...c, headline: e.target.value }))} />
            <textarea className={`${input} h-20 resize-none mt-2`} value={cfg.about} onChange={(e) => setCfg((c) => ({ ...c, about: e.target.value }))} />
          </div>

          {/* hours */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={label + " mb-0"}>Hours</span>
              <button onClick={addHour} className="text-[12px] text-primary font-medium inline-flex items-center gap-1"><IconPlus size={13} /> Add</button>
            </div>
            <div className="space-y-1.5">
              {cfg.hours.map((h, i) => (
                <div key={i} className="flex gap-1.5">
                  <input className={input + " flex-1"} value={h.day} onChange={(e) => setHour(i, "day", e.target.value)} placeholder="Mon–Fri" />
                  <input className={input + " flex-1"} value={h.hours} onChange={(e) => setHour(i, "hours", e.target.value)} placeholder="10–6" />
                  <button onClick={() => rmHour(i)} className="text-muted hover:text-[#a32d2d] px-1"><IconX size={15} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* jobs layout */}
          <div>
            <div className={label}>Job posting layout</div>
            <div className="flex gap-1.5">
              {(["cards", "list"] as JobLayout[]).map((l) => (
                <button key={l} onClick={() => setCfg((c) => ({ ...c, jobLayout: l }))}
                  className={`flex-1 text-[12.5px] py-2 rounded-md border capitalize ${cfg.jobLayout === l ? "border-primary bg-[#eef4ff] text-primary font-medium" : "border-line text-body hover:bg-rowhover"}`}>{l}</button>
              ))}
            </div>
          </div>

          {/* reviews */}
          <div>
            <label className="flex items-center justify-between cursor-pointer">
              <span className={label + " mb-0"}>Testimonials slider</span>
              <input type="checkbox" checked={cfg.showReviews} onChange={(e) => setCfg((c) => ({ ...c, showReviews: e.target.checked }))} className="w-4 h-4 accent-[#123FB9]" />
            </label>
            {cfg.showReviews && (
              <div className="space-y-2 mt-2">
                {cfg.testimonials.map((tt, i) => (
                  <div key={i} className="border border-line rounded-md p-2 space-y-1.5">
                    <div className="flex gap-1.5">
                      <input className={input + " flex-1"} value={tt.name} onChange={(e) => setTest(i, "name", e.target.value)} placeholder="Name" />
                      <select className={input + " w-16"} value={tt.rating} onChange={(e) => setTest(i, "rating", Number(e.target.value))}>
                        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}★</option>)}
                      </select>
                      <button onClick={() => rmTest(i)} className="text-muted hover:text-[#a32d2d] px-1"><IconX size={15} /></button>
                    </div>
                    <textarea className={`${input} h-12 resize-none`} value={tt.text} onChange={(e) => setTest(i, "text", e.target.value)} placeholder="Testimonial…" />
                  </div>
                ))}
                <button onClick={addTest} className="text-[12.5px] text-primary font-medium inline-flex items-center gap-1"><IconPlus size={13} /> Add testimonial</button>
              </div>
            )}
          </div>

          {/* publish */}
          <div className="pt-1 border-t border-line">
            <div className={label + " mt-3"}>Status</div>
            <div className="flex gap-2 items-center">
              <select className={input + " flex-1"} value={cfg.status} onChange={(e) => publishStatus(e.target.value as PublicPageConfig["status"])}>
                <option value="draft">Draft</option><option value="published">Published</option><option value="paused">Paused</option>
              </select>
              <button onClick={() => saveConfig()} className="btn-grad px-4 py-2 text-[13px]">Save</button>
            </div>
          </div>
        </div>

        {/* ---------- LIVE PREVIEW ---------- */}
        <div className="rounded-[12px] border border-line overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f1f3f8] border-b border-line">
            <span className="w-3 h-3 rounded-full bg-[#e2683c]" /><span className="w-3 h-3 rounded-full bg-[#f0a500]" /><span className="w-3 h-3 rounded-full bg-[#1f9e75]" />
            <span className="ml-3 flex-1 max-w-[420px] text-[12px] text-muted bg-white border border-line rounded-md px-3 py-1.5 truncate">{publicUrl}</span>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusStyle}`}>{cfg.status}</span>
          </div>

          <div style={{ background: t.bg, color: t.text, fontFamily: font }}>
            {/* hero */}
            <div className="px-8 pt-9 pb-7" style={{ borderBottom: `1px solid ${t.text}14` }}>
              <div className="flex items-center gap-2.5 mb-5">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold" style={{ background: t.primary }}><IconDiamond size={18} /></span>
                <span className="font-bold text-[16px]">{cfg.logoText}</span>
              </div>
              <div className="text-[12px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: t.primary }}>Careers</div>
              <h1 className="text-[34px] leading-[1.1] font-extrabold m-0 max-w-[560px]">{cfg.headline}</h1>
              <p className="text-[15px] leading-relaxed mt-3 max-w-[560px]" style={{ opacity: 0.85 }}>{cfg.about}</p>
              <div className="flex flex-wrap items-center gap-4 mt-4 text-[13px]" style={{ opacity: 0.8 }}>
                <span className="inline-flex items-center gap-1.5"><IconMapPin size={15} style={{ color: t.primary }} /> {STORE.location}</span>
                <span className="inline-flex items-center gap-1.5"><Stars rating={STORE.rating} color={t.accent} /> {STORE.rating} ({STORE.reviewCount})</span>
              </div>
              <button className="inline-flex items-center gap-2 px-6 py-3 text-[15px] mt-6 rounded-full text-white font-bold" style={{ background: t.primary }}>View open positions</button>
            </div>

            {/* hours */}
            <div className="px-8 py-6" style={{ borderBottom: `1px solid ${t.text}14` }}>
              <div className="text-[12px] font-bold uppercase tracking-[0.1em] mb-3" style={{ opacity: 0.6 }}>Store hours</div>
              <div className="flex flex-wrap gap-x-10 gap-y-2 text-[14px]">
                {cfg.hours.map((h, i) => (
                  <div key={i} className="flex gap-3"><span className="font-semibold min-w-[88px]">{h.day}</span><span style={{ opacity: 0.8 }}>{h.hours}</span></div>
                ))}
              </div>
            </div>

            {/* jobs */}
            <div className="px-8 py-7" style={{ borderBottom: `1px solid ${t.text}14` }}>
              <h2 className="text-[20px] font-bold m-0 mb-4">Open positions</h2>
              {cfg.jobLayout === "cards" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {STORE_JOBS.map((j) => (
                    <div key={j.id} className="rounded-[10px] p-4" style={{ border: `1px solid ${t.text}1f` }}>
                      <div className="text-[15px] font-bold">{j.title}</div>
                      <div className="text-[12px] mt-0.5" style={{ opacity: 0.65 }}>{j.type} · {j.salary}</div>
                      <p className="text-[12.5px] leading-relaxed mt-2 mb-3" style={{ opacity: 0.8 }}>{j.blurb}</p>
                      <button className="px-4 py-2 text-[13px] rounded-full text-white font-bold" style={{ background: t.primary }}>Apply</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {STORE_JOBS.map((j) => (
                    <div key={j.id} className="flex flex-wrap items-center gap-4 rounded-[10px] px-4 py-3" style={{ border: `1px solid ${t.text}1f` }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-bold">{j.title}</div>
                        <div className="text-[12px]" style={{ opacity: 0.65 }}>{j.type} · {j.location} · {j.salary}</div>
                      </div>
                      <button className="px-4 py-2 text-[13px] rounded-full text-white font-bold" style={{ background: t.primary }}>Apply</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* testimonials slider */}
            {cfg.showReviews && cur && (
              <div className="px-8 py-8" style={{ borderBottom: `1px solid ${t.text}14` }}>
                <h2 className="text-[20px] font-bold m-0 mb-4">What people say</h2>
                <div className="rounded-[12px] p-6 text-center" style={{ background: `${t.primary}0d`, border: `1px solid ${t.text}1f` }}>
                  <span style={{ color: t.accent }}><Stars rating={cur.rating} size={18} color={t.accent} /></span>
                  <p className="text-[16px] leading-relaxed mt-3 mb-4 max-w-[560px] mx-auto" style={{ fontStyle: "italic" }}>&ldquo;{cur.text || "Your testimonial…"}&rdquo;</p>
                  <div className="text-[13px] font-semibold">{cur.name || "Customer"}</div>
                  {tCount > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-4">
                      <button onClick={() => setSlide((s) => (s - 1 + tCount) % tCount)} className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: t.primary }}><IconChevronLeft size={16} /></button>
                      <span className="flex gap-1.5">
                        {cfg.testimonials.map((_, i) => <span key={i} className="w-2 h-2 rounded-full" style={{ background: i === Math.min(slide, tCount - 1) ? t.primary : `${t.text}33` }} />)}
                      </span>
                      <button onClick={() => setSlide((s) => (s + 1) % tCount)} className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: t.primary }}><IconChevronRight size={16} /></button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* apply CTA */}
            <div className="px-8 py-9 text-center" style={{ background: t.primary }}>
              <h2 className="text-[22px] font-extrabold m-0 text-white">Apply in minutes</h2>
              <p className="text-[14px] mt-2 mb-5 text-white" style={{ opacity: 0.85 }}>Build your resume and take a short JewelCert assessment.</p>
              <button className="px-7 py-3 text-[15px] rounded-full font-bold" style={{ background: t.accent, color: "#fff" }}>Start your application</button>
            </div>

            <div className="px-8 py-4 flex items-center justify-center gap-2 text-[12px]" style={{ opacity: 0.6 }}>
              Powered by JewelHire · JewelLink
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
