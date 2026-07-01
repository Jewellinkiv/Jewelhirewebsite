"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { COURSES, courseStats, Course, CourseIcon } from "@/lib/training-center";
import {
  IconDiamond, IconTargetArrow, IconBulb, IconUser, IconUsersGroup,
  IconBriefcase, IconClock, IconPlayerPlay, IconCheck,
} from "@/components/icons";

function CourseIconEl({ icon, size = 30 }: { icon: CourseIcon; size?: number }) {
  const map = {
    platform: <IconDiamond size={size} />, sales: <IconTargetArrow size={size} />,
    product: <IconBulb size={size} />, service: <IconUser size={size} />,
    leadership: <IconUsersGroup size={size} />, ops: <IconBriefcase size={size} />,
  };
  return map[icon];
}

function Thumb({ c }: { c: Course }) {
  return (
    <div className="relative h-[148px] flex items-center justify-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${c.accent}, #0b1f3a)` }}>
      <span className="absolute -right-4 -bottom-5 opacity-20 text-white"><CourseIconEl icon={c.icon} size={120} /></span>
      <span className="absolute left-3 top-3 text-[11px] font-semibold text-white bg-white/20 backdrop-blur px-2.5 py-1 rounded-full">{c.category}</span>
      <span className="absolute right-3 top-3 text-[11px] font-medium text-white bg-black/25 px-2 py-1 rounded-full inline-flex items-center gap-1"><IconClock size={12} /> {c.durationLabel}</span>
      <span className="w-12 h-12 rounded-full bg-white/95 text-[#0b1f3a] flex items-center justify-center shadow-md z-10"><IconPlayerPlay size={20} /></span>
    </div>
  );
}

export default function LearnPage() {
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [courses, setCourses] = useState<Course[]>(COURSES);
  const list = tab === "mine" ? courses.filter((c) => c.progress > 0) : courses;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/courses")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Unable to load courses"))))
      .then((body) => {
        if (!cancelled) setCourses(body.items || COURSES);
      })
      .catch(() => {
        if (!cancelled) setCourses(COURSES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader title="Training Center" subtitle="Video courses to grow jewelry sales, product, and leadership skills. Completions show on your resume." />

      <div className="flex gap-1.5 mb-4">
        {([["all", "All courses"], ["mine", "My learning"]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} className={`text-[13px] px-3.5 py-2 rounded-md border ${tab === k ? "bg-[#e8f1ff] border-primary text-primary font-medium" : "bg-panel border-line text-body hover:bg-rowhover"}`}>{lbl}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
        {list.map((c) => {
          const st = courseStats(c);
          return (
            <Link key={c.slug} href={`/learn/${c.slug}`} className="bg-panel border border-line rounded-[10px] overflow-hidden no-underline hover:border-primary transition-colors group">
              <Thumb c={c} />
              <div className="p-4">
                <div className="text-[15px] font-bold text-head leading-snug">{c.title}</div>
                <div className="text-[12px] text-muted mt-1">By {c.instructor} · {st.total} lessons</div>
                <p className="text-[12.5px] text-body leading-relaxed mt-2 mb-3 line-clamp-2" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.blurb}</p>
                {c.progress > 0 ? (
                  <div>
                    <div className="flex items-center justify-between text-[11.5px] text-muted mb-1">
                      <span>{c.progress === 100 ? "Completed" : `${st.done}/${st.total} lessons`}</span><span>{c.progress}%</span>
                    </div>
                    <span className="block h-1.5 rounded-full bg-[#eef1f7] overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: `${c.progress}%`, background: c.progress === 100 ? "#1f9e75" : "#123FB9" }} />
                    </span>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-primary font-medium">Start course →</span>
                )}
                {c.progress === 100 && <span className="inline-flex items-center gap-1 text-[11.5px] text-[#0f6e56] font-medium mt-2"><IconCheck size={13} /> Badge earned</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
