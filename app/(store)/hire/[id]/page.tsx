"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import { Panel, Radar, MixBars, FitBadge, TypeLabel } from "@/components/ui";
import { clarityLabel, PROFILES, PROFILE_ORDER, Mix, ProfileCode, FitTier } from "@/lib/gemmatch";
import { recomputeFloor, mixDelta } from "@/lib/hire";
import { useActiveStoreId } from "@/lib/client-session";
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

const FALLBACK_STORE_ID = "store-sissys-little-rock";
const PRODUCT = "JewelLink";
const EVEN_MIX: Mix = { V: 25, C: 25, F: 25, D: 25 };

// Real applicant being hired — resolved from the detail API (accepts the
// application id, profile id, or legacy name slug in the URL). This page used
// to look the candidate up in a static demo list and guess `app-<slug>` for
// the hire POST, so real applicants hit "Applicant not found".
interface HireCandidate {
  applicationId: string;
  name: string;
  initials: string;
  role: string;
  location: string;
  jobLocation: string;
  gemmatch?: { type: string; primary: ProfileCode; mix: Mix; fitScore?: number; tier?: FitTier };
}

function initialsOf(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "AP";
}

function locationKey(value: string) {
  return value.trim().toLowerCase().replace(/^location-/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function HirePage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const STORE_ID = useActiveStoreId(FALLBACK_STORE_ID);
  const [hired, setHired] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [error, setError] = useState("");
  const [c, setC] = useState<HireCandidate | null>(null);
  const [missing, setMissing] = useState(false);
  const [team, setTeam] = useState<{ locationId: string; mix: Mix; floorType: string; size: number; tested: number } | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const activeApplicationId = useRef("");

  useEffect(() => {
    let cancelled = false;
    activeApplicationId.current = "";
    setC(null);
    setMissing(false);
    setHired(false);
    setHiring(false);
    setError("");
    setTeam(null);
    setSelectedLocationId("");
    fetch(`/api/applicants/${params.id}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => {
        if (cancelled) return;
        const name = body.profile?.fullName || "Applicant";
        activeApplicationId.current = body.applicationId || "";
        setC({
          applicationId: body.applicationId || "",
          name,
          initials: initialsOf(name),
          role: body.job?.title || body.profile?.resumeHeadline || "Jewelry role",
          location: body.job?.location || body.profile?.location || "—",
          jobLocation: body.job?.location || "",
          gemmatch: body.gemmatch,
        });
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, STORE_ID]);

  useEffect(() => {
    let cancelled = false;
    setLocations([]);
    setLocationsLoaded(false);
    setSelectedLocationId("");
    fetch(`/api/stores/${STORE_ID}/locations`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => {
        if (cancelled) return;
        setLocations((body.items || []).map((item: { id: string; name?: string; label?: string }) => ({
          id: item.id,
          name: item.name || item.label || "",
        })));
        setLocationsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLocationsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [STORE_ID]);

  const location = useMemo(() => {
    if (locations.length === 0) return null;
    const target = locationKey(c?.jobLocation || "");
    if (!target) {
      if (selectedLocationId) return locations.find((item) => item.id === selectedLocationId) || null;
      return locations.length === 1 ? locations[0] : null;
    }
    const exact = locations.filter((item) => locationKey(item.id) === target || locationKey(item.name) === target);
    if (exact.length === 1) return exact[0];
    const compatible = locations.filter((item) => {
      const key = locationKey(item.name);
      return Boolean(key) && (key.includes(target) || target.includes(key));
    });
    return compatible.length === 1 ? compatible[0] : null;
  }, [c?.jobLocation, locations, selectedLocationId]);

  useEffect(() => {
    if (!location?.id) {
      setTeam(null);
      return;
    }
    let cancelled = false;
    setTeam(null);
    fetch(`/api/stores/${STORE_ID}/team?locationId=${encodeURIComponent(location.id)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => {
        if (cancelled) return;
        setTeam({
          locationId: location.id,
          mix: body.mix,
          floorType: body.floorType || "—",
          size: Number(body.total) || (body.members || []).length,
          tested: Number(body.tested) || 0,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [STORE_ID, location?.id]);

  const confirmHire = async () => {
    if (!c?.applicationId || !location || team?.locationId !== location.id || hiring) return;
    const applicationId = c.applicationId;
    setError("");
    setHiring(true);
    try {
      const response = await fetch(`/api/applications/${applicationId}/hire`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: c.role, locationId: location?.id }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Unable to confirm hire");
      }
      if (activeApplicationId.current === applicationId) setHired(true);
    } catch (err) {
      if (activeApplicationId.current === applicationId) {
        setError(err instanceof Error ? err.message : "Unable to confirm hire");
      }
    } finally {
      if (activeApplicationId.current === applicationId) setHiring(false);
    }
  };

  if (missing) {
    return (
      <Panel>
        <div className="p-6">
          <h1 className="m-0 text-lg font-semibold text-head">Applicant not found</h1>
          <Link href="/pipeline" className="mt-3 inline-block text-primary no-underline">Back to pipeline</Link>
        </div>
      </Panel>
    );
  }

  if (!c) {
    return (
      <Panel>
        <div className="p-8 text-center text-[13px] text-muted">Loading applicant…</div>
      </Panel>
    );
  }

  const hasGemMatch = Boolean(c.gemmatch);
  const incoming: Mix = c.gemmatch?.mix ?? EVEN_MIX;
  const before = team?.mix ?? EVEN_MIX;
  const teamSize = team?.size ?? 0;
  const teamTested = team?.tested ?? 0;
  const after = c.gemmatch ? recomputeFloor(before, incoming, teamTested) : before;
  const delta = mixDelta(before, after);
  const clarity = c.gemmatch ? clarityLabel(c.gemmatch.mix[c.gemmatch.primary] ?? 0, PROFILES[c.gemmatch.primary].name) : "";

  return (
    <div>
      <div className="text-[12.5px] text-muted mb-3.5">
        <Link href="/pipeline" className="text-primary no-underline inline-flex items-center gap-1">
          <IconChevronLeft size={14} /> Pipeline
        </Link>{" "}
        / Hire → {PRODUCT}
      </div>
      {/* applicant header */}
      <div className="flex flex-wrap items-center gap-3.5 bg-panel border border-line rounded px-[18px] py-4 mb-4">
        <div className="w-[52px] h-[52px] rounded-full bg-[#efe9fd] text-[#5a44c9] flex items-center justify-center font-semibold text-[19px]">{c.initials}</div>
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold text-head m-0">{c.name}</h1>
          <div className="text-[13px] text-muted mt-[3px] flex gap-2 items-center flex-wrap">
            {c.role} · {c.location.split(",")[0]}
            {c.gemmatch && <TypeLabel primary={c.gemmatch.primary} type={c.gemmatch.type} />}
            {c.gemmatch?.tier && typeof c.gemmatch.fitScore === "number" && <FitBadge score={c.gemmatch.fitScore} tier={c.gemmatch.tier} />}
          </div>
        </div>
        {!hired && (
          <Link href={`/applicants/${c.applicationId || params.id}`} className="btn-outline ml-auto px-3.5 py-2 text-[12.5px] no-underline">View profile</Link>
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
                  <span className="text-muted inline-flex items-center gap-1.5"><IconMapPin size={14} /> Location</span>
                  {c.jobLocation || locations.length <= 1 ? (
                    <span className="text-head font-medium">{location?.name || (locationsLoaded ? "Job location unavailable" : "Loading…")}</span>
                  ) : (
                    <select
                      value={selectedLocationId}
                      onChange={(event) => setSelectedLocationId(event.target.value)}
                      disabled={hiring}
                      className="w-full max-w-[260px] rounded-md border border-line bg-panel px-2.5 py-1.5 text-[13px] text-head outline-none focus:border-primary"
                    >
                      <option value="">Choose a location</option>
                      {locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  )}
                  <span className="text-muted inline-flex items-center gap-1.5"><IconDiamond size={14} /> JewelCert type</span>
                  <span className="text-head font-medium">{c.gemmatch ? `${c.gemmatch.type} · ${clarity}` : "Not completed"}</span>
                </div>
                <p className="mt-3.5 mb-0 text-[12.5px] text-muted leading-relaxed">
                  {c.gemmatch
                    ? `Hiring adds ${c.name.split(" ")[0]} to your ${PRODUCT} team with their role and completed JewelCert profile. The sales-floor mix recomputes below.`
                    : `Hiring adds ${c.name.split(" ")[0]} to your ${PRODUCT} team with their role. Their JewelCert profile will appear after they complete it.`}
                </p>
              </div>
            </Panel>

            <Panel title="Team recomputes" icon={<IconTargetArrow size={16} />}>
              <div className="p-4">
                {!hasGemMatch && (
                  <div className="mb-3 text-[12.5px] text-[#9a6a12] bg-[#fff4e2] border border-[#f0dcb4] rounded-md px-3 py-2">
                    JewelCert isn&rsquo;t complete — the team mix stays unchanged until a real result is available.
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
                  <div className="border border-line rounded-md p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5 text-center">
                      Floor mix{team ? ` · ${team.floorType}` : ""}
                    </div>
                    <Radar mix={before} overlay={after} size={220} />
                    <div className="mt-2 flex items-center justify-center gap-4 text-[11.5px]">
                      <span className="inline-flex items-center gap-1.5 text-muted"><span className="w-3 h-[3px] rounded-full bg-primary" /> Now ({teamTested} assessed)</span>
                      <span className="inline-flex items-center gap-1.5 text-muted"><span className="w-3 h-[3px] rounded-full bg-[#e2683c]" /> After ({teamTested + (c.gemmatch ? 1 : 0)} assessed)</span>
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
            <Panel title={`Add to ${PRODUCT}`} icon={<IconLink size={16} />}>
              <div className="p-4 space-y-3">
                <p className="m-0 text-[12.5px] text-body leading-relaxed">
                  Confirm to sync {c.name.split(" ")[0]} into {PRODUCT} as a team member.
                </p>
                {locationsLoaded && !location && (
                  <div className="rounded-md border border-[#f2c2c2] bg-[#fff4f4] px-3 py-2 text-[12.5px] text-[#a32d2d]">
                    {c.jobLocation
                      ? "This job’s location is not available to your account. Update the job or your location access before hiring."
                      : "Choose the location where this person will work before hiring."}
                  </div>
                )}
                <button onClick={confirmHire} disabled={hiring || !c.applicationId || !location || team?.locationId !== location.id} className={`w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] ${hiring || !location || team?.locationId !== location.id ? "bg-[#c2cbe0] text-white rounded-full font-bold cursor-not-allowed" : "btn-grad"}`}>
                  <IconUserPlus size={16} /> {hiring ? "Hiring…" : `Confirm hire → ${PRODUCT}`}
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
            <h2 className="m-0 text-[19px] font-semibold text-head">Added to {PRODUCT}</h2>
            <p className="mt-2 mb-0 text-[13px] text-muted leading-relaxed">
              {c.name} is now on the team as a {c.role}. {c.gemmatch
                ? `Their JewelCert profile and fit synced — the sales floor now reflects ${teamSize + 1} members.`
                : "Their JewelCert is still pending, so the sales-floor mix will update after they complete it."}
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
