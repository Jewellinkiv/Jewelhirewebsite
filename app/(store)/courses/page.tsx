"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel } from "@/components/ui";
import { CourseBadgeChip } from "@/components/CourseBadge";
import { IconPlus, IconSchool, IconCheck, IconX, IconDiamond } from "@/components/icons";
import { MODULE_TYPE_LABEL, type StoreCourse, type PublicCourse } from "@/lib/courses";

const STORE_ID = "store-sissys-little-rock";
const STATUS: Record<string, string> = { Published: "bg-[#e1f5ee] text-[#0f6e56]", Draft: "bg-[#fff4e2] text-[#9a6a12]" };

function moduleSummary(modules: { type: string }[]) {
  const counts = modules.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.type]: (acc[m.type] || 0) + 1 }), {});
  return (["video", "quiz", "upload"] as const).filter((t) => counts[t]).map((t) => `${counts[t]} ${MODULE_TYPE_LABEL[t].toLowerCase()}${counts[t] > 1 ? "s" : ""}`).join(" · ") || "No modules";
}

export default function StoreCoursesPage() {
  const [own, setOwn] = useState<StoreCourse[]>([]);
  const [library, setLibrary] = useState<PublicCourse[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOwn = () =>
    fetch(`/api/stores/${STORE_ID}/courses`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { items: StoreCourse[] }) => setOwn(d.items))
      .catch(() => setOwn([]));

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/stores/${STORE_ID}/courses`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(`/api/catalog/courses`).then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([mine, cat]) => {
        if (cancelled) return;
        setOwn(mine.items || []);
        setLibrary(cat.items || []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePublish = async (c: StoreCourse) => {
    setBusyId(c.id);
    const next = c.status === "Published" ? "Draft" : "Published";
    setOwn((list) => list.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    try {
      const r = await fetch(`/api/stores/${STORE_ID}/courses/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
      if (!r.ok) throw new Error();
    } catch {
      loadOwn();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: StoreCourse) => {
    if (!confirm(`Delete "${c.title}"? Learners will no longer see it.`)) return;
    setBusyId(c.id);
    setOwn((list) => list.filter((x) => x.id !== c.id));
    try {
      const r = await fetch(`/api/stores/${STORE_ID}/courses/${c.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
    } catch {
      loadOwn();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Courses"
        subtitle="Build courses for your store, or send the platform's default courses. Learners earn a badge on completion."
        action={<Link href="/courses/new" className="btn-grad inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] no-underline"><IconPlus size={16} /> Build course</Link>}
      />

      <Panel title="Your courses" icon={<IconSchool size={16} />} className="mb-[18px]" action={<Link href="/courses/new" className="text-[12.5px] text-primary no-underline">New</Link>}>
        {loaded && own.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted text-[13px]">No store courses yet. <Link href="/courses/new" className="text-primary no-underline">Build your first →</Link></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full border-collapse">
            <thead><tr>{["Course", "Badge", "Modules", "Status", ""].map((h) => <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>)}</tr></thead>
            <tbody>
              {own.map((c) => (
                <tr key={c.id} className="hover:bg-rowhover align-top">
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                    <div className="font-medium text-head">{c.title}</div>
                    <div className="text-[12px] text-muted mt-0.5 max-w-[360px]">{c.description}</div>
                  </td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><CourseBadgeChip label={c.badgeLabel} color={c.badgeColor} /></td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-body">{moduleSummary(c.modules)}</td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                    <button onClick={() => togglePublish(c)} disabled={busyId === c.id} title="Toggle published" className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full disabled:opacity-50 ${STATUS[c.status]}`}>{c.status === "Published" && <IconCheck size={11} />}{c.status}</button>
                  </td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] text-right">
                    <button onClick={() => remove(c)} disabled={busyId === c.id} className="text-muted hover:text-[#a32d2d] disabled:opacity-50 inline-flex items-center" title="Delete"><IconX size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Panel>

      <Panel title="Default library" icon={<IconDiamond size={16} />} action={<span className="text-[11.5px] text-muted">From JewelHire · available to send</span>}>
        {loaded && library.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted text-[13px]">No default courses available.</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full border-collapse">
            <thead><tr>{["Course", "Badge", "Modules"].map((h) => <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>)}</tr></thead>
            <tbody>
              {library.map((c) => (
                <tr key={c.id} className="hover:bg-rowhover align-top">
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><div className="font-medium text-head">{c.title}</div><div className="text-[12px] text-muted mt-0.5 max-w-[360px]">{c.description}</div></td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><CourseBadgeChip label={c.badgeLabel} color={c.badgeColor} /></td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-body">{moduleSummary(c.modules)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Panel>
    </div>
  );
}
