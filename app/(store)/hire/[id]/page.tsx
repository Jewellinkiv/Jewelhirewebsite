"use client";

import { useState, use } from "react";
import Link from "next/link";
import { getCandidate, TEAM, TEAM_MIX, FLOOR_TYPE } from "@/lib/data";
import { Panel, Radar, MixBars, FitBadge, TypeLabel } from "@/components/ui";
import { PROFILES, PROFILE_ORDER, Mix } from "@/lib/gemmatch";
import { HIRE_STORE, recomputeFloor, mixDelta } from "@/lib/hire";
import {
  IconUserPlus,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDiamond,
  IconMapPin,
  IconBriefcase,
  IconLink,
  IconTargetArrow,
  IconUsersGroup,
} from "@/components/icons";

const EVEN_MIX: Mix = { V: 25, C: 25, F: 25, D: 25 };

export default function HirePage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [hired, setHired] = useState(false);
  const [error, setError] = useState("");
  const c = getCandidate(params.id);
  const confirmHire = async () => {
    if (!c) return;
    setError("");
    const response = await fetch(`/api/applications/app-${c.id}/hire`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: c.role, locationId: HIRE_STORE.location }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error || "Unable to confirm hire");
      return;
    }
    setHired(true);
  };

  if (!c) {
    return (
      <Panel>
        <div className="p-6">
          <h1 className="m-0 text-lg font-semibold text-head">Applicant not found</h1>
          <Link href="/pipeline" className="mt-3 inline-block text-primary no-underline">Back to pipeline</Link>
        </div>
      </Panel>
    );
  }

  const hasGemMatch = Boolean(c.gemmatch);
  const incoming: Mix = c.gemmatch?.mix ?? EVEN_MIX;
  const before = TEAM_MIX;
  const after = recomputeFloor(before, incoming);
  const delta = mixDelta(before, after);

  return (
    <div>
      <div className="text-[12.5px] text-muted mb-3.5">
        <Link href="/pipeline" className="text-primary no-underline inline-flex items-center gap-1">
          <IconChevronLeft size={14} /> Pipeline
        </Link>{" "}
        / Hire → {HIRE_STORE.product}
      </div>
      {/* applicant header */}
      <div className="flex flex-wrap items-center gap-3.5 bg-panel border border-line rounded px-[18px] py-4 mb-4">
        <div className="w-[52px] h-[52px] rounded-full bg-[#efe9fd] text-[#5a44c9] flex items-center justify-center font-semibold text-[19px]">{c.initials}</div>
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold text-head m-0">{c.name}</h1>
          <div className="text-[13px] text-muted mt-[3px] flex gap-2 items-center flex-wrap">
            {c.role} · {c.location.split(",")[0]}
            {c.gemmatch && <TypeLabel primary={c.gemmatch.primary} type={c.gemmatch.type} />}
            {c.fit && <FitBadge score={c.fit.fitScore} tier={c.fit.tier} />}
          </div>
        </div>
        {!hired && (
          <Link href={`/applicants/${c.id}`} className="btn-outline ml-auto px-3.5 py-2 text-[12.5px] no-underline">View profile</Link>
        )}
      </div>
      {!hired ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4 items-start">
          {/* left — confirm details + team recompute */}
          <div className="space-y-4 min-w-0">
            <Panel title="Confirm hire" icon={<IconUserPlus size={16} />}>
              <div className="p-4">
                <div className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-[9px] text-[13px]">
                  <span className="text-muted inline-flex items-center gap-1.5"><IconBriefcase size={14} /> Role</span>
                  <span className="text-head font-medium">{c.role}</span>
                  <span className="text-muted inline-flex items-center gap-1.5"><IconLink size={14} /> Store</span>
                  <span className="text-head font-medium">{HIRE_STORE.name}</span>
                  <span className="text-muted inline-flex items-center gap-1.5"><IconMapPin size={14} /> Location</span>
                  <span className="text-head font-medium">{HIRE_STORE.location}</span>
                  <span className="text-muted inline-flex items-center gap-1.5"><IconDiamond size={14} /> GemMatch type</span>
                  <span className="text-head font-medium">{c.gemmatch ? `${c.gemmatch.type} · ${c.gemmatch.clarity}` : "Not completed"}</span>
                </div>
                <p className="mt-3.5 mb-0 text-[12.5px] text-muted leading-relaxed">
                  Hiring adds {c.name.split(" ")[0]} to your {HIRE_STORE.product} team with their profile,
                  role, and GemMatch fit. The sales-floor mix recomputes below.
                </p>
              </div>
            </Panel>

            <Panel title="Team recomputes" icon={<IconTargetArrow size={16} />}>
              <div className="p-4">
                {!hasGemMatch && (
                  <div className="mb-3 text-[12.5px] text-[#9a6a12] bg-[#fff4e2] border border-[#f0dcb4] rounded-md px-3 py-2">
                    GemMatch isn&rsquo;t complete — preview uses a balanced placeholder mix.
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
                  <div className="border border-line rounded-md p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5 text-center">
                      Floor mix · {FLOOR_TYPE}
                    </div>
                    <Radar mix={before} overlay={after} size={220} />
                    <div className="mt-2 flex items-center justify-center gap-4 text-[11.5px]">
                      <span className="inline-flex items-center gap-1.5 text-muted"><span className="w-3 h-[3px] rounded-full bg-primary" /> Now ({TEAM.length})</span>
                      <span className="inline-flex items-center gap-1.5 text-muted"><span className="w-3 h-[3px] rounded-full bg-[#e2683c]" /> After ({TEAM.length + 1})</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">Before</div>
                        <MixBars mix={before} />
                      </div>
                      <div className="self-center text-muted pt-6"><IconChevronRight size={18} /></div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">After</div>
                        <MixBars mix={after} />
                      </div>
                    </div>
                    <div className="border border-line rounded-md bg-page px-3 py-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">Change</div>
                      <div className="flex flex-wrap gap-2">
                        {PROFILE_ORDER.map((p) => (
                          <span key={p} className="inline-flex items-center gap-1.5 text-[12px] text-body">
                            <span className="w-2 h-2 rounded-full" style={{ background: PROFILES[p].color }} />
                            {PROFILES[p].name}
                            <span className={delta[p] > 0 ? "text-[#0f6e56] font-semibold" : delta[p] < 0 ? "text-[#a32d2d] font-semibold" : "text-muted"}>
                              {delta[p] > 0 ? `+${delta[p]}` : delta[p]}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          {/* right — confirm CTA */}
          <aside className="xl:sticky xl:top-4 space-y-4">
            <Panel title="Add to JewelLink" icon={<IconLink size={16} />}>
              <div className="p-4 space-y-3">
                <p className="m-0 text-[12.5px] text-body leading-relaxed">
                  Confirm to sync {c.name.split(" ")[0]} into {HIRE_STORE.product} as a team member.
                </p>
                <button onClick={confirmHire} className="btn-grad w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px]">
                  <IconUserPlus size={16} /> Confirm hire → {HIRE_STORE.product}
                </button>
                {error && <div className="rounded-md border border-[#f2c2c2] bg-[#fff4f4] px-3 py-2 text-[12.5px] text-[#a32d2d]">{error}</div>}
                <Link href="/pipeline" className="btn-outline w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] no-underline">
                  Cancel
                </Link>
              </div>
            </Panel>
          </aside>
        </div>
      ) : (
        /* success state */
        (<Panel>
          <div className="p-8 text-center max-w-[460px] mx-auto">
            <div className="w-14 h-14 rounded-full bg-[#dff3e8] text-[#0f6e56] flex items-center justify-center mx-auto mb-4">
              <IconCheck size={28} />
            </div>
            <h2 className="m-0 text-[19px] font-semibold text-head">Added to {HIRE_STORE.product}</h2>
            <p className="mt-2 mb-0 text-[13px] text-muted leading-relaxed">
              {c.name} is now on the {HIRE_STORE.name} team as a {c.role}. Their GemMatch profile and
              fit synced — the sales floor now reflects {TEAM.length + 1} members.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <Link href="/team-map" className="btn-grad inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] no-underline">
                <IconUsersGroup size={16} /> View team map
              </Link>
              <Link href="/roster" className="btn-outline inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] no-underline">
                Go to roster
              </Link>
              <Link href="/pipeline" className="btn-outline inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] no-underline">
                Back to pipeline
              </Link>
            </div>
          </div>
        </Panel>)
      )}
    </div>
  );
}
