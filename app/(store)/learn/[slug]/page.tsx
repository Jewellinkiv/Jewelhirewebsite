"use client";

import { useMemo, useState, use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse, courseStats, CourseIcon, Lesson } from "@/lib/training-center";
import {
  IconPlayerPlay, IconCheck, IconClock, IconFileText, IconClipboardList,
  IconCertificate, IconChevronLeft, IconDiamond, IconTargetArrow, IconBulb,
  IconUser, IconUsersGroup, IconBriefcase,
} from "@/components/icons";

function CourseIconEl({ icon, size = 30 }: { icon: CourseIcon; size?: number }) {
  const map = {
    platform: <IconDiamond size={size} />,
    sales: <IconTargetArrow size={size} />,
    product: <IconBulb size={size} />,
    service: <IconUser size={size} />,
    leadership: <IconUsersGroup size={size} />,
    ops: <IconBriefcase size={size} />,
  };
  return map[icon];
}

function LessonTypeIcon({ type, size = 14 }: { type: Lesson["type"]; size?: number }) {
  if (type === "Reading") return <IconFileText size={size} />;
  if (type === "Quiz") return <IconClipboardList size={size} />;
  return <IconPlayerPlay size={size} />;
}

export default function CoursePlayer(props: { params: Promise<{ slug: string }> }) {
  const params = use(props.params);
  const course = getCourse(params.slug);
  if (!course) notFound();

  const flat = useMemo(() => course.modules.flatMap((m) => m.lessons), [course]);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set(flat.filter((l) => l.completed).map((l) => l.id)));
  const firstIncomplete = flat.find((l) => !doneIds.has(l.id)) ?? flat[0];
  const [currentId, setCurrentId] = useState(firstIncomplete.id);
  const current = flat.find((l) => l.id === currentId) ?? flat[0];

  const st = courseStats(course);
  const pct = Math.round((doneIds.size / flat.length) * 100);
  const idx = flat.findIndex((l) => l.id === currentId);

  const complete = () => {
    setDoneIds((s) => new Set(s).add(currentId));
    const next = flat[idx + 1];
    if (next) setCurrentId(next.id);
  };

  return (
    <div>
      <div className="text-[12.5px] text-muted mb-3.5">
        <Link href="/learn" className="text-primary no-underline">Training Center</Link> / {course.title}
      </div>

      {/* header */}
      <div className="flex flex-wrap items-center gap-4 bg-panel border border-line rounded px-[18px] py-4 mb-4">
        <span className="w-12 h-12 rounded-[10px] flex items-center justify-center text-white" style={{ background: `linear-gradient(135deg, ${course.accent}, #0b1f3a)` }}><CourseIconEl icon={course.icon} size={24} /></span>
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold text-head m-0">{course.title}</h1>
          <div className="text-[13px] text-muted mt-0.5 flex flex-wrap items-center gap-2">
            {course.category} · By {course.instructor} · <span className="inline-flex items-center gap-1"><IconClock size={14} /> {course.durationLabel}</span>
          </div>
        </div>
        <div className="ml-auto text-right min-w-[150px]">
          <div className="text-[12px] text-muted mb-1">{pct === 100 ? "Completed" : `${doneIds.size}/${flat.length} lessons`}</div>
          <span className="block h-1.5 w-[150px] rounded-full bg-[#eef1f7] overflow-hidden ml-auto">
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? "#1f9e75" : "#123FB9" }} />
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_330px] gap-4 items-start">
        {/* main: player + content */}
        <div>
          {/* video */}
          <div className="relative rounded-[12px] overflow-hidden mb-4" style={{ background: "#0e1424", aspectRatio: "16/9" }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 gap-3">
              <button className="w-16 h-16 rounded-full bg-white text-[#0b1f3a] flex items-center justify-center shadow-lg hover:scale-105 transition-transform"><IconPlayerPlay size={26} /></button>
              <span className="text-[13px] text-white/70">{current.title}</span>
            </div>
            <div className="absolute left-4 bottom-4 text-[12px] text-white/60">Lesson {idx + 1} of {flat.length}</div>
          </div>

          {/* current lesson + actions */}
          <div className="bg-panel border border-line rounded p-4 mb-4 flex flex-wrap items-center gap-3">
            <div>
              <div className="text-[15px] font-bold text-head">{current.title}</div>
              <div className="text-[12px] text-muted mt-0.5 inline-flex items-center gap-1.5"><LessonTypeIcon type={current.type} /> {current.type} · {current.durationMin} min</div>
            </div>
            <div className="ml-auto flex gap-2">
              {idx > 0 && <button onClick={() => setCurrentId(flat[idx - 1].id)} className="btn-outline px-3.5 py-2 text-[13px] inline-flex items-center gap-1"><IconChevronLeft size={15} /> Prev</button>}
              {doneIds.has(currentId)
                ? <button onClick={() => { const n = flat[idx + 1]; if (n) setCurrentId(n.id); }} className="btn-grad px-4 py-2 text-[13px]" disabled={idx === flat.length - 1}>Next lesson</button>
                : <button onClick={complete} className="btn-grad px-4 py-2 text-[13px] inline-flex items-center gap-1.5"><IconCheck size={15} /> Mark complete</button>}
            </div>
          </div>

          {/* about */}
          <div className="bg-panel border border-line rounded p-5 mb-4">
            <h3 className="text-[14px] font-semibold text-head m-0 mb-2">About this course</h3>
            <p className="text-[13.5px] text-body leading-relaxed m-0 mb-4">{course.blurb}</p>
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted m-0 mb-2">Skills you'll learn</h4>
            <div className="flex flex-wrap gap-2">
              {course.skills.map((s) => <span key={s} className="text-[12.5px] bg-[#eef4ff] text-primary px-2.5 py-1 rounded-full">{s}</span>)}
            </div>
          </div>

          {/* certificate */}
          <div className="flex items-center gap-3 border border-[#cfe0fb] bg-[#eef4ff] rounded p-4">
            <span className="w-10 h-10 rounded-full bg-white text-primary flex items-center justify-center"><IconCertificate size={20} /></span>
            <div>
              <div className="text-[13px] font-semibold text-head">Certificate</div>
              <div className="text-[12.5px] text-body">{course.certificate}</div>
            </div>
            {pct === 100 && <span className="ml-auto text-[12px] font-semibold text-[#0f6e56] inline-flex items-center gap-1"><IconCheck size={14} /> Earned</span>}
          </div>
        </div>

        {/* curriculum */}
        <div className="bg-panel border border-line rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-head m-0">Course content</h3>
            <span className="text-[11.5px] text-muted">{st.mins} min</span>
          </div>
          <div className="max-h-[640px] overflow-y-auto">
            {course.modules.map((m, mi) => (
              <div key={mi}>
                <div className="px-4 py-2.5 bg-page text-[12px] font-semibold text-head border-b border-[#eef1f6]">{m.title}</div>
                {m.lessons.map((l) => {
                  const done = doneIds.has(l.id);
                  const active = l.id === currentId;
                  return (
                    <button key={l.id} onClick={() => setCurrentId(l.id)} className={`w-full text-left flex items-center gap-2.5 px-4 py-2.5 border-b border-[#eef1f6] ${active ? "bg-[#eef4ff]" : "hover:bg-rowhover"}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-[#e1f5ee] text-[#0f6e56]" : active ? "bg-primary text-white" : "border border-line text-muted"}`}>
                        {done ? <IconCheck size={12} /> : <LessonTypeIcon type={l.type} size={11} />}
                      </span>
                      <span className={`text-[13px] min-w-0 flex-1 ${active ? "text-head font-medium" : "text-body"}`}>{l.title}</span>
                      <span className="text-[11px] text-muted whitespace-nowrap">{l.durationMin}m</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
