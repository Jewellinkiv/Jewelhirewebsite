"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/states";
import { CourseBadge } from "@/components/CourseBadge";
import { TrainingAssignment } from "@/lib/associate-portal";
import type { EarnedBadge, PublicCourse } from "@/lib/courses";
import { IconSchool, IconCheck, IconPlayerPlay, IconCertificate, IconChevronRight, IconDiamond } from "@/components/icons";

const STATUS_STYLE: Record<string, string> = {
  "Not started": "bg-[#eef2f7] text-[#5b6472]",
  "In progress": "bg-[#e8f1ff] text-primary",
  Completed: "bg-[#e1f5ee] text-[#0f6e56]",
};

export default function PortalTrainingPage() {
  const [items, setItems] = useState<TrainingAssignment[]>([]);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [courses, setCourses] = useState<PublicCourse[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/applicant/training")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Unable to load training"))))
      .then((body) => {
        if (!cancelled) {
          setItems(body.items || []);
          setStatus("loaded");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    // Earned course badges + the courses available to browse by default.
    fetch("/api/applicant/badges")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b) => !cancelled && setBadges(b.items || []))
      .catch(() => undefined);
    fetch("/api/catalog/courses")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((c) => !cancelled && setCourses(c.items || []))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const advance = (assignment: TrainingAssignment) => {
    const progress = assignment.status === "Not started" ? 10 : 100;
    fetch(`/api/course-assignments/${assignment.id}/progress`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ progress }),
    }).catch(() => undefined);
    setItems((current) =>
      current.map((item) =>
        item.id === assignment.id
          ? {
              ...item,
              progress,
              status: progress >= 100 ? "Completed" : "In progress",
              credentialed: progress >= 100,
            }
          : item,
      ),
    );
  };

  const packages = Array.from(new Set(items.map((t) => t.package)));
  const credentials = items.filter((t) => t.credentialed);

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-head m-0">Training</h1>
      <p className="mt-1 mb-5 text-muted text-[13.5px]">Courses assigned to you. Finishing one adds a credential to your resume.</p>

      {status === "loading" && (
        <div className="mb-[18px] flex flex-col gap-[18px]"><SkeletonCard /><SkeletonCard /></div>
      )}

      {status === "error" && (
        <Panel className="mb-[18px]"><ErrorState message="We couldn't load your training — please refresh." /></Panel>
      )}

      {status === "loaded" && packages.length === 0 && (
        <Panel className="mb-[18px]">
          <EmptyState icon={<IconSchool size={20} />} title="No training assigned yet" message="When a store assigns you a course or training package, it appears here — and finishing one adds a credential to your resume." />
        </Panel>
      )}

      {status === "loaded" && packages.map((pkg) => (
        <Panel key={pkg} title={pkg} icon={<IconSchool size={16} />} className="mb-[18px]">
          <div className="divide-y divide-[#eef1f6]">
            {items.filter((t) => t.package === pkg).map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="w-9 h-9 rounded-md bg-[#e8f1ff] text-primary flex items-center justify-center">
                  {t.status === "Completed" ? <IconCheck size={16} /> : <IconPlayerPlay size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-head">{t.course}</span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                  </div>
                  <div className="text-[12px] text-muted">{t.lessons} lessons · assigned by {t.assignedBy}</div>
                  <div className="mt-1.5 h-1.5 bg-[#eef1f7] rounded-full overflow-hidden max-w-[280px]">
                    <span className="block h-full bg-primary" style={{ width: `${t.progress}%` }} />
                  </div>
                </div>
                <Link href="/learn" onClick={() => advance(t)} className="btn-outline inline-flex items-center gap-1 px-3 py-1.5 text-[12.5px] no-underline">
                  {t.status === "Completed" ? "Review" : t.status === "In progress" ? "Continue" : "Start"} <IconChevronRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </Panel>
      ))}

      {badges.length > 0 && (
        <Panel title={`Badges earned (${badges.length})`} icon={<IconCertificate size={16} />} className="mb-[18px]">
          <div className="p-5 flex flex-wrap gap-6">
            {badges.map((b) => (
              <CourseBadge key={b.courseId} label={b.badgeLabel} color={b.badgeColor} earnedOn={b.earnedOn} />
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Available courses" icon={<IconSchool size={16} />} className="mb-[18px]">
        {courses.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted text-[13px]">No courses available to browse yet.</div>
        ) : (
          <div className="divide-y divide-[#eef1f6]">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="w-9 h-9 rounded-md bg-[#e8f1ff] text-primary flex items-center justify-center"><IconDiamond size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-head">{c.title}</div>
                  <div className="text-[12px] text-muted">{c.moduleCount} module{c.moduleCount === 1 ? "" : "s"} · earn the {c.badgeLabel} badge</div>
                </div>
                <Link href={`/course/${c.id}`} className="btn-outline inline-flex items-center gap-1 px-3 py-1.5 text-[12.5px] no-underline">Start <IconChevronRight size={14} /></Link>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {status !== "error" && (
      <Panel title={`Credentials earned (${credentials.length})`} icon={<IconCertificate size={16} />}>
        {credentials.length > 0 ? (
          <div className="p-4 flex flex-wrap gap-2">
            {credentials.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 text-[12.5px] bg-[#e1f5ee] text-[#0f6e56] px-3 py-1.5 rounded-full"><IconCertificate size={14} /> {c.course}</span>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-muted text-[13px]">Complete a course to earn your first credential.</div>
        )}
      </Panel>
      )}
    </div>
  );
}
