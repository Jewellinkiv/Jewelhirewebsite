"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CUSTOM_ASSESSMENTS, AssessmentQuestion, CustomAssessment } from "@/lib/custom-assessments";
import { IconCheck, IconChevronLeft, IconChevronRight, IconClock, IconLock, IconClipboardList, IconPlayerPlay } from "@/components/icons";

const STORE = "Sissy's Log Cabin";

const SCALE = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
];

interface ApiInvite {
  id: string;
  kind: string;
  status: string;
  job?: { title: string };
}

// The invite carries a kind but not its questions, so map the kind to a seeded
// assessment. Knowledge check → the Diamond 4Cs check; anything trait-like →
// the clienteling scale set. Falls back to the first published assessment.
function assessmentForKind(kind: string): CustomAssessment {
  const byKind =
    kind === "Knowledge check"
      ? CUSTOM_ASSESSMENTS.find((a) => a.kind === "Knowledge check")
      : CUSTOM_ASSESSMENTS.find((a) => a.kind === "Trait profile");
  return byKind || CUSTOM_ASSESSMENTS[0];
}

type Step = "intro" | number | "done";

export default function AssessmentTestPage() {
  const params = useParams();
  const inviteId = String(params.inviteId || "");
  const [kind, setKind] = useState("Knowledge check");
  const [role, setRole] = useState("this role");
  const [step, setStep] = useState<Step>("intro");
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [submitting, setSubmitting] = useState(false);

  const assessment = useMemo(() => assessmentForKind(kind), [kind]);
  const questions = assessment.questions;
  const isKnowledge = assessment.kind === "Knowledge check";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/applicant/invites")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body) => {
        if (cancelled) return;
        const match = ((body.items || []) as ApiInvite[]).find((i) => i.id === inviteId);
        if (match) {
          if (match.kind) setKind(match.kind);
          if (match.job?.title) setRole(match.job.title);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [inviteId]);

  const setAnswer = (qid: string, value: number | string) => setAnswers((a) => ({ ...a, [qid]: value }));

  // No submit endpoint exists for custom assessments yet, so completion is local
  // for now — consistent with these being seeded demo assessments. The store-side
  // scoring/notification wiring is a follow-up once an attempts API lands.
  const finish = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 400));
    setStep("done");
    setSubmitting(false);
  };

  // ---- Done ----------------------------------------------------------------
  if (step === "done") {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center max-w-[380px]">
          <span className="w-14 h-14 rounded-full bg-[#e1f5ee] text-[#0f6e56] inline-flex items-center justify-center mb-4"><IconCheck size={26} /></span>
          <h1 className="m-0 text-[19px] font-semibold text-head">You&apos;re all set</h1>
          <p className="mt-2 text-[13.5px] text-muted">Your {assessment.kind.toLowerCase()} was sent to {STORE}. Your responses are shared only with them — thanks for taking the time.</p>
          <Link href="/portal/invites" className="btn-grad inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 text-[13.5px] no-underline">Back to invites <IconChevronRight size={15} /></Link>
        </div>
      </div>
    );
  }

  // ---- Intro ---------------------------------------------------------------
  if (step === "intro") {
    const minutes = Math.max(3, Math.round(questions.length * 1.5));
    return (
      <div className="flex-1 flex flex-col py-6">
        <div className="mb-1 text-[12px] font-medium text-primary uppercase tracking-wide">{assessment.kind} · {role}</div>
        <h1 className="m-0 text-[22px] sm:text-[26px] font-semibold text-head leading-tight">{assessment.title}</h1>
        <p className="mt-2.5 text-[14px] text-body">{assessment.description}</p>

        <div className="mt-5 rounded-xl border border-line bg-white divide-y divide-[#eef1f6]">
          <Row icon={<IconClipboardList size={17} />} title={`${questions.length} question${questions.length === 1 ? "" : "s"}`} note="One question per screen — go at your own pace." />
          <Row icon={<IconClock size={17} />} title={`About ${minutes} minutes`} note="No timer. You can move back and change answers." />
          <Row icon={<IconLock size={17} />} title="Private to the store" note={isKnowledge ? `Only ${STORE} sees your results. You won't get a score here.` : `Only ${STORE} sees your responses. There are no right or wrong answers.`} />
        </div>

        <div className="mt-auto pt-6">
          <button onClick={() => setStep(0)} className="btn-grad w-full py-3.5 text-[15px] inline-flex items-center justify-center gap-2">
            <IconPlayerPlay size={16} /> Start
          </button>
          <Link href="/portal/invites" className="mt-3 flex items-center justify-center gap-1 text-[13px] text-muted no-underline hover:text-body"><IconChevronLeft size={14} /> Back to invites</Link>
        </div>
      </div>
    );
  }

  // ---- Question ------------------------------------------------------------
  const index = step as number;
  const q = questions[index];
  const answered = answers[q.id] !== undefined && answers[q.id] !== "";
  const optional = q.type === "short-answer";
  const canAdvance = answered || optional;
  const last = index === questions.length - 1;
  const progress = Math.round(((index + 1) / questions.length) * 100);

  const goNext = () => {
    if (!canAdvance) return;
    if (last) finish();
    else setStep(index + 1);
  };
  const goBack = () => setStep(index === 0 ? "intro" : index - 1);

  return (
    <div className="flex-1 flex flex-col">
      <div className="pt-5">
        <div className="flex items-center justify-between text-[12px] text-muted mb-1.5">
          <span>Question {index + 1} of {questions.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#e6ecf5] overflow-hidden">
          <div className="h-full bg-brand-grad transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="pt-6 flex-1">
        <h1 className="m-0 text-[18px] sm:text-[20px] font-semibold text-head leading-snug">{q.prompt}</h1>
        {optional ? <p className="mt-1 text-[12.5px] text-muted">Optional — a sentence or two is plenty.</p> : null}

        <div className="mt-4">
          <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
        </div>
      </div>

      {/* Sticky nav — thumb-reachable on a phone. */}
      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-page/95 backdrop-blur border-t border-line flex items-center gap-3">
        <button onClick={goBack} className="btn-outline px-4 py-3 text-[14px] inline-flex items-center gap-1 shrink-0"><IconChevronLeft size={15} /> Back</button>
        <button
          onClick={goNext}
          disabled={!canAdvance || submitting}
          className={`flex-1 py-3 text-[15px] inline-flex items-center justify-center gap-1.5 rounded-full ${
            canAdvance && !submitting ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"
          }`}
        >
          {submitting ? "Submitting…" : last ? "Submit" : <>Next <IconChevronRight size={15} /></>}
        </button>
      </div>
    </div>
  );
}

