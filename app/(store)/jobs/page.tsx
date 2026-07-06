"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel } from "@/components/ui";
import { LEGACY_ASSESSMENTS, LEGACY_COURSES } from "@/lib/legacy";
import { EmptyState } from "@/components/states";
import { IconBriefcase, IconClipboardList, IconSchool, IconSend, IconUserPlus, IconX, IconCheck } from "@/components/icons";

const STORE_ID = "store-sissys-little-rock";

type RawStatus = "draft" | "open" | "paused" | "closed";

interface JobRecord {
  id: string;
  slug: string;
  title: string;
  location: string;
  locationId: string | null;
  employmentType: string;
  compensationSummary: string;
  description: string;
  requirements: string[];
  idealGemMatchMix: string[];
  status: RawStatus;
  openings: number;
  views: number;
  applyClicks: number;
}

interface JobItem {
  job: JobRecord;
  kpis: { applicants: number; uniqueApplicants: number; hired: number; activePipeline: number; views: number; applyClicks: number };
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

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-panel border border-line rounded px-4 py-[15px]">
      <div className="text-xs text-muted font-medium">{label}</div>
      <div className="text-2xl font-semibold text-head mt-[5px] leading-none">{value}</div>
      <div className="text-xs mt-[5px] text-muted">{sub}</div>
    </div>
  );
}

