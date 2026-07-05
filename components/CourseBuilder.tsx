"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui";
import { IconChevronLeft, IconPlus, IconX, IconPlayerPlay, IconClipboardList, IconFileText } from "@/components/icons";
import type { ModuleType } from "@/lib/courses";

type DraftQuestion = { prompt: string; options: string[]; answerIndex: number };
type DraftModule = {
  type: ModuleType;
  title: string;
  videoUrl: string;
  instructions: string;
  questions: DraftQuestion[];
  passingCount: number;
};

const field = "w-full border border-line rounded-md px-3 py-2 text-[13.5px] text-body bg-white focus:outline-none focus:border-primary";
const labelCls = "block text-[12.5px] font-medium text-head mb-1.5";

const MODULE_META: Record<ModuleType, { label: string; icon: React.ReactNode; blurb: string }> = {
  video: { label: "Video", icon: <IconPlayerPlay size={15} />, blurb: "A video to watch." },
  quiz: { label: "Quiz", icon: <IconClipboardList size={15} />, blurb: "Questions the learner must pass." },
  upload: { label: "Upload", icon: <IconFileText size={15} />, blurb: "The learner submits a file." },
};

function newModule(type: ModuleType): DraftModule {
  return {
    type,
    title: "",
    videoUrl: "",
    instructions: "",
    questions: type === "quiz" ? [{ prompt: "", options: ["", ""], answerIndex: 0 }] : [],
    passingCount: 1,
  };
}

