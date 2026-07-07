"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { TeamMemberModal } from "@/components/TeamMemberModal";
import { Panel, TypeLabel } from "@/components/ui";
import { TEAM } from "@/lib/data";
import { PROFILES, ProfileCode } from "@/lib/gemmatch";
import { Location } from "@/lib/team-locations";
import { IconClipboardList, IconSchool, IconSend, IconTargetArrow, IconUserPlus, IconUsersGroup } from "@/components/icons";
import { useActiveStoreId } from "@/lib/client-session";

type TeamStatus = "Active" | "Onboarding" | "Needs review";

const ROSTER = TEAM.map((member, index) => {
  const status: TeamStatus = index === 4 ? "Onboarding" : index === 5 ? "Needs review" : "Active";
  return {
    ...member,
    status,
    location: index === 5 ? "Service / Repair" : "Little Rock floor",
    training: index === 4 ? "Clienteling starter" : index === 5 ? "Inventory Security" : "Current",
    lastCheckIn: index < 2 ? "This week" : index < 4 ? "Last week" : "Needs scheduling",
    nextAction:
      status === "Onboarding"
        ? "Assign first 30-day training path"
        : status === "Needs review"
          ? "Review development plan"
          : "Keep in quarterly coaching rhythm",
  };
});

type RosterMember = (typeof ROSTER)[number];

const FALLBACK_STORE_ID = "store-sissys-little-rock";

const BADGE: Record<ProfileCode, string> = {
  V: "bg-[#e8f1ff] text-primary",
  C: "bg-[#efe9fd] text-[#5a44c9]",
  F: "bg-[#e1f5ee] text-[#0f6e56]",
  D: "bg-[#fbe7de] text-[#993c1d]",
};

const STATUS_STYLE: Record<TeamStatus, string> = {
  Active: "bg-[#e1f5ee] text-[#0f6e56]",
  Onboarding: "bg-[#e8f1ff] text-primary",
  "Needs review": "bg-[#fff4e2] text-[#9a6a12]",
};

const fallbackCounts = TEAM.reduce<Record<ProfileCode, number>>(
  (acc, member) => {
    acc[member.primary] += 1;
    return acc;
  },
  { V: 0, C: 0, F: 0, D: 0 }
);

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-panel border border-line rounded px-4 py-[15px]">
      <div className="text-xs text-muted font-medium">{label}</div>
      <div className="text-2xl font-semibold text-head mt-[5px] leading-none">{value}</div>
      <div className="text-xs mt-[5px] text-muted">{sub}</div>
    </div>
  );
}

export default function RosterPage() {
  const STORE_ID = useActiveStoreId(FALLBACK_STORE_ID);
  // Start empty (not seeded with demo team) so we never flash another store's
  // fake roster; real members for THIS store load below.
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const counts = roster.reduce<Record<ProfileCode, number>>(
    (acc, member) => {
      acc[member.primary] += 1;
      return acc;
    },
    { ...fallbackCounts, V: 0, C: 0, F: 0, D: 0 }
  );

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    Promise.all([
      fetch(`/api/stores/${STORE_ID}/locations`).then((response) => (response.ok ? response.json() : Promise.reject())),
      fetch(`/api/stores/${STORE_ID}/team`).then((response) => (response.ok ? response.json() : Promise.reject())),
    ])
      .then(([locationsData, teamData]: [{ items: Location[] }, { members: RosterMember[] }]) => {
        if (cancelled) return;
        setLocations(locationsData.items);
        setRoster(teamData.members);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [STORE_ID]);

  return (
    <div>
      <PageHeader
        title="Roster"
        subtitle="Active team members, JewelCert profile signals, and development next steps."
        action={
          <button onClick={() => setAdding(true)} className="btn-grad inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[12.5px]">
            <IconUserPlus size={15} /> Add team member
          </button>
        }
      />
      <TeamMemberModal
        open={adding}
        title="Add team member"
        locations={locations}
        defaultLocationId={locations[0]?.id}
        onClose={() => setAdding(false)}
        onCreated={(member) => setRoster((current) => [member as RosterMember, ...current])}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-[18px]">
        <Stat label="Team members" value={roster.length} sub="Current prototype roster" />
        <Stat label="Onboarding" value={roster.filter((m) => m.status === "Onboarding").length} sub="Needs 30-day plan" />
        <Stat label="Needs review" value={roster.filter((m) => m.status === "Needs review").length} sub="Coaching follow-up" />
        <Stat label="Profile balance" value={`${counts.V + counts.D}:${counts.C + counts.F}`} sub="Drive vs. people/process" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-[18px] items-start">
        <Panel title="Team roster" action={<Link href="/team-map" className="text-[12.5px] text-primary no-underline">View team map</Link>}>
          <div className="overflow-x-auto"><table className="w-full border-collapse">
            <thead>
              <tr>
                {["Team member", "Role", "JewelCert", "Status", "Training", "Check-in", "Next action"].map((h) => (
                  <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roster.map((member) => (
                <tr key={member.id} className="hover:bg-rowhover align-top">
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-[30px] h-[30px] rounded-full bg-[#eef2f7] flex items-center justify-center text-[11px] font-semibold text-[#5b6472]">{member.initials}</span>
                      <span>
                        <span className="block font-medium text-head">{member.name}</span>
                        <span className="block text-[12px] text-muted">{member.location}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">{member.role}</td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                    <TypeLabel primary={member.primary} type={member.type} />
                  </td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[11.5px] font-medium ${STATUS_STYLE[member.status] ?? "bg-[#eef1f7] text-muted"}`}>{member.status}</span>
                  </td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-body">{member.training}</td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-muted">{member.lastCheckIn}</td>
                  <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-body max-w-[220px]">{member.nextAction}</td>
                </tr>
              ))}
              {!loaded && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted text-[13px]">Loading roster…</td></tr>
              )}
              {loaded && roster.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted text-[13px]">No team members yet. Add your first team member to build your roster.</td></tr>
              )}
            </tbody>
          </table></div>
        </Panel>

        <div className="space-y-[18px]">
          <Panel title="Profile balance" icon={<IconUsersGroup size={16} />}>
            <div className="p-4 space-y-3">
              {(["V", "D", "C", "F"] as ProfileCode[]).map((code) => (
                <div key={code}>
                  <div className="flex items-center justify-between text-[12.5px] mb-1">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[code]}`}>{code}</span>
                      {PROFILES[code].name}
                    </span>
                    <span className="text-muted">{counts[code]}</span>
                  </div>
                  <span className="block h-2 rounded-full bg-[#eef1f7] overflow-hidden">
                    <span className="block h-full" style={{ width: `${roster.length ? (counts[code] / roster.length) * 100 : 0}%`, background: PROFILES[code].color }} />
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Manager actions">
            <div className="p-4 flex flex-col gap-2">
              {[
                { href: "/cert-invitations", label: "Invite team member to JewelCert", icon: <IconSend size={17} /> },
                { href: "/learn", label: "Assign training path", icon: <IconSchool size={17} /> },
                { href: "/assessments", label: "Review assessment history", icon: <IconClipboardList size={17} /> },
                { href: "/team-map", label: "Compare team fit", icon: <IconTargetArrow size={17} /> },
              ].map((action) => (
                <Link key={action.label} href={action.href} className="flex items-center gap-2.5 px-3 py-2.5 border border-line rounded-md no-underline text-body text-[13px] hover:bg-rowhover hover:border-accent">
                  <span className="text-primary">{action.icon}</span>
                  {action.label}
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
