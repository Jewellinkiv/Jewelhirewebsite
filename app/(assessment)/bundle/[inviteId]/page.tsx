"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { IconCheck, IconChevronLeft, IconChevronRight, IconDiamond, IconClipboardList, IconSchool } from "@/components/icons";

const STORE = "Sissy's Log Cabin";

interface BundleItem {
  key: string;
  type: "profile" | "course" | "test" | "assessment";
  label: string;
  href: string | null;
  done: boolean;
}

const TYPE_ICON = {
  profile: <IconDiamond size={16} />,
  course: <IconSchool size={16} />,
  test: <IconClipboardList size={16} />,
  assessment: <IconClipboardList size={16} />,
};

const TYPE_NOTE: Record<BundleItem["type"], string> = {
  profile: "~3 min · pick 10 words",
  course: "Watch, quiz, and upload · earn a badge",
  test: "Your store will share how to complete this.",
  assessment: "Your store will share how to complete this.",
};

export default function BundlePage() {
  const params = useParams();
  const inviteId = String(params.inviteId || "");
  const [load, setLoad] = useState<"loading" | "ready" | "notfound">("loading");
  const [role, setRole] = useState("this role");
  const [items, setItems] = useState<BundleItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/applicant/invites/${inviteId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (cancelled) return;
        setRole(d.invite?.role || "this role");
        setItems(d.items || []);
        setLoad("ready");
      })
      .catch(() => {
        if (!cancelled) setLoad("notfound");
      });
    return () => {
      cancelled = true;
    };
  }, [inviteId]);

  if (load === "loading") {
    return <div className="flex-1 flex items-center justify-center py-16 text-[13px] text-muted">Loading your JewelCert…</div>;
  }
  if (load === "notfound") {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <div className="text-center max-w-[360px]">
          <div className="text-[15px] font-semibold text-head">We couldn&apos;t find this JewelCert</div>
          <p className="mt-1.5 text-[13px] text-muted">It may have expired or already been completed. Open your invites to see what&apos;s still to do.</p>
          <Link href="/portal/invites" className="btn-grad inline-flex items-center gap-1.5 mt-4 px-4 py-2.5 text-[13px] no-underline">Back to invites</Link>
        </div>
      </div>
    );
  }

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="flex-1 flex flex-col py-6">
      <Link href="/portal/invites" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-body mb-3 no-underline"><IconChevronLeft size={14} /> Invites</Link>
      <div className="mb-1 text-[12px] font-medium text-primary uppercase tracking-wide">JewelCert · {role}</div>
      <h1 className="m-0 text-[22px] sm:text-[24px] font-semibold text-head leading-tight">Your JewelCert for {STORE}</h1>
      <p className="mt-2 text-[14px] text-body">Complete each part below. Your results are shared only with {STORE}. {doneCount} of {items.length} done.</p>

      <div className="mt-5 flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.key} className={`bg-white border rounded-lg flex items-center gap-3 px-4 py-3.5 ${item.done ? "border-[#cdeadd]" : "border-line"}`}>
            <span className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${item.done ? "bg-[#e1f5ee] text-[#0f6e56]" : "bg-[#e8f1ff] text-primary"}`}>
              {item.done ? <IconCheck size={16} /> : TYPE_ICON[item.type]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-head">{item.label}</div>
              <div className="text-[12px] text-muted">{item.done ? "Completed" : TYPE_NOTE[item.type]}</div>
            </div>
            {item.done ? (
              <span className="text-[11.5px] font-medium px-2.5 py-1 rounded-full bg-[#e1f5ee] text-[#0f6e56]">Done</span>
            ) : item.href ? (
              <Link href={item.href} className="btn-grad inline-flex items-center gap-1 px-3 py-1.5 text-[12.5px] no-underline">Start <IconChevronRight size={14} /></Link>
            ) : (
              <span className="text-[11.5px] text-muted border border-line rounded-md px-2.5 py-1.5">Required</span>
            )}
          </div>
        ))}
      </div>

      {items.length > 0 && doneCount === items.filter((i) => i.href).length && doneCount > 0 && (
        <p className="mt-5 text-center text-[13px] text-[#0f6e56]">Nice work — you&apos;ve finished everything you can complete here.</p>
      )}
    </div>
  );
}
