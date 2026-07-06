"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ADJECTIVES } from "@/lib/gemmatch";
import { IconCheck, IconChevronLeft, IconChevronRight, IconClock, IconLock, IconPlayerPlay } from "@/components/icons";

const PICK_TARGET = 10;

// Fisher-Yates shuffle. ADJECTIVES is stored grouped by trait, so rendering in
// source order would cluster each profile and telegraph which bucket a word
// scores into. Shuffle once per mount so the order is stable while choosing.
function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface ApiInvite {
  id: string;
  kind: string;
  status: string;
  job?: { title: string };
  store?: { name?: string };
}

type Step = "intro" | "pick" | "done";

export default function JewelCertTestPage() {
  const params = useParams();
  const inviteId = String(params.inviteId || "");
  const [step, setStep] = useState<Step>("intro");
  const [order] = useState(() => shuffled(ADJECTIVES));
  const [picked, setPicked] = useState<string[]>([]);
  const [role, setRole] = useState("this role");
  const [store, setStore] = useState("the store");
  // Gate the whole flow on confirming the invite exists for this applicant.
  // Without this, a bad/unauthed invite id would still render the picker and let
  // the applicant reach a submit that can only ever fail.
  const [load, setLoad] = useState<"loading" | "ready" | "notGemmatch" | "notfound" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/applicant/invites")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body) => {
        if (cancelled) return;
        const match = ((body.items || []) as ApiInvite[]).find((i) => i.id === inviteId);
        if (!match) {
          setLoad("notfound");
          return;
        }
        if (match.job?.title) setRole(match.job.title);
        if (match.store?.name) setStore(match.store.name);
        // Accept the standalone pick-10 (GemMatch) AND a JewelCert bundle id —
        // the backend records the pick-10 response against either invite.
        setLoad(match.kind === "GemMatch" || match.kind === "JewelCert" ? "ready" : "notGemmatch");
      })
      .catch(() => {
        if (!cancelled) setLoad("error");
      });
    return () => {
      cancelled = true;
    };
  }, [inviteId]);

  const complete = picked.length === PICK_TARGET;
  const toggle = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length < PICK_TARGET ? [...p, t] : p));

  const submit = async () => {
    if (!complete) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/gemmatch/responses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId, pickedAdjectiveIds: picked }),
      });
      if (!r.ok) throw new Error();
      setStep("done");
    } catch {
      setError("We couldn't submit your responses. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (load === "loading") {
    return <div className="flex-1 flex items-center justify-center py-16 text-[13px] text-muted">Loading your invite…</div>;
  }

  if (load === "notGemmatch" || load === "notfound" || load === "error") {
    const copy =
      load === "notGemmatch"
        ? { title: "This assessment isn't available here", body: "This invite needs to be completed a different way. Head back to your invites to continue." }
        : load === "notfound"
          ? { title: "We couldn't find this invite", body: "It may have expired or already been completed. Open your invites to see what's still to do." }
          : { title: "We couldn't load this invite", body: "Something went wrong on our end. Please check your connection and try again from your invites." };
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center max-w-[360px]">
          <div className="text-[15px] font-semibold text-head">{copy.title}</div>
          <p className="mt-1.5 text-[13px] text-muted">{copy.body}</p>
          <Link href="/portal/invites" className="btn-grad inline-flex items-center gap-1.5 mt-4 px-4 py-2.5 text-[13px] no-underline">Back to invites</Link>
        </div>
      </div>
    );
  }

  // ---- Done ----------------------------------------------------------------
  if (step === "done") {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center max-w-[380px]">
          <span className="w-14 h-14 rounded-full bg-[#e1f5ee] text-[#0f6e56] inline-flex items-center justify-center mb-4"><IconCheck size={26} /></span>
          <h1 className="m-0 text-[19px] font-semibold text-head">You&apos;re all set</h1>
          <p className="mt-2 text-[13.5px] text-muted">Your JewelCert responses were sent to {store}. Your results are shared only with them — thanks for taking the time.</p>
          <Link href="/portal/invites" className="btn-grad inline-flex items-center gap-1.5 mt-5 px-5 py-2.5 text-[13.5px] no-underline">Back to invites <IconChevronRight size={15} /></Link>
        </div>
      </div>
    );
  }

  // ---- Intro ---------------------------------------------------------------
  if (step === "intro") {
    return (
      <div className="flex-1 flex flex-col py-6">
        <div className="mb-1 text-[12px] font-medium text-primary uppercase tracking-wide">Personality · {role}</div>
        <h1 className="m-0 text-[22px] sm:text-[26px] font-semibold text-head leading-tight">Your JewelCert personality check</h1>
        <p className="mt-2.5 text-[14px] text-body">Pick the words that feel most like you. There are no right or wrong answers — this just helps {store} understand how you like to work.</p>

        <div className="mt-5 rounded-xl border border-line bg-white divide-y divide-[#eef1f6]">
          <Row icon={<IconCheck size={17} />} title={`Choose ${PICK_TARGET} words`} note="Tap the words that best describe you." />
          <Row icon={<IconClock size={17} />} title="Takes about 3 minutes" note="One short screen — no timer, no pressure." />
          <Row icon={<IconLock size={17} />} title="Private to the store" note={`Only ${store} sees your results. You won't get a score.`} />
        </div>

        <div className="mt-auto pt-6">
          <button onClick={() => setStep("pick")} className="btn-grad w-full py-3.5 text-[15px] inline-flex items-center justify-center gap-2">
            <IconPlayerPlay size={16} /> Start
          </button>
          <Link href="/portal/invites" className="mt-3 flex items-center justify-center gap-1 text-[13px] text-muted no-underline hover:text-body"><IconChevronLeft size={14} /> Back to invites</Link>
        </div>
      </div>
    );
  }

  // ---- Pick ----------------------------------------------------------------
  return (
    <div className="flex-1 flex flex-col">
      <div className="pt-5 pb-3">
        <button onClick={() => setStep("intro")} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-body mb-3"><IconChevronLeft size={14} /> Back</button>
        <h1 className="m-0 text-[17px] sm:text-[19px] font-semibold text-head">Pick the {PICK_TARGET} words that best describe you</h1>
        <p className="mt-1 text-[13px] text-muted">Tap to select. You can change your choices any time before submitting.</p>
      </div>

      {/* Adjective grid — neutral, uniform cells; nothing reveals a word's trait. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-3">
        {order.map((a) => {
          const on = picked.includes(a.text);
          const atLimit = !on && picked.length >= PICK_TARGET;
          return (
            <button
              key={a.text}
              onClick={() => toggle(a.text)}
              aria-pressed={on}
              className={`min-h-[48px] px-2 rounded-lg border text-[13.5px] text-center transition-colors ${
                on
                  ? "bg-primary text-white border-transparent font-medium"
                  : atLimit
                    ? "bg-white border-line text-muted/60"
                    : "bg-white border-line text-body active:bg-rowhover hover:bg-rowhover"
              }`}
            >
              {a.text}
            </button>
          );
        })}
      </div>

      {/* Sticky submit bar — always reachable with a thumb on a phone. */}
      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-page/95 backdrop-blur border-t border-line">
        {error ? <p className="m-0 mb-2 text-[12.5px] text-red-600 text-center">{error}</p> : null}
        <button
          onClick={submit}
          disabled={!complete || submitting}
          className={`w-full py-3.5 text-[15px] inline-flex items-center justify-center gap-2 rounded-full ${
            complete && !submitting ? "btn-grad" : "bg-[#cfd6e0] text-white font-bold cursor-not-allowed"
          }`}
        >
          {submitting ? "Submitting…" : complete ? "Submit responses" : `Select ${PICK_TARGET - picked.length} more`}
        </button>
      </div>
    </div>
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
