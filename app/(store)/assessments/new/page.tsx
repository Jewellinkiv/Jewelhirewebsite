"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel } from "@/components/ui";
import { AssessmentKind, QuestionType, AssessmentQuestion, QUESTION_TYPE_LABEL } from "@/lib/custom-assessments";
import { IconPlus, IconX, IconCheck, IconChevronLeft, IconClipboardList } from "@/components/icons";
import { useActiveStoreId } from "@/lib/client-session";

const KINDS: AssessmentKind[] = ["Knowledge check", "Trait profile", "Skills check"];
const input = "border border-line rounded-md px-3 py-2 text-[13px] text-body outline-none focus:border-primary bg-white w-full";

export default function NewAssessmentPage() {
  const STORE_ID = useActiveStoreId("store-sissys-little-rock");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<AssessmentKind>("Knowledge check");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [notice, setNotice] = useState("");

  // new-question composer
  const [qType, setQType] = useState<QuestionType>("multiple-choice");
  const [qPrompt, setQPrompt] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [answerIndex, setAnswerIndex] = useState(0);

  const resetComposer = () => { setQPrompt(""); setOptions(["", ""]); setAnswerIndex(0); };

  const addQuestion = () => {
    if (!qPrompt.trim()) return;
    const q: AssessmentQuestion = { id: `q${Date.now()}`, type: qType, prompt: qPrompt.trim() };
    if (qType === "multiple-choice") {
      const opts = options.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) return;
      q.options = opts;
      q.answerIndex = Math.min(answerIndex, opts.length - 1);
    }
    setQuestions((qs) => [...qs, q]);
    resetComposer();
  };

  const removeQuestion = (id: string) => setQuestions((qs) => qs.filter((q) => q.id !== id));

  const save = async (status: "Draft" | "Published") => {
    if (!title.trim() || questions.length === 0) {
      setNotice("Add a title and at least one question first.");
      return;
    }
    const response = await fetch(`/api/stores/${STORE_ID}/assessments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description,
        kind,
        questions,
        status,
      }),
    });
    if (!response.ok) {
      setNotice("Assessment could not be saved locally.");
      return;
    }
    const body = await response.json() as { assessment: { title: string; status: "Draft" | "Published"; questions: AssessmentQuestion[] } };
    setNotice(`"${body.assessment.title}" saved as ${body.assessment.status.toLowerCase()} with ${body.assessment.questions.length} question${body.assessment.questions.length === 1 ? "" : "s"}. It's now available when sending a JewelCert.`);
  };

  return (
    <div className="max-w-[940px]">
      <Link href="/assessments" className="inline-flex items-center gap-1 text-[12.5px] text-muted no-underline hover:text-primary mb-2"><IconChevronLeft size={15} /> Assessments</Link>
      <PageHeader title="Build an assessment" subtitle="Create your own assessment alongside the default JewelCert and admin tests." />

      {notice && (
        <div className="mb-4 flex items-center gap-2 bg-[#e8f1ff] border border-[#cfe0fb] text-primary rounded-md px-3.5 py-2.5 text-[13px]">
          <IconCheck size={15} /> {notice}
          <button onClick={() => setNotice("")} className="ml-auto text-primary/70 hover:text-primary"><IconX size={15} /></button>
        </div>
      )}

      <Panel title="Details" className="mb-[18px]">
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3">
            <div className="flex flex-col">
              <label className="text-[11.5px] font-medium text-head mb-1">Title</label>
              <input className={input} placeholder="e.g. Repair intake basics" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-[11.5px] font-medium text-head mb-1">Type</label>
              <select className={input} value={kind} onChange={(e) => setKind(e.target.value as AssessmentKind)}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-[11.5px] font-medium text-head mb-1">Description</label>
            <input className={input} placeholder="What this assessment measures and who it's for." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] items-start">
        {/* composer */}
        <Panel title="Add a question">
          <div className="p-4 space-y-3">
            <div className="flex flex-col">
              <label className="text-[11.5px] font-medium text-head mb-1">Question type</label>
              <select className={input} value={qType} onChange={(e) => setQType(e.target.value as QuestionType)}>
                {(Object.keys(QUESTION_TYPE_LABEL) as QuestionType[]).map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[11.5px] font-medium text-head mb-1">Prompt</label>
              <textarea className={`${input} h-[60px] resize-none`} placeholder="Type the question…" value={qPrompt} onChange={(e) => setQPrompt(e.target.value)} />
            </div>

            {qType === "multiple-choice" && (
              <div>
                <label className="text-[11.5px] font-medium text-head mb-1 block">Options <span className="text-muted font-normal">· select the correct answer</span></label>
                <div className="space-y-2">
                  {options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="radio" name="correct" checked={answerIndex === i} onChange={() => setAnswerIndex(i)} className="accent-[#123FB9]" />
                      <input className={input} placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? e.target.value : x)))} />
                      {options.length > 2 && (
                        <button onClick={() => setOptions((os) => os.filter((_, j) => j !== i))} className="w-8 h-8 rounded-md border border-line text-muted hover:bg-rowhover flex items-center justify-center shrink-0"><IconX size={15} /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setOptions((os) => [...os, ""])} className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-primary"><IconPlus size={14} /> Add option</button>
              </div>
            )}

            {qType === "scale" && <p className="text-[12px] text-muted m-0">Respondents answer on a 1–5 agreement scale (Strongly disagree → Strongly agree).</p>}
            {qType === "short-answer" && <p className="text-[12px] text-muted m-0">Respondents type a free-text answer for manager review.</p>}

            <button onClick={addQuestion} className="btn-grad inline-flex items-center gap-1.5 px-4 py-2 text-[13px]"><IconPlus size={15} /> Add question</button>
          </div>
        </Panel>

        {/* preview / list */}
        <Panel title={`Questions (${questions.length})`} icon={<IconClipboardList size={16} />}>
          {questions.length === 0 ? (
            <div className="px-4 py-10 text-center text-muted text-[13px]">No questions yet. Build them on the left.</div>
          ) : (
            <div className="divide-y divide-[#eef1f6]">
              {questions.map((q, i) => (
                <div key={q.id} className="px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#eef2f7] text-[#5b6472] text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-head font-medium">{q.prompt}</div>
                      <div className="text-[11px] text-muted mt-0.5">{QUESTION_TYPE_LABEL[q.type]}</div>
                      {q.type === "multiple-choice" && q.options && (
                        <ul className="mt-1.5 space-y-1">
                          {q.options.map((o, oi) => (
                            <li key={oi} className={`text-[12.5px] flex items-center gap-1.5 ${oi === q.answerIndex ? "text-[#0f6e56] font-medium" : "text-body"}`}>
                              {oi === q.answerIndex ? <IconCheck size={13} /> : <span className="w-[13px] inline-block" />} {o}
                            </li>
                          ))}
                        </ul>
                      )}
                      {q.type === "scale" && <div className="mt-1 text-[12px] text-muted">1 — Strongly disagree · · · 5 — Strongly agree</div>}
                    </div>
                    <button onClick={() => removeQuestion(q.id)} className="w-8 h-8 rounded-md border border-line text-muted hover:bg-[#fcebeb] hover:text-[#a32d2d] flex items-center justify-center shrink-0"><IconX size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="flex items-center gap-2 mt-[18px]">
        <span className="text-[12px] text-muted">{kind} · {questions.length} question{questions.length === 1 ? "" : "s"}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => save("Draft")} className="px-4 py-2 text-[13px] rounded-md border border-line text-body hover:bg-rowhover">Save draft</button>
          <button onClick={() => save("Published")} className="btn-grad inline-flex items-center gap-1.5 px-4 py-2 text-[13px]"><IconCheck size={15} /> Publish</button>
        </div>
      </div>
    </div>
  );
}
