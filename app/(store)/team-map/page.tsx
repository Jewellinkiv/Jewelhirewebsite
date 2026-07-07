"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel, Radar, MixBars, TypeLabel } from "@/components/ui";
import { IconUserPlus, IconSend } from "@/components/icons";
import { useActiveStoreId } from "@/lib/client-session";
import { Mix, PROFILES, PROFILE_ORDER, ProfileCode } from "@/lib/gemmatch";

const FALLBACK_STORE_ID = "store-sissys-little-rock";

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  type: string;
  primary: ProfileCode | null;
  status: string;
}

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-[#e1f5ee] text-[#0f6e56]",
  "On leave": "bg-[#fdf0e2] text-[#9a5a12]",
  New: "bg-[#e8f1ff] text-primary",
};

// Suggested hire for a trait the floor is short on — used to turn a gap into an
// actionable "hire next" line.
const HIRE_FOR: Record<ProfileCode, string> = {
  V: "a Visionary (Architect / Innovator) to add strategy and fresh ideas",
  C: "a Connector (Luxury Advisor) for warmth and clienteling",
  F: "a Foundation (Operational Anchor) to steady process and precision",
  D: "a Determined closer (Sales Strategist) for drive and closing power",
};

const EVEN_SHARE = 100 / PROFILE_ORDER.length; // 25% if each trait were equal

// Team trait mix = the distribution of members' primary traits. Only members
// with a completed assessment (a primary) count toward the mix.
function computeMix(members: TeamMember[]): { mix: Mix; assessed: number } {
  const counts: Mix = { V: 0, C: 0, F: 0, D: 0 };
  let assessed = 0;
  for (const m of members) {
    if (m.primary && counts[m.primary] !== undefined) {
      counts[m.primary] += 1;
      assessed += 1;
    }
  }
  if (!assessed) return { mix: { V: 0, C: 0, F: 0, D: 0 }, assessed: 0 };
  const mix = Object.fromEntries(
    PROFILE_ORDER.map((p) => [p, Math.round((100 * counts[p]) / assessed)]),
  ) as Mix;
  return { mix, assessed };
}