// Shared course builder used by both admin (global courses) and store owners
// (org-specific courses). `endpoint` is where the course is POSTed.
export function CourseBuilder({
  endpoint,
  backHref,
  redirectTo,
  heading = "New course",
  subheading = "Add modules in the order learners should complete them. Finishing every module earns the badge.",
}: {
  endpoint: string;
  backHref: string;
  redirectTo: string;
  heading?: string;
  subheading?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [badgeLabel, setBadgeLabel] = useState("");
  const [modules, setModules] = useState<DraftModule[]>([newModule("video")]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const valid = title.trim().length > 0 && modules.length > 0 && modules.every((m) => m.title.trim().length > 0);

  const patchModule = (i: number, patch: Partial<DraftModule>) => setModules((list) => list.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const addModule = (type: ModuleType) => setModules((list) => [...list, newModule(type)]);
  const removeModule = (i: number) => setModules((list) => list.filter((_, idx) => idx !== i));

  const patchQuestion = (mi: number, qi: number, patch: Partial<DraftQuestion>) =>
    setModules((list) => list.map((m, idx) => (idx === mi ? { ...m, questions: m.questions.map((q, j) => (j === qi ? { ...q, ...patch } : q)) } : m)));
  const addQuestion = (mi: number) =>
    setModules((list) => list.map((m, idx) => (idx === mi ? { ...m, questions: [...m.questions, { prompt: "", options: ["", ""], answerIndex: 0 }] } : m)));
  const removeQuestion = (mi: number, qi: number) =>
    setModules((list) => list.map((m, idx) => (idx === mi ? { ...m, questions: m.questions.filter((_, j) => j !== qi) } : m)));

  const save = async (status: "Draft" | "Published") => {
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        badgeLabel: badgeLabel.trim(),
        status,
        modules: modules.map((m) => ({
          type: m.type,
          title: m.title.trim(),
          videoUrl: m.type === "video" ? m.videoUrl.trim() : undefined,
          instructions: m.type === "upload" ? m.instructions.trim() : undefined,
          questions: m.type === "quiz" ? m.questions.map((q) => ({ prompt: q.prompt.trim(), options: q.options.map((o) => o.trim()), answerIndex: q.answerIndex })) : undefined,
          passingCount: m.type === "quiz" ? m.passingCount : undefined,
        })),
      };
      const r = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error();
      router.push(redirectTo);
    } catch {
      setError("We couldn't save this course. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[760px]">
      <Link href={backHref} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-body mb-3 no-underline"><IconChevronLeft size={14} /> Courses</Link>
      <h1 className="text-[21px] font-semibold text-head m-0">{heading}</h1>
      <p className="mt-1 mb-[18px] text-muted text-[13px]">{subheading}</p>

      <Panel title="Course" className="mb-[18px]">
        <div className="p-4 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Watch Fundamentals" className={field} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What this course covers." className={`${field} resize-y`} />
          </div>
          <div>
            <label className={labelCls}>Badge name <span className="text-muted font-normal">(optional — defaults to the course title)</span></label>
            <input value={badgeLabel} onChange={(e) => setBadgeLabel(e.target.value)} placeholder="e.g. Watch Specialist" className={field} />
          </div>
        </div>
      </Panel>

      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[15px] font-semibold text-head m-0">Modules ({modules.length})</h2>
      </div>

      <div className="flex flex-col gap-3">
        {modules.map((m, i) => (
          <div key={i} className="bg-panel border border-line rounded-lg">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
              <span className="w-7 h-7 rounded-md bg-[#e8f1ff] text-primary flex items-center justify-center">{MODULE_META[m.type].icon}</span>
              <span className="text-[12.5px] font-semibold text-head">{MODULE_META[m.type].label}</span>
              <span className="text-[11.5px] text-muted">· module {i + 1}</span>
              <button onClick={() => removeModule(i)} className="ml-auto text-muted hover:text-[#a32d2d]" title="Remove module"><IconX size={16} /></button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div>
                <label className={labelCls}>Module title</label>
                <input value={m.title} onChange={(e) => patchModule(i, { title: e.target.value })} placeholder={MODULE_META[m.type].blurb} className={field} />
              </div>

              {m.type === "video" && (
                <div>
                  <label className={labelCls}>Video URL</label>
                  <input value={m.videoUrl} onChange={(e) => patchModule(i, { videoUrl: e.target.value })} placeholder="https://…" className={field} />
                </div>
              )}

              {m.type === "upload" && (
                <div>
                  <label className={labelCls}>What should they upload?</label>
                  <input value={m.instructions} onChange={(e) => patchModule(i, { instructions: e.target.value })} placeholder="e.g. A photo of your merchandised case" className={field} />
                </div>
              )}

              {m.type === "quiz" && (
                <div className="flex flex-col gap-3">
                  {m.questions.map((q, qi) => (
                    <div key={qi} className="border border-line rounded-md p-3 bg-[#fafbfe]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11.5px] font-semibold text-muted">Question {qi + 1}</span>
                        {m.questions.length > 1 && <button onClick={() => removeQuestion(i, qi)} className="ml-auto text-muted hover:text-[#a32d2d]" title="Remove question"><IconX size={14} /></button>}
                      </div>
                      <input value={q.prompt} onChange={(e) => patchQuestion(i, qi, { prompt: e.target.value })} placeholder="Question prompt" className={`${field} mb-2`} />
                      <div className="flex flex-col gap-1.5">
                        {q.options.map((opt, oi) => (
                          <label key={oi} className="flex items-center gap-2">
                            <input type="radio" name={`m${i}q${qi}`} checked={q.answerIndex === oi} onChange={() => patchQuestion(i, qi, { answerIndex: oi })} title="Correct answer" />
                            <input value={opt} onChange={(e) => patchQuestion(i, qi, { options: q.options.map((o, idx) => (idx === oi ? e.target.value : o)) })} placeholder={`Option ${oi + 1}`} className={`${field} flex-1`} />
                            {q.options.length > 2 && <button onClick={() => patchQuestion(i, qi, { options: q.options.filter((_, idx) => idx !== oi), answerIndex: 0 })} className="text-muted hover:text-[#a32d2d]" title="Remove option"><IconX size={13} /></button>}
                          </label>
                        ))}
                      </div>
                      <button onClick={() => patchQuestion(i, qi, { options: [...q.options, ""] })} className="mt-2 text-[12px] text-primary inline-flex items-center gap-1"><IconPlus size={12} /> Add option</button>
                      <div className="text-[11px] text-muted mt-1.5">Select the radio next to the correct answer.</div>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <button onClick={() => addQuestion(i)} className="text-[12.5px] text-primary inline-flex items-center gap-1"><IconPlus size={13} /> Add question</button>
                    <label className="text-[12px] text-muted ml-auto flex items-center gap-1.5">Pass with
                      <input type="number" min={1} max={m.questions.length} value={m.passingCount} onChange={(e) => patchModule(i, { passingCount: Math.max(1, Math.min(m.questions.length, Number(e.target.value) || 1)) })} className="w-14 border border-line rounded px-2 py-1 text-[12.5px]" />
                      of {m.questions.length} correct
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-[12px] text-muted mr-1">Add module:</span>
        {(["video", "quiz", "upload"] as const).map((t) => (
          <button key={t} onClick={() => addModule(t)} className="inline-flex items-center gap-1.5 text-[12.5px] text-body border border-line rounded-full px-3 py-1.5 hover:bg-rowhover">
            {MODULE_META[t].icon} {MODULE_META[t].label}
          </button>
        ))}
      </div>

      {error ? <p className="m-0 mt-4 text-[12.5px] text-red-600">{error}</p> : null}

      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-line">
        <button onClick={() => save("Published")} disabled={!valid || saving} className={`px-4 py-2.5 text-[13px] inline-flex items-center justify-center rounded-full ${valid && !saving ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"}`}>{saving ? "Saving…" : "Publish course"}</button>
        <button onClick={() => save("Draft")} disabled={!valid || saving} className="px-4 py-2.5 text-[13px] rounded-full border border-line text-body hover:bg-rowhover disabled:opacity-50">Save as draft</button>
        <Link href={backHref} className="px-4 py-2.5 text-[13px] text-muted no-underline hover:text-body">Cancel</Link>
      </div>
    </div>
  );
}
