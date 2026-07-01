"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { ASSOC_INTERVIEWS, AssociateInterview } from "@/lib/associate-portal";
import { IconCalendar, IconCheck, IconX, IconVideo, IconMapPin, IconLink, IconUserPlus } from "@/components/icons";

const RSVP_STYLE: Record<string, string> = {
  Pending: "bg-[#fff4e2] text-[#9a6a12]",
  Accepted: "bg-[#e1f5ee] text-[#0f6e56]",
  Declined: "bg-[#fcebeb] text-[#a32d2d]",
};

interface ApiInterview {
  id: string;
  startsAt: string;
  locationType: "in_store" | "phone" | "video";
  locationDetails: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  outcome?: string;
  job?: { title: string };
}

function toInterview(item: ApiInterview): AssociateInterview {
  const rsvp = item.outcome?.includes("accepted") ? "Accepted" : item.status === "cancelled" ? "Declined" : "Pending";
  return {
    id: item.id,
    store: "Sissy's Log Cabin",
    role: item.job?.title || "Jewelry role",
    when: new Date(item.startsAt).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    type: item.locationType === "video" ? "Video" : item.locationType === "phone" ? "Phone" : "In-person",
    location: item.locationDetails,
    meetLink: item.locationType === "video" ? item.locationDetails : undefined,
    interviewer: "Hiring team",
    rsvp,
  };
}

export default function PortalInterviewsPage() {
  const [seed, setSeed] = useState<AssociateInterview[]>(ASSOC_INTERVIEWS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/applicant/interviews")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Unable to load interviews"))))
      .then((body) => {
        if (!cancelled) setSeed((body.items || []).map(toInterview));
      })
      .catch(() => {
        if (!cancelled) setSeed(ASSOC_INTERVIEWS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const list: AssociateInterview[] = seed;
  const set = async (id: string, rsvp: AssociateInterview["rsvp"]) => {
    await fetch(`/api/interviews/${id}/rsvp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ response: rsvp === "Accepted" ? "accepted" : "declined" }),
    }).catch(() => undefined);
    setSeed((l) => l.map((i) => (i.id === id ? { ...i, rsvp } : i)));
  };

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-head m-0">Interviews</h1>
      <p className="mt-1 mb-5 text-muted text-[13.5px]">Confirm the times that work for you. The store is notified when you respond.</p>

      <div className="flex flex-col gap-[18px]">
        {list.map((i) => (
          <Panel key={i.id}>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-full bg-[#e8f1ff] text-primary flex items-center justify-center"><IconCalendar size={20} /></span>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-head">{i.store}</div>
                  <div className="text-[12.5px] text-muted">{i.role} · with {i.interviewer}</div>
                </div>
                <span className={`ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full ${RSVP_STYLE[i.rsvp]}`}>{i.rsvp}</span>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12.5px] text-body">
                <div className="flex items-center gap-1.5"><IconCalendar size={14} className="text-muted" /> {i.when}</div>
                <div className="flex items-center gap-1.5">{i.type === "Video" ? <IconVideo size={14} className="text-muted" /> : <IconMapPin size={14} className="text-muted" />} {i.location}</div>
                {i.meetLink && <div className="flex items-center gap-1.5 text-primary"><IconLink size={14} /> {i.meetLink}</div>}
                {i.guests && i.guests.length > 0 && <div className="flex items-center gap-1.5 text-muted"><IconUserPlus size={14} /> +{i.guests.length} guest{i.guests.length === 1 ? "" : "s"}</div>}
              </div>

              <div className="mt-3.5 flex items-center gap-2">
                {i.rsvp !== "Accepted" && (
                  <button onClick={() => set(i.id, "Accepted")} className="btn-grad inline-flex items-center gap-1.5 px-4 py-2 text-[13px]"><IconCheck size={15} /> Accept</button>
                )}
                {i.rsvp !== "Declined" && (
                  <button onClick={() => set(i.id, "Declined")} className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] rounded-md border border-line text-body hover:bg-rowhover"><IconX size={15} /> Decline</button>
                )}
                {i.rsvp === "Accepted" && (
                  <a
                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Interview — ${i.store}`)}&details=${encodeURIComponent(`${i.role} interview with ${i.interviewer}. ${i.meetLink ? "Join: " + i.meetLink : ""}`)}&location=${encodeURIComponent(i.meetLink ?? i.location)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1.5 text-[12px] border border-line rounded px-2.5 py-1.5 text-primary no-underline hover:bg-rowhover"
                  >
                    <IconLink size={13} /> Add to calendar
                  </a>
                )}
              </div>
            </div>
          </Panel>
        ))}
        {list.length === 0 && <Panel><div className="px-4 py-8 text-center text-muted text-[13px]">No interview invites yet.</div></Panel>}
      </div>
    </div>
  );
}