export default function TeamMapPage() {
  const STORE_ID = useActiveStoreId(FALLBACK_STORE_ID);
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMembers(null);
    setError(false);
    fetch(`/api/stores/${STORE_ID}/team`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body) => {
        if (cancelled) return;
        setMembers((body.members || body.items || []) as TeamMember[]);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [STORE_ID]);

  const { mix, assessed, ranked, rich, short } = useMemo(() => {
    const list = members || [];
    const { mix, assessed } = computeMix(list);
    const ranked = [...PROFILE_ORDER].sort((a, b) => mix[b] - mix[a]);
    // Rich = traits meaningfully above an even split; short = meaningfully below.
    const rich = ranked.filter((p) => mix[p] > EVEN_SHARE);
    const short = [...ranked].reverse().filter((p) => mix[p] < EVEN_SHARE * 0.6);
    return { mix, assessed, ranked, rich, short };
  }, [members]);

  const floorType = assessed ? `${PROFILES[ranked[0]].name}-led` : "—";

  if (error) {
    return (
      <div className="max-w-[940px]">
        <PageHeader title="Team map" subtitle="The whole team's mix, floor type, and where you're rich vs. short." />
        <Panel title="Team mix">
          <div className="p-6 text-[13px] text-muted">We couldn&apos;t load your team right now. Please refresh to try again.</div>
        </Panel>
      </div>
    );
  }

  if (members === null) {
    return (
      <div className="max-w-[940px]">
        <PageHeader title="Team map" subtitle="The whole team's mix, floor type, and where you're rich vs. short." />
        <Panel title="Team mix">
          <div className="p-6 text-[13px] text-muted">Loading your team…</div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="max-w-[940px]">
      <PageHeader title="Team map" subtitle="The whole team's mix, floor type, and where you're rich vs. short." />

      <div className="flex flex-col gap-[18px]">
        {/* 1 · Team mix */}
        <Panel title={assessed ? `Team mix · ${floorType} floor` : "Team mix"}>
          {assessed ? (
            <>
              <div className="p-4 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5 items-center">
                <div className="max-w-[260px] mx-auto w-full"><Radar mix={mix} size={240} /></div>
                <MixBars mix={mix} />
              </div>
              <p className="px-4 pb-3 -mt-1 text-[12px] text-muted">
                Based on {assessed} assessed {assessed === 1 ? "member" : "members"}
                {members.length > assessed ? ` (${members.length - assessed} not yet assessed)` : ""}.
              </p>
            </>
          ) : (
            <div className="p-6 text-[13px] text-muted">
              No completed assessments yet. Once your team takes JewelCert, their trait mix shows here.
            </div>
          )}
        </Panel>

        {/* 2 · Strengths & gaps — derived from the real mix */}
        {assessed ? (
          <Panel title="Strengths & gaps">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="border border-[#cdeadd] bg-[#e9f6f0] rounded-md px-3.5 py-3">
                <h5 className="m-0 mb-1.5 text-[13px] font-semibold text-[#0f6e56]">Rich in</h5>
                <p className="m-0 text-[13px] text-body">
                  {rich.length
                    ? rich.map((p) => `${PROFILES[p].name} (${PROFILES[p].lane.toLowerCase()})`).join(", ")
                    : "A balanced spread — no single trait dominates the floor."}
                </p>
              </div>
              <div className="border border-[#f3d9cd] bg-[#fdf1ec] rounded-md px-3.5 py-3">
                <h5 className="m-0 mb-1.5 text-[13px] font-semibold text-[#993c1d]">Short on</h5>
                <p className="m-0 text-[13px] text-body">
                  {short.length
                    ? short.map((p) => `${PROFILES[p].name} (${PROFILES[p].lane.toLowerCase()})`).join(", ")
                    : "Nothing glaring — every trait has some coverage."}
                </p>
              </div>
              <div className="border border-[#cfe0fb] bg-[#eef4ff] rounded-md px-3.5 py-3">
                <h5 className="m-0 mb-2 text-[13px] font-semibold text-primary flex items-center gap-1.5"><IconUserPlus size={15} /> Hire next</h5>
                {short.length ? (
                  <ul className="m-0 pl-4 text-[13px] text-body leading-relaxed">
                    {short.map((p) => <li key={p}>{HIRE_FOR[p]}</li>)}
                    {rich.length ? <li>Go easy on adding more {PROFILES[ranked[0]].name.toLowerCase()}</li> : null}
                  </ul>
                ) : (
                  <p className="m-0 text-[13px] text-body">Your floor is well-rounded — hire for role need over trait gaps.</p>
                )}
              </div>
            </div>
          </Panel>
        ) : null}

        {/* 3 · Associates — real members */}
        <Panel
          title={`Associates (${members.length})`}
          action={<Link href="/team" className="text-[12.5px] text-primary no-underline">Manage team</Link>}
        >
          {members.length ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[560px]">
                <thead>
                  <tr>
                    {["Associate", "Role", "JewelCert type", "Status"].map((h) => (
                      <th key={h} className="text-left border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted whitespace-nowrap">{h}</th>
                    ))}
                    <th className="border-b border-line px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-rowhover">
                      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: m.primary ? PROFILES[m.primary].color : "#b4bdcb" }}>{m.initials}</span>
                          <span className="font-medium text-head whitespace-nowrap">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] whitespace-nowrap">{m.role}</td>
                      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] whitespace-nowrap">
                        {m.primary ? <TypeLabel primary={m.primary} type={m.type} /> : <span className="text-muted">Not assessed</span>}
                      </td>
                      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                        <span className={`text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[m.status] || "bg-[#eef1f6] text-muted"}`}>{m.status}</span>
                      </td>
                      <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                        <Link href="/send-jewelcert" title="Send JewelCert" className="w-8 h-8 rounded-md border border-line text-muted hover:bg-rowhover hover:text-primary flex items-center justify-center"><IconSend size={16} /></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-[13px] text-muted">No team members yet. Hired applicants show up here.</div>
          )}
        </Panel>
      </div>
    </div>
  );
}
