"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { IconClock, IconUsers, IconUserPlus, IconBriefcase, IconTargetArrow, IconLink, IconX, IconCheck } from "@/components/icons";
import { useActiveStoreId } from "@/lib/client-session";

type RawStatus = "draft" | "open" | "paused" | "closed";

interface JobRecord {
  id: string;
  slug: string;
  title: string;
  locationId: string | null;
  location: string;
  locationScope: "all" | "selected";
  locationIds: string[];
  employmentType: string;
  compensationSummary: string;
  description: string;
  requirements: string[];
  status: RawStatus;
  openings: number;
  views: number;
  applyClicks: number;
  createdAt: string;
}

interface Kpis {
  applicants: number;
  uniqueApplicants: number;
  hired: number;
  activePipeline: number;
  views: number;
  applyClicks: number;
  applyRate: number;
}

interface ApplicantRow {
  applicationId: string;
  name: string;
  initials: string;
  stage: string;
  appliedDate: string;
  preferredLocationScope?: "any" | "selected";
  preferredLocationIds?: string[];
}

interface StoreLocation {
  id: string;
  name: string;
}

const STATUS_LABEL: Record<RawStatus, string> = { open: "Active", draft: "Draft", paused: "Paused", closed: "Closed" };
const STATUS_STYLE: Record<RawStatus, string> = {
  open: "bg-[#e1f5ee] text-[#0f6e56]",
  draft: "bg-[#eef2f7] text-[#5b6472]",
  paused: "bg-[#fff4e2] text-[#9a6a12]",
  closed: "bg-[#fcebeb] text-[#a32d2d]",
};

const STAGE_STYLE: Record<string, string> = {
  applied: "bg-[#eef2f7] text-[#5b6472]",
  jewelcert: "bg-[#fff4e2] text-[#9a6a12]",
  gemmatch: "bg-[#e8f1ff] text-primary",
  interview: "bg-[#e1f5ee] text-[#0f6e56]",
  offer: "bg-[#efe9fd] text-[#5a44c9]",
  hired: "bg-[#dff3e8] text-[#0f6e56]",
  rejected: "bg-[#fcebeb] text-[#a32d2d]",
  withdrawn: "bg-[#eef2f7] text-[#5b6472]",
};

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Seasonal"];

function Stat({ label, value, sub, icon }: { label: string; value: string | number; sub: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-panel border border-line rounded px-4 py-[15px]">
      <div className="text-xs text-muted font-medium flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-2xl font-semibold text-head mt-[5px] leading-none">{value}</div>
      <div className="text-xs mt-[5px] text-muted">{sub}</div>
    </div>
  );
}

