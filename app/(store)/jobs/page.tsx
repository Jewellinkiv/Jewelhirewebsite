"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common";
import { Panel, MixBars } from "@/components/ui";
import { CANDIDATES } from "@/lib/data";
import { Mix } from "@/lib/gemmatch";
import { LEGACY_ASSESSMENTS, LEGACY_COURSES } from "@/lib/legacy";
import { getPostingByTitle, postingKpis } from "@/lib/job-postings";
import { EmptyState } from "@/components/states";
import { IconBriefcase, IconClipboardList, IconSchool, IconSend, IconTargetArrow, IconUserPlus } from "@/components/icons";

type JobStatus = "Active" | "Draft" | "Paused";

interface RoleProfile {
  title: string;
  location: string;
  status: JobStatus;
  openings: number;
  pipeline: number;
  idealMix: Mix;
  priority: string;
  assessments: string[];
  courses: string[];
  notes: string;
}

const ROLE_PROFILES: RoleProfile[] = [
  {
    title: "Sales Associate",
    location: "Little Rock",
    status: "Active",
    openings: 2,
    pipeline: CANDIDATES.filter((c) => c.role === "Sales Associate").length,
    idealMix: { V: 15, C: 45, F: 25, D: 15 },
    priority: "Balance a drive-heavy floor with Connector energy and steady follow-through.",
    assessments: ["GemMatch profile", "Sales Personality Profiling Test", "Jewelry Basic Knowledge Assessment"],
    courses: ["Mastering the Four C's", "Jewelry Basics", "Clienteling and Follow-up"],
    notes: "Best candidates should show client warmth, teachable jewelry knowledge, and enough drive to close without overpowering the floor.",
  },
  {
    title: "Sales Manager",
    location: "Little Rock",
    status: "Active",
    openings: 1,
    pipeline: CANDIDATES.filter((c) => c.role === "Sales Manager").length,
    idealMix: { V: 25, C: 25, F: 10, D: 40 },
    priority: "Add accountable floor leadership without losing people sense.",
    assessments: ["GemMatch profile", "12 Essentials: Understanding your potential", "Sales Personality Profiling Test"],
    courses: ["Building and Managing a High-Performance Sales Team", "Mastering Key Performance Indicators"],
    notes: "Look for a Determined primary or secondary who can coach, inspect pipeline behavior, and protect the service standard.",
  },
  {
    title: "Bench Jeweler",
    location: "Little Rock",
    status: "Draft",
    openings: 1,
    pipeline: CANDIDATES.filter((c) => c.role === "Bench Jeweler").length,
    idealMix: { V: 20, C: 5, F: 55, D: 20 },
    priority: "Strengthen precision, craft quality, and repair consistency.",
    assessments: ["GemMatch profile", "Jewelry Basic Knowledge Assessment"],
    courses: ["Inventory Security in Retail Jewelry", "Diamond Product Knowledge Book"],
    notes: "Foundation should be the strongest signal. Avoid candidates who need constant pace changes or heavy social selling.",
  },
];

const STORE_ID = "store-sissys-little-rock";

const STATUS_STYLE: Record<JobStatus, string> = {
  Active: "bg-[#e1f5ee] text-[#0f6e56]",
  Draft: "bg-[#eef2f7] text-[#5b6472]",
  Paused: "bg-[#fff4e2] text-[#9a6a12]",
};

function jobStatus(status?: string): JobStatus {
  if (status === "draft") return "Draft";
  if (status === "paused") return "Paused";
  return "Active";
}

function titleMatches(apiTitle: string, roleTitle: string) {
  return apiTitle.toLowerCase().includes(roleTitle.toLowerCase()) || roleTitle.toLowerCase().includes(apiTitle.toLowerCase());
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-panel border border-line rounded px-4 py-[15px]">
      <div className="text-xs text-muted font-medium">{label}</div>
      <div className="text-2xl font-semibold text-head mt-[5px] leading-none">{value}</div>
      <div className="text-xs mt-[5px] text-muted">{sub}</div>
    </div>
  );
}

