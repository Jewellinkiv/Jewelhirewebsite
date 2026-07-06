"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@/components/ui";
import { ErrorState, SkeletonCard } from "@/components/states";
import { CourseCredential, Education, Experience, Resume } from "@/lib/resume";
import { RESUME_TEMPLATES, ResumeTemplate } from "@/lib/resume-templates";
import { IconFileText, IconCheck, IconUser, IconBriefcase, IconSchool, IconCertificate } from "@/components/icons";

// An empty resume — the starting point before real data loads. No fabricated
// placeholder content: fields stay blank until the applicant's own resume arrives.
const EMPTY_RESUME: Resume = {
  fullName: "",
  headline: "",
  location: "",
  email: "",
  summary: "",
  experience: [],
  education: [],
  skills: [],
  courseCredentials: [],
};

const input = "w-full border border-line rounded-md px-3 py-2 text-[13px] text-body outline-none focus:border-primary bg-white";
const readonlyInput = `${input} bg-[#f8fafc] text-muted`;

interface ResumeApiResponse {
  profile: {
    fullName: string;
    email: string;
    location: string;
    resumeHeadline: string;
  };
  resume?: {
    summary: string;
    workExperience: string[];
    education: string[];
    skills: string[];
    courseCredentialIds: string[];
  };
}

function asExperience(items: string[] | undefined): Experience[] {
  return (items || []).map((item, index) => {
    const [title = item, company = "", period = "", detail = ""] = item.split(" · ");
    return { id: `exp-${index}`, title, company, period, detail };
  });
}

function asEducation(items: string[] | undefined): Education[] {
  return (items || []).map((item, index) => {
    const [credential = item, school = "", year = ""] = item.split(" · ");
    return { id: `edu-${index}`, credential, school, year };
  });
}

function asCredential(id: string): CourseCredential {
  return { id, title: id.replace(/^tr\d+$/, "Completed training"), issuer: "JewelHire", completed: true };
}

function fromApi(body: ResumeApiResponse): Resume {
  return {
    fullName: body.profile.fullName || "",
    headline: body.profile.resumeHeadline || "",
    location: body.profile.location || "",
    email: body.profile.email || "",
    summary: body.resume?.summary || "",
    experience: asExperience(body.resume?.workExperience),
    education: asEducation(body.resume?.education),
    skills: body.resume?.skills || [],
    courseCredentials: (body.resume?.courseCredentialIds || []).map(asCredential),
  };
}

function toApi(resume: Resume, lookupEmail: string) {
  return {
    lookupEmail,
    fullName: resume.fullName,
    email: resume.email,
    headline: resume.headline,
    location: resume.location,
    summary: resume.summary,
    workExperience: resume.experience.map((item) => [item.title, item.company, item.period, item.detail].filter(Boolean).join(" · ")),
    education: resume.education.map((item) => [item.credential, item.school, item.year].filter(Boolean).join(" · ")),
    skills: resume.skills,
    courseCredentialIds: resume.courseCredentials.filter((credential) => credential.completed).map((credential) => credential.id),
  };
}