function daysSince(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function stageLabel(stage: string) {
  return stage === "gemmatch" || stage === "GemMatch" ? "JewelCert profile" : stage;
}

function locationPreferenceLabel(applicant: ApplicantRow, locations: StoreLocation[]) {
  if (applicant.preferredLocationScope !== "selected") return "Any participating store";
  const names = (applicant.preferredLocationIds || [])
    .map((id) => locations.find((location) => location.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  return names.length ? names.join(" · ") : "Selected stores";
}

function EditJobModal({ storeId, job, locations, onClose, onSaved }: { storeId: string; job: JobRecord; locations: StoreLocation[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: job.title,
    locationScope: job.locationScope || "selected" as "all" | "selected",
    locationIds: job.locationIds?.length ? job.locationIds : job.locationId ? [job.locationId] : [],
    employmentType: job.employmentType || "Full-time",
    compensationSummary: job.compensationSummary || "",
    openings: String(job.openings || 1),
    description: job.description || "",
    requirements: job.requirements.join("\n"),
    status: job.status,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };
  const toggleLocation = (locationId: string) => {
    setForm((current) => ({
      ...current,
      locationIds: current.locationIds.includes(locationId)
        ? current.locationIds.filter((id) => id !== locationId)
        : [...current.locationIds, locationId],
    }));
  };
  const canSave = form.title.trim().length > 0 && (form.locationScope === "all" || form.locationIds.length > 0) && !saving;
  const input = "w-full border border-line rounded-md px-3 py-2 text-[13.5px] text-body outline-none focus:border-primary bg-white";
  const label = "text-[12px] font-medium text-head mb-1 block";

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/stores/${storeId}/jobs/${job.slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          locationScope: form.locationScope,
          locationIds: form.locationScope === "all" ? [] : form.locationIds,
          employmentType: form.employmentType,
          compensationSummary: form.compensationSummary.trim(),
          openings: Number(form.openings) || 1,
          description: form.description.trim(),
          requirements: form.requirements.split("\n").map((requirement) => requirement.trim()).filter(Boolean),
          status: form.status,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to save job");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save job");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded-lg border border-line bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line sticky top-0 bg-white">
          <h3 className="m-0 text-[15px] font-semibold text-head">Edit posting</h3>
          <button onClick={onClose} className="text-muted hover:text-head" aria-label="Close edit posting"><IconX size={18} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className={label}>Job title *</label>
            <input className={input} value={form.title} onChange={set("title")} autoFocus />
          </div>
          <div>
            <label className={label}>Store availability *</label>
            <div className="rounded-md border border-line p-3 text-[13px] text-body">
              <label className="flex min-h-9 cursor-pointer items-center gap-2"><input type="radio" name="job-location-scope" checked={form.locationScope === "all"} onChange={() => setForm((current) => ({ ...current, locationScope: "all" }))} className="h-4 w-4 accent-primary" />All store locations</label>
              <label className="mt-1 flex min-h-9 cursor-pointer items-center gap-2"><input type="radio" name="job-location-scope" checked={form.locationScope === "selected"} onChange={() => setForm((current) => ({ ...current, locationScope: "selected" }))} className="h-4 w-4 accent-primary" />Selected store locations</label>
              {form.locationScope === "selected" ? <div className="mt-2 grid grid-cols-1 gap-1 border-t border-line pt-2 sm:grid-cols-2">{locations.map((location) => <label key={location.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-1 hover:bg-page"><input type="checkbox" checked={form.locationIds.includes(location.id)} onChange={() => toggleLocation(location.id)} className="h-4 w-4 rounded border-line accent-primary" />{location.name}</label>)}</div> : null}
            </div>
          </div>
          <div>
            <label className={label}>Employment type</label>
            <select className={input} value={form.employmentType} onChange={set("employmentType")}>
              {EMPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Compensation</label>
              <input className={input} value={form.compensationSummary} onChange={set("compensationSummary")} />
            </div>
            <div>
              <label className={label}>Openings</label>
              <input className={input} type="number" min={1} value={form.openings} onChange={set("openings")} />
            </div>
          </div>
          <div>
            <label className={label}>Description</label>
            <textarea className={`${input} h-20 resize-none`} value={form.description} onChange={set("description")} />
          </div>
          <div>
            <label className={label}>Requirements (one per line)</label>
            <textarea className={`${input} h-20 resize-none`} value={form.requirements} onChange={set("requirements")} />
          </div>
          <div>
            <label className={label}>Status</label>
            <select className={input} value={form.status} onChange={set("status")}>
              <option value="open">Active</option>
              <option value="draft">Draft</option>
              <option value="paused">Paused</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          {error && <div className="rounded-md border border-[#f2c2c2] bg-[#fff4f4] px-3 py-2 text-[13px] text-[#a32d2d]">{error}</div>}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} className="btn-outline px-4 py-2 text-[13px]">Cancel</button>
            <button onClick={save} disabled={!canSave} className={`inline-flex items-center gap-1.5 px-4 py-2 text-[13px] ${canSave ? "btn-grad" : "rounded-full bg-[#c2cbe0] text-white cursor-not-allowed"}`}>
              <IconCheck size={15} /> {saving ? "Saving..." : "Save posting"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JobDetail(props: { params: Promise<{ slug: string }> }) {
  const params = use(props.params);
  // Do not request a hard-coded store while /api/me is still resolving. For
  // SSO-provisioned stores that first request returned 404 and permanently
  // masked the valid response for the authenticated store.
  const STORE_ID = useActiveStoreId("");
  const [job, setJob] = useState<JobRecord | null>(null);
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(() => {
    if (!STORE_ID) return Promise.resolve();
    return fetch(`/api/stores/${STORE_ID}/jobs/${params.slug}`)
      .then((response) => {
        if (response.status === 404) { setNotFound(true); return null; }
        return response.ok ? response.json() : Promise.reject();
      })
      .then((data: { job: JobRecord; kpis: Kpis; applicants: ApplicantRow[] } | null) => {
        if (!data) return;
        setNotFound(false);
        setJob(data.job);
        setKpis(data.kpis);
        setApplicants(data.applicants || []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [STORE_ID, params.slug]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!STORE_ID) return;
    let cancelled = false;
    fetch(`/api/stores/${STORE_ID}/locations`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { items: StoreLocation[] }) => { if (!cancelled) setLocations(data.items || []); })
      .catch(() => { if (!cancelled) setLocations([]); });
    return () => { cancelled = true; };
  }, [STORE_ID]);

  const changeStatus = async (status: RawStatus) => {
    if (!job) return;
    setJob({ ...job, status });
    await fetch(`/api/stores/${STORE_ID}/jobs/${params.slug}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => undefined);
    load();
  };

  if (loading) return <div className="p-10 text-center text-muted text-sm">Loading job…</div>;
  if (notFound || !job || !kpis) {
    return (
      <div>
        <div className="text-[12.5px] text-muted mb-3.5"><Link href="/jobs" className="text-primary no-underline">Jobs</Link> / Not found</div>
        <Panel><EmptyState icon={<IconBriefcase size={20} />} title="Job not found" message="This role may have been removed. Head back to Jobs to create or pick another." action={<Link href="/jobs" className="btn-grad inline-flex items-center px-4 py-2 text-[13px] no-underline">Back to Jobs</Link>} /></Panel>
      </div>
    );
  }

  return (
    <div>
      <div className="text-[12.5px] text-muted mb-3.5">
        <Link href="/jobs" className="text-primary no-underline">Jobs</Link> / {job.title}
      </div>

      <div className="flex flex-wrap items-center gap-3.5 bg-panel border border-line rounded px-[18px] py-4 mb-4">
        <span className="w-12 h-12 rounded-[10px] bg-[#e8f1ff] text-primary flex items-center justify-center"><IconBriefcase size={22} /></span>
        <div>
          <h1 className="text-[20px] font-bold text-head m-0">{job.title}</h1>
          <div className="text-[13px] text-muted mt-0.5 flex flex-wrap items-center gap-2">
            {job.location} · {job.openings} opening{job.openings === 1 ? "" : "s"}{job.employmentType ? ` · ${job.employmentType}` : ""}{job.compensationSummary ? ` · ${job.compensationSummary}` : ""}
            <span className={`text-[11.5px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[job.status]}`}>{STATUS_LABEL[job.status]}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <button onClick={() => setShowEdit(true)} className="btn-outline px-3.5 py-2.5 text-[13px]">Edit posting</button>
          <Link href="/send-jewelcert" className="btn-outline px-3.5 py-2.5 text-[13px]">Send JewelCert</Link>
          <label className="text-[12.5px] text-muted">Status</label>
          <select value={job.status} onChange={(e) => changeStatus(e.target.value as RawStatus)} className="border border-line rounded-md px-3 py-2 text-[13px] text-body bg-white outline-none focus:border-primary">
            <option value="open">Active</option>
            <option value="draft">Draft</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5 mb-[18px]">
        <Stat label="Running" value={`${daysSince(job.createdAt)}d`} sub="Since posted" icon={<IconClock size={13} />} />
        <Stat label="Applicants" value={kpis.applicants} sub={`${kpis.uniqueApplicants} unique`} icon={<IconUsers size={13} />} />
        <Stat label="In pipeline" value={kpis.activePipeline} sub="Active stages" icon={<IconTargetArrow size={13} />} />
        <Stat label="Hired" value={kpis.hired} sub={`${job.openings} seat${job.openings === 1 ? "" : "s"}`} icon={<IconUserPlus size={13} />} />
        <Stat label="Apply-page views" value={kpis.views} sub={`${kpis.applyClicks} submissions`} icon={<IconLink size={13} />} />
        <Stat label="Apply rate" value={`${kpis.applyRate}%`} sub="Apply-page views → submissions" />
      </div>

      <Panel title={`Applicants (${kpis.applicants})`} action={<Link href="/pipeline" className="text-[12.5px] text-primary no-underline">Open pipeline</Link>}>
        {applicants.length > 0 ? (
          <div className="overflow-x-auto"><table className="w-full border-collapse">
            <thead>
              <tr>
                {["Applicant", "Store preferences", "Applied", "Stage"].map((h) => (
                  <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applicants.map((a) => (
                <tr key={a.applicationId} className="hover:bg-rowhover">
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                    <span className="flex items-center gap-2.5">
                      <span className="w-[30px] h-[30px] rounded-full bg-[#e8f1ff] flex items-center justify-center text-[11px] font-bold text-primary">{a.initials}</span>
                      <span className="font-medium text-head">{a.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[12px] text-body">{locationPreferenceLabel(a, locations)}</td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] text-body">{formatDate(a.appliedDate)}</td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><span className={`inline-flex text-[11.5px] font-medium px-2.5 py-1 rounded-full capitalize ${STAGE_STYLE[a.stage] || "bg-[#eef2f7] text-[#5b6472]"}`}>{stageLabel(a.stage)}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <EmptyState compact icon={<IconUsers size={18} />} title="No applicants yet" message={job.status === "open" ? "This role is live on your public careers page. Applicants will appear here as they apply." : "Set this role to Active to publish it on your public careers page and start collecting applicants."} />
        )}
      </Panel>

      {showEdit && <EditJobModal storeId={STORE_ID} job={job} locations={locations} onClose={() => setShowEdit(false)} onSaved={load} />}
    </div>
  );
}