function StatusChip({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-[11.5px] font-medium ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

function ProfileCard({ role }: { role: RoleProfile }) {
  const posting = getPostingByTitle(role.title);
  const k = posting ? postingKpis(posting) : null;
  return (
    <Panel>
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {posting ? (
                <Link href={`/jobs/${posting.slug}`} className="m-0 text-[16px] font-semibold text-head no-underline hover:text-primary">{role.title}</Link>
              ) : (
                <h3 className="m-0 text-[16px] font-semibold text-head">{role.title}</h3>
              )}
              <StatusChip status={role.status} />
            </div>
            <p className="m-0 mt-1 text-[12.5px] text-muted">{role.location} - {role.openings} opening{role.openings === 1 ? "" : "s"}</p>
            {k && posting && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[11.5px] bg-page border border-line rounded-full px-2.5 py-1 text-body">Running {posting.postedDaysAgo}d</span>
                <span className="text-[11.5px] bg-page border border-line rounded-full px-2.5 py-1 text-body">{k.total} applicants</span>
                <span className="text-[11.5px] bg-[#dff3e8] text-[#0f6e56] rounded-full px-2.5 py-1">{k.hired} hired</span>
                {k.avgFit != null && <span className="text-[11.5px] bg-[#e8f1ff] text-primary rounded-full px-2.5 py-1">avg fit {k.avgFit}</span>}
              </div>
            )}
          </div>
          <Link href={posting ? `/jobs/${posting.slug}` : "/applicants"} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-[12.5px] font-medium text-body no-underline hover:bg-rowhover">
            <IconUserPlus size={15} /> View job
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[270px_1fr] gap-4 mt-4">
          <div className="border border-line rounded-md bg-page px-3 py-3">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase text-muted mb-2">
              <IconTargetArrow size={14} /> Ideal GemMatch mix
            </div>
            <MixBars mix={role.idealMix} />
          </div>

          <div className="space-y-3">
            <div className="border border-[#cfe0fb] bg-[#eef4ff] rounded-md px-3 py-2.5 text-[12.5px] text-body">
              <b className="text-primary">Hiring priority:</b> {role.priority}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-line rounded-md px-3 py-3">
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-head mb-2"><IconClipboardList size={14} /> Required assessments</div>
                <ul className="m-0 pl-4 text-[12.5px] text-body leading-relaxed">
                  {role.assessments.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="border border-line rounded-md px-3 py-3">
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-head mb-2"><IconSchool size={14} /> Suggested courses</div>
                <ul className="m-0 pl-4 text-[12.5px] text-body leading-relaxed">
                  {role.courses.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>

            <p className="m-0 text-[12.5px] leading-relaxed text-body">{role.notes}</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export default function JobsPage() {
  const [roles, setRoles] = useState(ROLE_PROFILES);
  const active = roles.filter((role) => role.status === "Active").length;
  const openings = roles.reduce((sum, role) => sum + role.openings, 0);
  const pipeline = roles.reduce((sum, role) => sum + role.pipeline, 0);
  const publishedCourses = LEGACY_COURSES.filter((course) => course.status === "Published").length;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stores/${STORE_ID}/jobs`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: {
        items: {
          job: { title: string; location: string; status: string };
          kpis: { applicants: number; activePipeline: number };
        }[];
      }) => {
        if (cancelled) return;
        setRoles((current) =>
          current.map((role) => {
            const item = data.items.find((candidate) => titleMatches(candidate.job.title, role.title));
            if (!item) return role;
            return {
              ...role,
              location: item.job.location.replace(", AR", ""),
              status: jobStatus(item.job.status),
              pipeline: item.kpis.activePipeline || item.kpis.applicants,
            };
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setRoles(ROLE_PROFILES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle="Role profiles, active openings, and assessment/training requirements for v2 hiring."
        action={
          <button className="btn-grad inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[12.5px]">
            <IconBriefcase size={15} /> New role profile
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-[18px]">
        <Stat label="Active roles" value={active} sub="Open for candidates" />
        <Stat label="Open seats" value={openings} sub="Across role profiles" />
        <Stat label="Pipeline" value={pipeline} sub="Candidates mapped to roles" />
        <Stat label="Reusable content" value={LEGACY_ASSESSMENTS.length + publishedCourses} sub="Assessments plus courses" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-[18px] items-start">
        <div className="space-y-[18px]">
          {roles.length > 0 ? (
            roles.map((role) => <ProfileCard key={role.title} role={role} />)
          ) : (
            <Panel>
              <EmptyState
                icon={<IconBriefcase size={20} />}
                title="No role profiles yet"
                message="Create a role profile to define its ideal GemMatch mix, required assessments, and openings."
                action={<button className="btn-grad inline-flex items-center gap-1.5 px-4 py-2 text-[13px]"><IconBriefcase size={15} /> New role profile</button>}
              />
            </Panel>
          )}
        </div>

        <div className="space-y-[18px]">
          <Panel title="Role template rules">
            <div className="p-4 text-[12.5px] text-body leading-relaxed space-y-2">
              <p className="m-0">A v2 job is a role profile plus one or more active openings. The role profile owns ideal GemMatch mix, required assessments, and suggested courses.</p>
              <p className="m-0">Openings should stay lightweight: store, seat count, hiring stage, and candidate pipeline.</p>
              <p className="m-0">Legacy content becomes reusable assessment or training requirements, not copied Bubble pages.</p>
            </div>
          </Panel>

          <Panel title="Quick actions">
            <div className="p-4 flex flex-col gap-2">
              {[
                { href: "/cert-invitations", label: "Send role assessment package", icon: <IconSend size={17} /> },
                { href: "/assessments", label: "Review assessment library", icon: <IconClipboardList size={17} /> },
                { href: "/learn", label: "Review course library", icon: <IconSchool size={17} /> },
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