function QuestionInput({ q, value, onChange }: { q: AssessmentQuestion; value: number | string | undefined; onChange: (v: number | string) => void }) {
  if (q.type === "multiple-choice") {
    return (
      <div className="flex flex-col gap-2.5">
        {(q.options || []).map((opt, i) => {
          const on = value === i;
          return (
            <button
              key={i}
              onClick={() => onChange(i)}
              aria-pressed={on}
              className={`w-full text-left flex items-center gap-3 min-h-[52px] px-4 rounded-xl border transition-colors ${
                on ? "border-primary bg-[#eef4ff]" : "border-line bg-white active:bg-rowhover hover:bg-rowhover"
              }`}
            >
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? "border-primary bg-primary text-white" : "border-[#c2cfe0]"}`}>
                {on ? <IconCheck size={12} /> : null}
              </span>
              <span className={`text-[14px] ${on ? "text-head font-medium" : "text-body"}`}>{opt}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === "scale") {
    return (
      <div>
        <div className="grid grid-cols-5 gap-1.5">
          {SCALE.map((s) => {
            const on = value === s.value;
            return (
              <button
                key={s.value}
                onClick={() => onChange(s.value)}
                aria-pressed={on}
                className={`min-h-[52px] rounded-xl border text-[15px] font-semibold transition-colors ${
                  on ? "bg-primary text-white border-transparent" : "bg-white border-line text-body active:bg-rowhover hover:bg-rowhover"
                }`}
              >
                {s.value}
              </button>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[11px] text-muted">
          <span>{SCALE[0].label}</span>
          <span>{SCALE[SCALE.length - 1].label}</span>
        </div>
      </div>
    );
  }

  // short-answer
  return (
    <textarea
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      rows={5}
      placeholder="Type your answer…"
      className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-[14px] text-body outline-none focus:border-primary resize-none"
    />
  );
}

function Row({ icon, title, note }: { icon: React.ReactNode; title: string; note: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="w-8 h-8 rounded-lg bg-[#e8f1ff] text-primary flex items-center justify-center shrink-0">{icon}</span>
      <div>
        <div className="text-[13.5px] font-semibold text-head">{title}</div>
        <div className="text-[12.5px] text-muted">{note}</div>
      </div>
    </div>
  );
}
