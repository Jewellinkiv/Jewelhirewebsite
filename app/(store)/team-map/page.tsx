import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel, Radar, MixBars } from "@/components/ui";
import { TEAM, TEAM_MIX, FLOOR_TYPE } from "@/lib/data";
import { ASSOCIATE_DETAIL } from "@/lib/team-detail";
import { AssociatesTable, AssocRow } from "@/components/AssociatesTable";
import { IconUserPlus } from "@/components/icons";

function tenureToMonths(t: string): number {
  const y = /(\d+)\s*y/.exec(t);
  const m = /(\d+)\s*m/.exec(t);
  return (y ? +y[1] : 0) * 12 + (m ? +m[1] : 0);
}

const ROWS: AssocRow[] = TEAM.map((m) => {
  const d = ASSOCIATE_DETAIL[m.id];
  return {
    id: m.id,
    name: m.name,
    initials: m.initials,
    primary: m.primary,
    role: m.role,
    type: m.type,
    secondary: d?.secondary ?? "—",
    floorFit: d?.floorFit ?? 0,
    fitTier: d?.fitTier ?? "Stretch",
    tenure: d?.tenure ?? "—",
    tenureMonths: d ? tenureToMonths(d.tenure) : 0,
    lastAssessed: d?.lastAssessed ?? "—",
    lastAssessedTs: d ? Date.parse(d.lastAssessed) || 0 : 0,
    status: d?.status ?? "Active",
  };
});

export default function TeamMapPage() {
  return (
    <div className="max-w-[940px]">
      <PageHeader title="Team map" subtitle="The whole team's mix, floor type, and where you're rich vs. short." />

      <div className="flex flex-col gap-[18px]">
        {/* 1 · Team mix */}
        <Panel title={`Team mix · ${FLOOR_TYPE} floor`}>
          <div className="p-4 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5 items-center">
            <div className="max-w-[260px] mx-auto w-full"><Radar mix={TEAM_MIX} size={240} /></div>
            <MixBars mix={TEAM_MIX} />
          </div>
        </Panel>

        {/* 2 · Strengths & gaps */}
        <Panel title="Strengths & gaps">
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="border border-[#cdeadd] bg-[#e9f6f0] rounded-md px-3.5 py-3">
              <h5 className="m-0 mb-1.5 text-[13px] font-semibold text-[#0f6e56]">Rich in</h5>
              <p className="m-0 text-[13px] text-body">Visionary + Determined — strategy, drive, and closing power.</p>
            </div>
            <div className="border border-[#f3d9cd] bg-[#fdf1ec] rounded-md px-3.5 py-3">
              <h5 className="m-0 mb-1.5 text-[13px] font-semibold text-[#993c1d]">Short on</h5>
              <p className="m-0 text-[13px] text-body">Connector + Foundation — warmth/clienteling and process/precision.</p>
            </div>
            <div className="border border-[#cfe0fb] bg-[#eef4ff] rounded-md px-3.5 py-3">
              <h5 className="m-0 mb-2 text-[13px] font-semibold text-primary flex items-center gap-1.5"><IconUserPlus size={15} /> Hire next</h5>
              <ul className="m-0 pl-4 text-[13px] text-body leading-relaxed">
                <li>A Connector (Luxury Advisor) for client experience</li>
                <li>A Foundation (Operational Anchor) to steady ops</li>
                <li>Avoid adding more drive</li>
              </ul>
            </div>
          </div>
        </Panel>

        {/* 3 · Associates — sortable table */}
        <Panel title={`Associates (${TEAM.length})`} action={<Link href="/team" className="text-[12.5px] text-primary no-underline">Manage team</Link>}>
          <AssociatesTable rows={ROWS} />
        </Panel>
      </div>
    </div>
  );
}