function StatusChip({ status }: { status: RawStatus }) {
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-[11.5px] font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

function ProfileCard({ item }: { item: JobItem }) {
  const { job, kpis } = item;
  return (
    <Panel>
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/jobs/${job.slug}`} className="m-0 text-[16px] font-semibold text-head no-underline hover:text-primary">{job.title}</Link>
              <StatusChip status={job.status} />
            </div>
            <p className="m-0 mt-1 text-[12.5px] text-muted">{job.location} - {job.openings} opening{job.openings === 1 ? "" : "s"}{job.employmentType ? ` · ${job.employmentType}` : ""}{job.compensationSummary ? ` · ${job.compensationSummary}` : ""}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[11.5px] bg-page border border-line rounded-full px-2.5 py-1 text-body">{kpis.applicants} applicant{kpis.applicants === 1 ? "" : "s"}</span>
              <span className="text-[11.5px] bg-[#e8f1ff] text-primary rounded-full px-2.5 py-1">{kpis.activePipeline} in pipeline</span>
              <span className="text-[11.5px] bg-[#dff3e8] text-[#0f6e56] rounded-full px-2.5 py-1">{kpis.hired} hired</span>
              <span className="text-[11.5px] bg-page border border-line rounded-full px-2.5 py-1 text-body">{kpis.views} view{kpis.views === 1 ? "" : "s"}</span>
              <span className="text-[11.5px] bg-page border border-line rounded-full px-2.5 py-1 text-body">{kpis.applyClicks} apply click{kpis.applyClicks === 1 ? "" : "s"}</span>
            </div>
          </div>
          <Link href={`/jobs/${job.slug}`} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-[12.5px] font-medium text-body no-underline hover:bg-rowhover shrink-0">
            <IconUserPlus size={15} /> View job
          </Link>
        </div>

        {(job.description || job.requirements.length > 0) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {job.description && (
              <div className="border border-line rounded-md px-3 py-3 text-[12.5px] leading-relaxed text-body">{job.description}</div>
            )}
            {job.requirements.length > 0 && (
              <div className="border border-line rounded-md px-3 py-3">
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-head mb-2"><IconClipboardList size={14} /> Requirements</div>
                <ul className="m-0 pl-4 text-[12.5px] text-body leading-relaxed">
                  {job.requirements.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Seasonal"];

function CreateJobModal({ locations, onClose, onCreated }: { locations: StoreLocation[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: "",
    locationId: "",
    location: "",
    employmentType: "Full-time",
    compensationSummary: "",
    openings: "1",
    description: "",
    requirements: "",
    status: "open" as RawStatus,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const canSubmit = form.title.trim().length > 0 && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    const selectedLocation = locations.find((l) => l.id === form.locationId);
    try {
      const response = await fetch(`/api/stores/${STORE_ID}/jobs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          locationId: form.locationId || undefined,
          location: selectedLocation?.name || form.location.trim() || undefined,
          employmentType: form.employmentType,
          compensationSummary: form.compensationSummary.trim(),
          openings: Number(form.openings) || 1,
          description: form.description.trim(),
          requirements: form.requirements.split("\n").map((r) => r.trim()).filter(Boolean),
          status: form.status,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to create job");
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create job");
      setSaving(false);
    }
  };

  const input = "w-full border border-line rounded-md px-3 py-2 text-[13.5px] text-body outline-none focus:border-primary bg-white";
  const label = "text-[12px] font-medium text-head mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded-lg border border-line bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line sticky top-0 bg-white">
          <h3 className="m-0 text-[15px] font-semibold text-head">New role profile</h3>
          <button onClick={onClose} className="text-muted hover:text-head"><IconX size={18} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className={label}>Job title *</label>
            <input className={input} value={form.title} onChange={set("title")} placeholder="Sales Associate" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Location</label>
              <select className={input} value={form.locationId} onChange={set("locationId")}>
                <option value="">Select a location</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Employment type</label>
              <select className={input} value={form.employmentType} onChange={set("employmentType")}>
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Compensation</label>
              <input className={input} value={form.compensationSummary} onChange={set("compensationSummary")} placeholder="$60,000 – $85,000" />
            </div>
            <div>
              <label className={label}>Openings</label>
              <input className={input} type="number" min={1} value={form.openings} onChange={set("openings")} />
            </div>
          </div>
          <div>
            <label className={label}>Description</label>
            <textarea className={`${input} h-20 resize-none`} value={form.description} onChange={set("description")} placeholder="What the role does and who thrives in it…" />
          </div>
          <div>
            <label className={label}>Requirements (one per line)</label>
            <textarea className={`${input} h-20 resize-none`} value={form.requirements} onChange={set("requirements")} placeholder={"Bench jewelry experience\nStone setting familiarity"} />
          </div>
          <div>
            <label className={label}>Status</label>
            <select className={input} value={form.status} onChange={set("status")}>
              <option value="open">Active — published to the public careers page</option>
              <option value="draft">Draft — not visible to applicants</option>
            </select>
          </div>
          {error && <div className="rounded-md border border-[#f2c2c2] bg-[#fff4f4] px-3 py-2 text-[13px] text-[#a32d2d]">{error}</div>}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} className="btn-outline px-4 py-2 text-[13px]">Cancel</button>
            <button onClick={submit} disabled={!canSubmit} className={`inline-flex items-center gap-1.5 px-4 py-2 text-[13px] ${canSubmit ? "btn-grad" : "rounded-full bg-[#c2cbe0] text-white cursor-not-allowed"}`}>
              <IconCheck size={15} /> {saving ? "Creating…" : "Create job"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [items, setItems] = useState<JobItem[]>([]);
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [locationFilter, setLocationFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const publishedCourses = LEGACY_COURSES.filter((course) => course.status === "Published").length;

  const loadJobs = useCallback(() => {
    const params = locationFilter ? `?locationId=${encodeURIComponent(locationFilter)}` : "";
    return fetch(`/api/stores/${STORE_ID}/jobs${params}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { items: JobItem[] }) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [locationFilter]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stores/${STORE_ID}/locations`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { items: StoreLocation[] }) => { if (!cancelled) setLocations(data.items || []); })
      .catch(() => { if (!cancelled) setLocations([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const active = useMemo(() => items.filter((i) => i.job.status === "open").length, [items]);
  const openings = useMemo(() => items.reduce((sum, i) => sum + i.job.openings, 0), [items]);
  const pipeline = useMemo(() => items.reduce((sum, i) => sum + i.kpis.activePipeline, 0), [items]);

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle="Create role profiles and openings. Active jobs publish to your public careers page for candidates to apply."
        action={
          <button onClick={() => setShowCreate(true)} className="btn-grad inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[12.5px]">
            <IconBriefcase size={15} /> New role profile
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-[18px]">
        <Stat label="Active roles" value={active} sub="Open for candidates" />
        <Stat label="Open seats" value={openings} sub="Across role profiles" />
        <Stat label="Pipeline" value={pipeline} sub="Candidates in active pipeline" />
        <Stat label="Reusable content" value={LEGACY_ASSESSMENTS.length + publishedCourses} sub="Assessments plus courses" />
      </div>

      {locations.length > 0 && (
        <div className="flex items-center gap-2 mb-[18px]">
          <span className="text-[12.5px] text-muted">Location</span>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="border border-line rounded-md px-3 py-2 text-[13px] text-body bg-panel outline-none focus:border-primary">
            <option value="">All locations ({locations.length})</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-[18px] items-start">
        <div className="space-y-[18px]">
          {loading ? (
            <Panel><div className="p-10 text-center text-muted text-sm">Loading jobs…</div></Panel>
          ) : items.length > 0 ? (
            items.map((item) => <ProfileCard key={item.job.id} item={item} />)
          ) : (
            <Panel>
              <EmptyState
                icon={<IconBriefcase size={20} />}
                title={locationFilter ? "No jobs for this location" : "No role profiles yet"}
                message={locationFilter ? "Try a different location, or create a role profile for this location." : "Create your first role profile to define its openings, requirements, and publish it to your public careers page."}
                action={<button onClick={() => setShowCreate(true)} className="btn-grad inline-flex items-center gap-1.5 px-4 py-2 text-[13px]"><IconBriefcase size={15} /> New role profile</button>}
              />
            </Panel>
          )}
        </div>

        <div className="space-y-[18px]">
          <Panel title="Role template rules">
            <div className="p-4 text-[12.5px] text-body leading-relaxed space-y-2">
              <p className="m-0">A v2 job is a role profile plus one or more active openings. Active jobs publish to your public careers page where candidates apply.</p>
              <p className="m-0">Openings should stay lightweight: store, seat count, hiring stage, and candidate pipeline.</p>
              <p className="m-0">Draft jobs stay private until you set them Active.</p>
            </div>
          </Panel>

          <Panel title="Quick actions">
            <div className="p-4 flex flex-col gap-2">
              {[
                { href: "/cert-invitations", label: "Send role assessment package", icon: <IconSend size={17} /> },
                { href: "/assessments", label: "Review assessment library", icon: <IconClipboardList size={17} /> },
                { href: "/learn", label: "Review course library", icon: <IconSchool size={17} /> },
              ].map((action) => (
                <Link key={action.label} href={action.href} className="flex items-center gap-2.5 px-3 py-2.5 border border-line rounded-md no-underline text-body text-[13px] hover:bg-rowhover hover:border-accent">
                  <span className="text-primary">{action.icon}</span>
                  {action.label}
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {showCreate && <CreateJobModal locations={locations} onClose={() => setShowCreate(false)} onCreated={loadJobs} />}
    </div>
  );
}
