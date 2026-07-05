"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CourseBadge } from "@/components/CourseBadge";
import { IconCheck, IconChevronLeft, IconPlayerPlay, IconClipboardList, IconFileText } from "@/components/icons";
import type { PublicCourse, PublicCourseModule, ModuleType } from "@/lib/courses";

const ICON: Record<ModuleType, React.ReactNode> = {
  video: <IconPlayerPlay size={15} />,
  quiz: <IconClipboardList size={15} />,
  upload: <IconFileText size={15} />,
};

interface CompletionBadge {
  label: string;
  color: string;
  courseTitle: string;
  earnedOn: string;
}

export default function CourseTakePage() {
  const params = useParams();
  const courseId = String(params.id || "");
  const [course, setCourse] = useState<PublicCourse | null>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "notfound">("loading");
  const [done, setDone] = useState<Record<string, boolean>>({}); // video/upload modules
  const [answers, setAnswers] = useState<Record<string, number[]>>({}); // quiz: moduleId -> per-question option index
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [failedQuizzes, setFailedQuizzes] = useState<string[]>([]);
  const [badge, setBadge] = useState<CompletionBadge | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/catalog/courses/${courseId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { course: PublicCourse }) => {
        if (!cancelled) {
          setCourse(d.course);
          setLoad("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setLoad("notfound");
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const setAnswer = (moduleId: string, qi: number, oi: number) =>
    setAnswers((a) => {
      const next = [...(a[moduleId] || [])];
      next[qi] = oi;
      return { ...a, [moduleId]: next };
    });

  const moduleComplete = (m: PublicCourseModule): boolean => {
    if (m.type === "quiz") {
      const a = answers[m.id] || [];
      return (m.questions || []).every((_, qi) => typeof a[qi] === "number");
    }
    return Boolean(done[m.id]);
  };

  const allComplete = course?.modules.every(moduleComplete) ?? false;

  const finish = async () => {
    if (!allComplete || !course) return;
    setSubmitting(true);
    setError("");
    setFailedQuizzes([]);
    try {
      const r = await fetch(`/api/catalog/courses/${course.id}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quizAnswers: answers }),
      });
      if (!r.ok) throw new Error();
      const result = await r.json();
      if (result.passed && result.badge) {
        setBadge(result.badge);
      } else {
        setFailedQuizzes((result.quiz || []).filter((q: { passed: boolean }) => !q.passed).map((q: { moduleId: string }) => q.moduleId));
      }
    } catch {
      setError("We couldn't record your completion. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (load === "loading") {
    return <div className="flex-1 flex items-center justify-center py-16 text-[13px] text-muted">Loading course…</div>;
  }
  if (load === "notfound" || !course) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center max-w-[360px]">
          <div className="text-[15px] font-semibold text-head">We couldn&apos;t find this course</div>
          <p className="mt-1.5 text-[13px] text-muted">It may have been unpublished. Head back to your training to see what&apos;s available.</p>
          <Link href="/portal/training" className="btn-grad inline-flex items-center gap-1.5 mt-4 px-4 py-2.5 text-[13px] no-underline">Back to training</Link>
        </div>
      </div>
    );
  }

  // ---- Earned badge --------------------------------------------------------
  if (badge) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="text-center max-w-[420px]">
          <div className="text-[12px] font-medium text-primary uppercase tracking-wide mb-4">Course complete</div>
          <div className="flex justify-center mb-4"><CourseBadge label={badge.label} color={badge.color} earnedOn={badge.earnedOn} size="lg" /></div>
          <h1 className="m-0 text-[20px] font-semibold text-head">You earned the {badge.label} badge</h1>
          <p className="mt-2 text-[13.5px] text-muted">Nice work finishing {badge.courseTitle}. This badge is now on your profile.</p>
          <Link href="/portal/training" className="btn-grad inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 text-[13.5px] no-underline">Back to training</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-6">
      <Link href="/portal/training" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-body mb-3 no-underline"><IconChevronLeft size={14} /> Training</Link>
      <div className="mb-1 text-[12px] font-medium text-primary uppercase tracking-wide">Course</div>
      <h1 className="m-0 text-[22px] sm:text-[24px] font-semibold text-head leading-tight">{course.title}</h1>
      {course.description ? <p className="mt-2 text-[14px] text-body">{course.description}</p> : null}

      <div className="mt-5 flex flex-col gap-3">
        {course.modules.map((m, i) => {
          const complete = moduleComplete(m);
          const failed = failedQuizzes.includes(m.id);
          return (
            <div key={m.id} className={`bg-white border rounded-lg ${failed ? "border-[#f0b4b4]" : "border-line"}`}>
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#eef1f6]">
                <span className={`w-7 h-7 rounded-md flex items-center justify-center ${complete ? "bg-[#e1f5ee] text-[#0f6e56]" : "bg-[#e8f1ff] text-primary"}`}>{complete ? <IconCheck size={15} /> : ICON[m.type]}</span>
                <span className="text-[13.5px] font-semibold text-head">{m.title}</span>
                <span className="ml-auto text-[11px] text-muted">Step {i + 1} of {course.modules.length}</span>
              </div>
              <div className="p-4">
                {m.type === "video" && (
                  <div>
                    <div className="rounded-md bg-[#0d1b3e] text-white/80 h-[150px] flex items-center justify-center text-[12.5px]">
                      {m.videoUrl ? <span className="text-[12px] break-all px-4">▶ {m.videoUrl}</span> : "▶ Video"}
                    </div>
                    <button onClick={() => setDone((d) => ({ ...d, [m.id]: !d[m.id] }))} className={`mt-3 px-4 py-2 text-[12.5px] rounded-full ${done[m.id] ? "bg-[#e1f5ee] text-[#0f6e56] font-medium" : "btn-grad"}`}>{done[m.id] ? "✓ Watched" : "Mark as watched"}</button>
                  </div>
                )}

                {m.type === "upload" && (
                  <div>
                    {m.instructions ? <p className="m-0 mb-2.5 text-[13px] text-body">{m.instructions}</p> : null}
                    <label className="inline-flex items-center gap-2 text-[12.5px] text-body border border-dashed border-line rounded-md px-4 py-3 cursor-pointer hover:bg-rowhover">
                      <IconFileText size={15} />
                      <span>{done[m.id] ? "File attached ✓" : "Choose a file to upload"}</span>
                      <input type="file" className="hidden" onChange={(e) => setDone((d) => ({ ...d, [m.id]: e.target.files ? e.target.files.length > 0 : false }))} />
                    </label>
                  </div>
                )}

                {m.type === "quiz" && (
                  <div className="flex flex-col gap-4">
                    {(m.questions || []).map((q, qi) => (
                      <div key={q.id}>
                        <div className="text-[13px] font-medium text-head mb-1.5">{qi + 1}. {q.prompt}</div>
                        <div className="flex flex-col gap-1.5">
                          {q.options.map((opt, oi) => {
                            const selected = (answers[m.id] || [])[qi] === oi;
                            return (
                              <button key={oi} onClick={() => setAnswer(m.id, qi, oi)} className={`text-left text-[13px] rounded-md border px-3 py-2 ${selected ? "bg-primary text-white border-transparent" : "bg-white border-line text-body hover:bg-rowhover"}`}>{opt}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {failed ? <p className="m-0 text-[12.5px] text-[#a32d2d]">Not quite — review your answers and try again.</p> : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] mt-4 bg-page/95 backdrop-blur border-t border-line">
        {error ? <p className="m-0 mb-2 text-[12.5px] text-red-600 text-center">{error}</p> : null}
        <button onClick={finish} disabled={!allComplete || submitting} className={`w-full py-3.5 text-[15px] inline-flex items-center justify-center gap-2 rounded-full ${allComplete && !submitting ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"}`}>
          {submitting ? "Finishing…" : allComplete ? "Finish & earn badge" : "Complete every step to finish"}
        </button>
      </div>
    </div>
  );
}
