import { notFound } from "next/navigation";

const USERS = [
  {
    key: "admin",
    label: "JewelHire admin",
    email: "william@jewellink.com",
    destination: "/admin",
    description: "Manage all companies, users, billing, support, analytics, and assessments.",
  },
  {
    key: "store_owner",
    label: "Store owner",
    email: "jordan@email.com",
    destination: "/",
    description: "Work as Sissy's store owner across dashboard, pipeline, jobs, team, and settings.",
  },
  {
    key: "applicant",
    label: "Applicant",
    email: "maya.chen@email.com",
    destination: "/portal",
    description: "Use the applicant portal for profile, resume, applications, invites, interviews, and training.",
  },
];

export default function DevLoginPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-5 py-8">
      <div className="mx-auto max-w-[860px]">
        <div className="mb-7">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-brand-grad text-white">
              <span className="text-[20px] font-bold">JH</span>
            </span>
            <div>
              <h1 className="m-0 text-[28px] font-extrabold leading-tight text-head">Dev login</h1>
              <p className="m-0 text-[14px] text-muted">Local role switcher for fast product QA.</p>
            </div>
          </div>
          <p className="max-w-[680px] text-[14px] leading-6 text-body">
            Pick a local session to jump into the app without Google or password entry. This screen is disabled in production.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {USERS.map((user) => (
            <form key={user.key} action="/api/dev/session" method="post" className="rounded-[8px] border border-line bg-white p-4 shadow-sm">
              <input type="hidden" name="user" value={user.key} />
              <input type="hidden" name="next" value={user.destination} />
              <div className="mb-4 min-h-[112px]">
                <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted">{user.label}</div>
                <div className="mb-2 break-words text-[15px] font-bold text-head">{user.email}</div>
                <p className="m-0 text-[13px] leading-5 text-body">{user.description}</p>
              </div>
              <button type="submit" className="w-full rounded-[7px] bg-primary px-3 py-2 text-[13px] font-bold text-white hover:bg-[#1b4fd7]">
                Continue
              </button>
            </form>
          ))}
        </div>

        <form action="/api/auth/logout" method="post" className="mt-5">
          <button type="submit" className="rounded-[7px] border border-line bg-white px-4 py-2 text-[13px] font-semibold text-body hover:bg-rowhover">
            Clear session
          </button>
        </form>
      </div>
    </main>
  );
}
