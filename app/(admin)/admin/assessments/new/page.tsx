"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";

const KINDS = ["Trait profile", "Aptitude", "Knowledge check"] as const;
type Kind = (typeof KINDS)[number];

export default function NewAdminAssessmentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("Trait profile");
  const [scope, setScope] = useState("All plans");
  const [questions, setQuestions] = useState("");
  const [status, setStatus] = useState<"Draft" | "Published">("Draft");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const valid = name.trim().length > 0;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/assessments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          kind,
          scope: scope.trim() || "All plans",
          questions: Number(questions) || 0,
          status,
          note: note.trim(),
        }),
      });
      if (!r.ok) throw new Error();
      router.push("/admin/assessments");
    } catch {
      setError("We couldn't save this default. Please try again.");
      setSaving(false);
    }
  };

  const field = "w-full border border-line rounded-md px-3 py-2 text-[13.5px] text-body bg-white focus:outline-none focus:border-primary";
  const label = "block text-[12.5px] font-medium text-head mb-1.5";

  return (
    <div className="max-w-[680px]">
      <Link href="/admin/assessments" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-body mb-3 no-underline"><IconChevronLeft size={14} /> Assessment library</Link>
      <h1 className="text-[21px] font-semibold text-head m-0">New default assessment</h1>
      <p className="mt-1 mb-[18px] text-muted text-[13px]">Create a default that every store can send or build on. Grading stays point-total, same as the seeded tests.</p>

      <Panel title="Details">
        <div className="p-4 flex flex-col gap-4">
          <div>
            <label className={label}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Watch Fundamentals" className={field} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Type</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={field}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Available to</label>
              <input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="All plans" className={field} />
            </div>
            <div>
              <label className={label}>Questions</label>
              <input value={questions} onChange={(e) => setQuestions(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="0" className={field} />
            </div>
            <div>
              <label className={label}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as "Draft" | "Published")} className={field}>
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
              </select>
            </div>
          </div>
          <div>
            <label className={label}>Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What this assessment measures and when to use it." className={`${field} resize-y`} />
          </div>
          {error ? <p className="m-0 text-[12.5px] text-red-600">{error}</p> : null}
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={!valid || saving} className={`px-4 py-2.5 text-[13px] inline-flex items-center justify-center rounded-full ${valid && !saving ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"}`}>{saving ? "Saving…" : "Create default"}</button>
            <Link href="/admin/assessments" className="px-4 py-2.5 text-[13px] text-muted no-underline hover:text-body">Cancel</Link>
          </div>
        </div>
      </Panel>
    </div>
  );
}
