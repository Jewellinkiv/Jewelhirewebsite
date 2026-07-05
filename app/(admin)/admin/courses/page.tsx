"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { CourseBadgeChip } from "@/components/CourseBadge";
import { IconSchool, IconPlus, IconCheck, IconX } from "@/components/icons";
import type { Course } from "@/lib/courses";
import { moduleSummary } from "@/lib/courses";

const STATUS: Record<string, string> = { Published: "bg-[#e1f5ee] text-[#0f6e56]", Draft: "bg-[#fff4e2] text-[#9a6a12]" };

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/admin/courses")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { items: Course[] }) => setCourses(d.items))
      .catch(() => setCourses([]))
      .finally(() => setLoaded(true));
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/courses")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { items: Course[] }) => {
        if (!cancelled) setCourses(d.items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePublish = async (c: Course) => {
    setBusyId(c.id);
    const next = c.status === "Published" ? "Draft" : "Published";
    setCourses((list) => list.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    try {
      const r = await fetch(`/api/admin/courses/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
      if (!r.ok) throw new Error();
    } catch {
      load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: Course) => {
    if (!confirm(`Delete "${c.title}"? Learners will no longer see it.`)) return;
    setBusyId(c.id);
    setCourses((list) => list.filter((x) => x.id !== c.id));
    try {
      const r = await fetch(`/api/admin/courses/${c.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
    } catch {
      load();
    } finally {
      setBusyId(null);
    }
  };


  return (
    <div>
      <div className="flex items-end justify-between mb-[18px]">
        <div>
          <h1 className="text-[21px] font-semibold text-head m-0">Courses</h1>
          <p className="mt-1 mb-0 text-muted text-[13px]">Build courses from video, quiz, and upload modules. Learners earn a badge on completion.</p>
        </div>
        <Link href="/admin/courses/new" className="btn-grad inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] no-underline"><IconPlus size={16} /> New course</Link>
      </div>

      <Panel title="All courses" icon={<IconSchool size={16} />}>
        {loaded && courses.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted text-[13px]">No courses yet. <Link href="/admin/courses/new" className="text-primary no-underline">Build your first →</Link></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full border-collapse">
            <thead><tr>{["Course", "Badge", "Modules", "Status", "Enrolled", "Completed", ""].map((h) => <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>)}</tr></thead>
            <tbody>
              {courses.map((c) => (
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
                  {/* Enrolled / Completed are admin-only metrics — never sent to stores or learners. */}
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] text-body">{c.enrollments}</td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] text-body">{c.completions}</td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] text-right">
                    <button onClick={() => remove(c)} disabled={busyId === c.id} className="text-muted hover:text-[#a32d2d] disabled:opacity-50 inline-flex items-center" title="Delete"><IconX size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Panel>
    </div>
  );
}
