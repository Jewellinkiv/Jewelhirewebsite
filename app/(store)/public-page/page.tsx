"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common";
import { PublicCareersView, type CareersJobView, type CareersStoreView } from "@/components/PublicCareersView";
import {
  TEMPLATES, FONTS,
  PublicPageConfig, JobLayout, Testimonial,
} from "@/lib/public-templates";
import { StorePublicPageRecord } from "@/lib/applicant-lifecycle";
import {
  IconPlus, IconX, IconPalette, IconLink,
} from "@/components/icons";
import { useActiveStoreId } from "@/lib/client-session";

const T0 = TEMPLATES[0];
const FALLBACK_STORE_ID = "store-sissys-little-rock";

type PublicPageResponse = {
  page?: StorePublicPageRecord;
  store?: CareersStoreView & { careersUrl?: string };
  jobs?: CareersJobView[];
  config: PublicPageConfig;
};

// The shareable careers PAGE (what owners embed as a hyperlink) — not the JSON
// API endpoint this used to point at (visitors would have seen raw JSON).
function publicStorePath(slug: string) {
  const candidate = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!candidate || candidate.includes("/") || candidate.includes(".")) return "";
  return `/careers/${candidate}`;
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
  const STORE_ID = useActiveStoreId(FALLBACK_STORE_ID);
  // Store-identifying fields start blank (never another store's name) and are
  // populated from the real config on load; generic layout/copy defaults remain.
  const [cfg, setCfg] = useState<PublicPageConfig>({
    templateId: T0.id,
    logoText: "",
    theme: { ...T0.theme },
    jobLayout: T0.jobLayout,
    headline: "Build a career in fine jewelry.",
    about: "",
    hours: [],
    showReviews: false,
    testimonials: [],
    status: "draft",
  });
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");
  const [viewData, setViewData] = useState<Pick<PublicPageResponse, "page" | "store" | "jobs">>({ jobs: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    fetch(`/api/stores/${STORE_ID}/public-page`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: PublicPageResponse) => {
        if (cancelled) return;
        setCfg(data.config);
        setPublicSlug(data.page?.slug || data.store?.careersUrl || "");
        setViewData({ page: data.page, store: data.store, jobs: data.jobs || [] });
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setNotice("Public page could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [STORE_ID]);

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
  const rmTest = (i: number) => setCfg((c) => ({ ...c, testimonials: c.testimonials.filter((_, j) => j !== i) }));

  const applyResponse = (data: PublicPageResponse) => {
    setCfg(data.config);
    setPublicSlug(data.page?.slug || data.store?.careersUrl || publicSlug);
    setViewData({ page: data.page, store: data.store, jobs: data.jobs || [] });
  };

  const saveConfig = async (nextConfig = cfg, showNotice = true) => {
    if (!loaded) {
      setNotice("Wait for the public page to load before saving.");
      return undefined;
    }
    setBusy(true);
    const response = await fetch(`/api/stores/${STORE_ID}/public-page`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: nextConfig }),
    });
    if (!response.ok) {
      setNotice("Public page could not be saved.");
      setBusy(false);
      return undefined;
    }
    const data = await response.json() as PublicPageResponse;
    applyResponse(data);
    if (showNotice) setNotice("Public page saved.");
    setBusy(false);
    return data;
  };

  const publishStatus = async (status: PublicPageConfig["status"]) => {
    const nextConfig = { ...cfg, status };
    setCfg(nextConfig);
    const saved = await saveConfig(nextConfig, false);
    if (saved) setNotice(`Public page ${status}.`);
  };

  const openPreview = async () => {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      setNotice("Allow pop-ups for JewelHire to open a private preview.");
      return;
    }
    previewWindow.opener = null;
    previewWindow.document.title = "Preparing private preview…";
    const saved = await saveConfig(cfg, false);
    if (!saved) {
      previewWindow.close();
      return;
    }
    const response = await fetch(`/api/stores/${STORE_ID}/public-page/preview`, { method: "POST" });
    if (!response.ok) {
      previewWindow.close();
      setNotice("Private preview could not be created.");
      return;
    }
    const data = await response.json() as { preview?: { previewUrl?: string } };
    if (!data.preview?.previewUrl) {
      previewWindow.close();
      setNotice("Private preview could not be created.");
      return;
    }
    previewWindow.location.replace(new URL(data.preview.previewUrl, window.location.origin).toString());
    setNotice("Private preview opened in a new tab. It expires in 24 hours.");
  };

  const copyLink = async () => {
    if (cfg.status !== "published") {
      setNotice("Publish the page before sharing its public link. Use Preview for drafts.");
      return;
    }
    const path = publicStorePath(publicSlug);
    if (!path) {
      setNotice("The public link is not ready yet. Save the page and try again.");
      return;
    }
    const url = new URL(path, window.location.origin).toString();
    try {
      await writeClipboardText(url);
      setNotice("Careers page link copied.");
    } catch {
      setNotice(`Copy this link: ${url}`);
    }
  };

  const t = cfg.theme;
  const input = "w-full border border-line rounded-md px-2.5 py-2 text-[13px] text-body outline-none focus:border-primary bg-white";
  const label = "text-[11.5px] font-semibold text-head mb-1 block";
  const statusStyle = cfg.status === "published" ? "bg-[#dff3e8] text-[#0f6e56]" : cfg.status === "paused" ? "bg-[#fff4e2] text-[#9a6a12]" : "bg-[#eef2f7] text-[#5b6472]";
  const publicUrl = publicStorePath(publicSlug);
  const previewPage: StorePublicPageRecord = viewData.page || {
    id: "builder-preview",
    storeId: STORE_ID,
    slug: publicSlug || "preview",
    headline: cfg.headline,
    about: cfg.about,
    benefits: [],
    reviewSummary: { rating: 0, count: 0 },
    status: cfg.status,
    updatedAt: new Date(0).toISOString(),
  };

  return (
    <div>
      <PageHeader
        title="Public hiring page"
        subtitle="Pick a template, brand it, and publish. Applicants only see and apply to your store."
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={openPreview} disabled={busy || !loaded} className="btn-outline inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] disabled:opacity-60">Preview</button>
            <button onClick={copyLink} disabled={busy || !loaded || cfg.status !== "published"} className="btn-outline inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"><IconLink size={16} /> Copy link</button>
          </div>
        }
      />

      {notice && (
        <div className="mb-4 rounded-md border border-[#cdeadd] bg-[#e1f5ee] px-3.5 py-2.5 text-[13px] text-[#0f6e56]">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-[18px] items-start">
        {/* ---------- SETTINGS ---------- */}
        <div className="bg-panel border border-line rounded p-4 space-y-5 lg:sticky lg:top-[68px]">
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
              <select disabled={busy || !loaded} className={input + " flex-1 disabled:cursor-not-allowed disabled:opacity-60"} value={cfg.status} onChange={(e) => publishStatus(e.target.value as PublicPageConfig["status"])}>
                <option value="draft">Draft</option><option value="published">Published</option><option value="paused">Paused</option>
              </select>
              <button onClick={() => saveConfig()} disabled={busy || !loaded} className="btn-grad px-4 py-2 text-[13px] disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>

        {/* ---------- LIVE PREVIEW ---------- */}
        <div className="rounded-[12px] border border-line overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f1f3f8] border-b border-line">
            <span className="w-3 h-3 rounded-full bg-[#e2683c]" /><span className="w-3 h-3 rounded-full bg-[#f0a500]" /><span className="w-3 h-3 rounded-full bg-[#1f9e75]" />
            <span className="ml-3 flex-1 max-w-[420px] text-[12px] text-muted bg-white border border-line rounded-md px-3 py-1.5 truncate">{publicUrl || "Public link created after setup"}</span>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusStyle}`}>{cfg.status}</span>
          </div>
          <PublicCareersView
            store={viewData.store || { name: cfg.logoText || "Your store" }}
            page={previewPage}
            jobs={viewData.jobs || []}
            config={cfg}
            interactive={false}
            preview
          />
        </div>

      </div>
    </div>
  );
}