export default function PortalResumePage() {
  const [resume, setResume] = useState<Resume>(EMPTY_RESUME);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [tpl, setTpl] = useState<ResumeTemplate>(RESUME_TEMPLATES[0]);
  const [lookupEmail, setLookupEmail] = useState("");
  const [badges, setBadges] = useState<{ courseId: string; badgeLabel: string; badgeColor: string }[]>([]);
  const hydrated = useRef(false);
  const set = (k: keyof Resume, v: string) => setResume((r) => ({ ...r, [k]: v }));
  const creds = useMemo(() => resume.courseCredentials.filter((c) => c.completed), [resume.courseCredentials]);

  useEffect(() => {
    fetch("/api/applicant/badges")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b) => setBadges(b.items || []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/applicant/resume")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Unable to load resume"))))
      .then((body) => {
        const next = fromApi(body);
        setResume(next);
        setLookupEmail(next.email);
        setStatus("loaded");
        // Only enable auto-save once real data has loaded — never persist the
        // empty starting state (or a failed load) back over the applicant's resume.
        hydrated.current = true;
      })
      .catch(() => {
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const timer = window.setTimeout(() => {
      fetch("/api/applicant/resume", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toApi(resume, lookupEmail)),
      }).then((response) => {
        if (response.ok) setLookupEmail(resume.email);
      }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [lookupEmail, resume]);

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-head m-0">Resume</h1>
      <p className="mt-1 mb-5 text-muted text-[13.5px]">Edit your details, pick a template, and your completed training shows up automatically.</p>

      {status === "loading" && (
        <div className="flex flex-col gap-[18px]"><SkeletonCard /><SkeletonCard /></div>
      )}

      {status === "error" && (
        <Panel><ErrorState message="We couldn't load your resume — please refresh." /></Panel>
      )}

      {status === "loaded" && (
      <>
      {/* template gallery */}
      <Panel title="Template" icon={<IconFileText size={16} />} className="mb-[18px]">
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {RESUME_TEMPLATES.map((t) => {
            const on = tpl.id === t.id;
            return (
              <button key={t.id} onClick={() => setTpl(t)} className={`text-left rounded-md border p-3 ${on ? "border-2 border-primary bg-[#f3f7ff]" : "border-line hover:bg-rowhover"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-head">{t.name}</span>
                  {on && <span className="text-primary"><IconCheck size={15} /></span>}
                </div>
                <div className="text-[11.5px] text-muted mt-0.5">{t.blurb}</div>
                <div className="mt-2 h-1.5 rounded-full" style={{ background: t.accent }} />
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] items-start">
        {/* editor */}
        <Panel title="Edit">
          <div className="p-4 space-y-3">
            <Field icon={<IconUser size={14} />} label="Full name"><input className={input} value={resume.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
            <Field label="Headline"><input className={input} value={resume.headline} onChange={(e) => set("headline", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Location"><input className={input} value={resume.location} onChange={(e) => set("location", e.target.value)} /></Field>
              <Field label="Email"><input className={readonlyInput} value={resume.email} readOnly /></Field>
            </div>
            <Field label="Summary"><textarea className={`${input} h-[80px] resize-none`} value={resume.summary} onChange={(e) => set("summary", e.target.value)} /></Field>
            <div className="text-[11.5px] text-muted">Experience, education, and skills carry over from your profile. Completed training is added as credentials automatically.</div>
          </div>
        </Panel>

        {/* live preview */}
        <Panel title="Preview" action={<button onClick={() => window.print()} className="btn-grad inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px]"><IconFileText size={13} /> Export PDF</button>}>
          <div className="p-4">
            <div className="border border-line rounded-md overflow-hidden bg-white" style={{ fontFamily: tpl.font === "serif" ? "Georgia, serif" : "var(--font-sans)" }}>
              <div className="px-5 py-4" style={tpl.layout === "modern" ? { background: tpl.accent, color: "#fff" } : { borderBottom: `3px solid ${tpl.accent}` }}>
                <div className="text-[18px] font-bold" style={tpl.layout === "modern" ? {} : { color: tpl.accent }}>{resume.fullName}</div>
                <div className={`text-[12px] ${tpl.layout === "modern" ? "opacity-90" : "text-muted"}`}>{resume.headline}</div>
                <div className={`text-[11px] ${tpl.layout === "modern" ? "opacity-80" : "text-muted"}`}>{resume.location} · {resume.email}</div>
              </div>
              <div className="px-5 py-4 space-y-3 text-[12px] text-body">
                <p className="m-0 leading-relaxed">{resume.summary}</p>
                <Section icon={<IconBriefcase size={13} />} title="Experience" accent={tpl.accent}>
                  {resume.experience.map((e) => (
                    <div key={e.id} className="mb-2">
                      <div className="font-semibold text-head">{e.title} · {e.company}</div>
                      <div className="text-[11px] text-muted">{e.period}</div>
                      <div className="text-[11.5px]">{e.detail}</div>
                    </div>
                  ))}
                </Section>
                <Section icon={<IconSchool size={13} />} title="Education" accent={tpl.accent}>
                  {resume.education.map((e) => <div key={e.id} className="text-[11.5px]"><b>{e.credential}</b> · {e.school} · {e.year}</div>)}
                </Section>
                <Section icon={<IconCertificate size={13} />} title="Credentials & skills" accent={tpl.accent}>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {creds.map((c) => <span key={c.id} className="text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: `${tpl.accent}1a`, color: tpl.accent }}>{c.title}</span>)}
                    {/* Auto-earned course badges carry onto the resume. */}
                    {badges.map((b) => <span key={b.courseId} className="text-[10.5px] px-2 py-0.5 rounded-full text-white inline-flex items-center gap-1" style={{ background: b.badgeColor }}><IconCertificate size={10} /> {b.badgeLabel}</span>)}
                  </div>
                  <div className="text-[11.5px] text-muted">{resume.skills.join(" · ")}</div>
                </Section>
              </div>
            </div>
          </div>
        </Panel>
      </div>
      </>
      )}
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <label className="text-[11.5px] font-medium text-head mb-1 flex items-center gap-1.5">{icon}{label}</label>
      {children}
    </div>
  );
}

function Section({ title, icon, accent, children }: { title: string; icon: React.ReactNode; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide mb-1 flex items-center gap-1.5" style={{ color: accent }}>{icon}{title}</div>
      {children}
    </div>
  );
}
