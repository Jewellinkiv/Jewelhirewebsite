"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Panel } from "@/components/ui";
import { COMPANIES, STATUS_STYLE, PLAN_STYLE, AdminCompany, AdminCompanyUser } from "@/lib/admin";
import { IconChevronLeft, IconUsers, IconMapPin, IconX, IconCheck, IconUser, IconBriefcase, IconProgress } from "@/components/icons";

type StandaloneAccess = {
  schemaReady: boolean;
  companyStatus: string | null;
  dataRetained: boolean;
  jewellinkAccessActive: boolean;
  storeCount: number;
  claimAllowed: boolean;
  accessSource: string | null;
  accessStatus: string | null;
  billingInterval: "month" | "year" | null;
  amountCents: number | null;
  latestCheckout: {
    status: string;
    billingInterval: "month" | "year";
    amountCents: number;
    createdAt: string;
    expiresAt: string;
  } | null;
};

type BillingOffer = {
  interval: "month" | "year";
  amountCents: number;
  displayPrice: string;
  configured: boolean;
};

export default function CompanyDetail() {
  const params = useParams();
  const companyId = String(params.id);
  const fallbackCompany = COMPANIES.find((c) => c.id === companyId);
  const [company, setCompany] = useState<AdminCompany | undefined>(fallbackCompany);
  const [users, setUsers] = useState<AdminCompanyUser[]>(fallbackCompany?.users ?? []);
  const [notice, setNotice] = useState("");
  const [impersonate, setImpersonate] = useState(false);
  const [claimTarget, setClaimTarget] = useState<AdminCompanyUser | null>(null);
  const [claimSending, setClaimSending] = useState(false);
  const [teamInvitesEnabled, setTeamInvitesEnabled] = useState(false);
  const [standaloneAccess, setStandaloneAccess] = useState<StandaloneAccess | null>(null);
  const [billingOffers, setBillingOffers] = useState<BillingOffer[]>([]);
  const [billingTargetId, setBillingTargetId] = useState("");
  const [checkoutSending, setCheckoutSending] = useState<"month" | "year" | "">("");

  const refreshStandaloneAccess = useCallback(async () => {
    const response = await fetch(`/api/admin/companies/${companyId}/standalone-access`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { access: StandaloneAccess; billing: { offers?: BillingOffer[] } };
    setStandaloneAccess(data.access);
    setBillingOffers(data.billing.offers || []);
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/companies/${companyId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { company: AdminCompany; capabilities?: { teamInvitesEnabled?: boolean } }) => {
        if (!cancelled) {
          setCompany(data.company);
          setUsers(data.company.users);
          setBillingTargetId((current) => current || data.company.users.find((user) => user.role === "Admin")?.id || "");
          setTeamInvitesEnabled(data.capabilities?.teamInvitesEnabled === true);
          void refreshStandaloneAccess();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompany(fallbackCompany);
          setUsers(fallbackCompany?.users ?? []);
          setTeamInvitesEnabled(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, fallbackCompany, refreshStandaloneAccess]);

  if (!company) {
    return <div><Link href="/admin/companies" className="text-primary no-underline text-[13px]">← Companies</Link><p className="text-muted mt-4">Company not found.</p></div>;
  }

  const deactivate = async (id: string) => {
    const response = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setNotice("User could not be removed locally.");
      return;
    }
    const data = await response.json() as { company: AdminCompany };
    setCompany(data.company);
    setUsers(data.company.users);
    setNotice("User removed from the company.");
  };
  const resend = async (id: string, name: string) => {
    if (!teamInvitesEnabled) {
      setNotice("Team invitations are paused while JewelHire completes secure invitation setup.");
      return;
    }
    const response = await fetch(`/api/admin/users/${id}/resend`, { method: "POST" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setNotice(body?.error?.message || "The invitation could not be resent.");
      return;
    }
    setNotice(
      body?.notification?.status === "sent" && body?.notification?.delivery === "accepted"
        ? `Invitation email accepted for delivery to ${name}.`
        : `The invitation record for ${name} was refreshed, but no email was sent.`,
    );
  };
  const startImpersonation = async () => {
    const response = await fetch(`/api/admin/companies/${company.id}/impersonation`, { method: "POST" });
    setImpersonate(false);
    setNotice(response.ok ? `Started a 'view as' session for ${company.name} (logged).` : "View-as session could not be started locally.");
  };
  const sendAccessLink = async () => {
    if (!claimTarget) return;
    setClaimSending(true);
    const response = await fetch(`/api/admin/companies/${company.id}/claim-links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: claimTarget.id }),
    });
    const body = await response.json().catch(() => null);
    setClaimSending(false);
    if (!response.ok) {
      setNotice(body?.error?.message || "The secure access link could not be sent.");
      return;
    }
    setClaimTarget(null);
    setNotice(`Secure access link sent to ${claimTarget.name}. It expires in 3 days.`);
  };
  const sendCheckout = async (billingInterval: "month" | "year") => {
    if (!billingTargetId) {
      setNotice("Choose a store owner to receive checkout.");
      return;
    }
    setCheckoutSending(billingInterval);
    const response = await fetch(`/api/admin/companies/${company.id}/standalone-access`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: billingTargetId, billingInterval }),
    });
    const body = await response.json().catch(() => null);
    setCheckoutSending("");
    if (!response.ok) {
      setNotice(body?.error?.message || "Checkout could not be sent.");
      if (body?.error?.code === "standalone_access_active") await refreshStandaloneAccess();
      return;
    }
    setStandaloneAccess(body.access);
    const recipient = users.find((user) => user.id === billingTargetId);
    setNotice(`${billingInterval === "year" ? "Annual" : "Monthly"} checkout sent to ${recipient?.name || "the store owner"}. Refresh after Stripe confirms payment.`);
  };
  const billingTargets = users.filter((user) => user.role === "Admin" && user.status === "Active");

  return (
    <div className="max-w-[920px]">
      <Link href="/admin/companies" className="inline-flex items-center gap-1 text-[12.5px] text-muted no-underline hover:text-primary mb-2"><IconChevronLeft size={15} /> Companies</Link>

      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-lg bg-[#e8f1ff] text-primary flex items-center justify-center"><IconBriefcase size={22} /></span>
          <div>
            <h1 className="text-[21px] font-semibold text-head m-0">{company.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-[12.5px] text-muted">
              {company.owner} · since {company.createdAt}
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${PLAN_STYLE[company.plan]}`}>{company.plan}</span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[company.status]}`}>{company.status}</span>
            </div>
          </div>
        </div>
        <button onClick={() => setImpersonate(true)} className="btn-outline inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px]"><IconUser size={14} /> View as company</button>
      </div>

      {notice && (
        <div className="mb-4 flex items-center gap-2 bg-[#e1f5ee] border border-[#cdeadd] text-[#0f6e56] rounded-md px-3.5 py-2.5 text-[13px]"><IconCheck size={15} /> {notice}<button onClick={() => setNotice("")} className="ml-auto"><IconX size={15} /></button></div>
      )}

      {!teamInvitesEnabled && (
        <div className="mb-4 rounded-md border border-[#cfe0fb] bg-[#eef4ff] px-3.5 py-2.5 text-[12.5px] text-body">
          <span className="font-medium text-head">Team onboarding is paused for the pilot.</span> Existing users can still be viewed or removed; secure retained-owner access links remain available.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-[18px]">
        {[["Seats", company.seats], ["Stores", company.stores.length], ["Assessments sent", company.assessmentsSent], ["Hires", company.hires]].map(([k, v]) => (
          <div key={k as string} className="bg-panel border border-line rounded px-4 py-3"><div className="text-[11.5px] text-muted">{k}</div><div className="text-xl font-semibold text-head mt-0.5">{v}</div></div>
        ))}
      </div>

      <Panel title="Standalone access recovery" icon={<IconProgress size={16} />} className="mb-[18px]">
        <div className="p-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <div className="text-[13.5px] font-semibold text-head">
                {standaloneAccess?.jewellinkAccessActive ? "Access is included with JewelLink" : standaloneAccess?.claimAllowed ? "Paid access is active" : "Convert retained data to standalone access"}
              </div>
              <p className="text-[12.5px] text-body leading-relaxed mt-1 mb-0 max-w-[620px]">
                {standaloneAccess?.jewellinkAccessActive
                  ? "This organization still has active JewelLink-included access, so paid standalone checkout is unavailable. If its membership ends, the retained company can be converted here without recreating its data."
                  : standaloneAccess?.claimAllowed
                  ? "Stripe has confirmed a current organization entitlement. A secure, single-use account claim can now be sent to an active store owner."
                  : standaloneAccess && !standaloneAccess.schemaReady
                    ? "Retained data remains available. Checkout is temporarily paused while the standalone billing migration completes; account claims remain locked unless an earlier valid entitlement already exists."
                  : "Company, store, job, applicant, and analytics data remain in place. Send checkout first; JewelHire will keep account claims locked until a signed Stripe webhook activates the organization entitlement."}
              </p>
            </div>
            <button type="button" onClick={refreshStandaloneAccess} className="btn-outline px-3 py-2 text-[12px] whitespace-nowrap">
              Refresh payment status
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            <div className="rounded-md border border-line bg-page px-3 py-2.5">
              <div className="text-[10.5px] uppercase font-semibold text-muted">Data</div>
              <div className="text-[12.5px] font-medium text-head mt-1">{standaloneAccess?.dataRetained ? `Retained · ${standaloneAccess.storeCount} store${standaloneAccess.storeCount === 1 ? "" : "s"}` : "Checking…"}</div>
            </div>
            <div className="rounded-md border border-line bg-page px-3 py-2.5">
              <div className="text-[10.5px] uppercase font-semibold text-muted">Entitlement</div>
              <div className="text-[12.5px] font-medium text-head mt-1">{standaloneAccess?.claimAllowed ? "Active" : standaloneAccess?.accessStatus || "Payment required"}</div>
            </div>
            <div className="rounded-md border border-line bg-page px-3 py-2.5">
              <div className="text-[10.5px] uppercase font-semibold text-muted">Billing</div>
              <div className="text-[12.5px] font-medium text-head mt-1">{standaloneAccess?.billingInterval ? (standaloneAccess.billingInterval === "year" ? "$1,299/year" : "$149/month") : "Not selected"}</div>
            </div>
            <div className="rounded-md border border-line bg-page px-3 py-2.5">
              <div className="text-[10.5px] uppercase font-semibold text-muted">Claim link</div>
              <div className="text-[12.5px] font-medium text-head mt-1">{standaloneAccess?.jewellinkAccessActive ? "Uses JewelLink SSO" : standaloneAccess?.claimAllowed ? "Unlocked" : "Locked until payment"}</div>
            </div>
          </div>

          {!standaloneAccess?.claimAllowed && !standaloneAccess?.jewellinkAccessActive && (
            <div className="mt-4 border-t border-[#eef1f6] pt-4">
              <label className="block text-[11.5px] font-medium text-head mb-2" htmlFor="billing-owner">Checkout recipient</label>
              <select
                id="billing-owner"
                value={billingTargetId}
                onChange={(event) => setBillingTargetId(event.target.value)}
                className="w-full md:max-w-[360px] rounded-md border border-line bg-white px-3 py-2 text-[13px] text-head"
              >
                <option value="">Choose a store owner</option>
                {billingTargets.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}
              </select>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {billingOffers.map((offer) => (
                  <div key={offer.interval} className="rounded-md border border-line bg-white p-3">
                    <div className="text-[15px] font-semibold text-head">{offer.displayPrice}</div>
                    <div className="text-[11.5px] text-muted mt-1">{offer.interval === "year" ? "Save $489 per year." : "Flexible monthly billing."} One organization subscription.</div>
                    <button
                      type="button"
                      onClick={() => sendCheckout(offer.interval)}
                      disabled={!offer.configured || !billingTargetId || Boolean(checkoutSending)}
                      className="btn-grad w-full mt-3 px-3 py-2 text-[12px] disabled:opacity-50"
                    >
                      {checkoutSending === offer.interval ? "Sending…" : `Email ${offer.interval === "year" ? "annual" : "monthly"} checkout`}
                    </button>
                    {!offer.configured && <div className="text-[11px] text-[#a32d2d] mt-2">Stripe price not configured</div>}
                  </div>
                ))}
              </div>
              {standaloneAccess?.latestCheckout?.status === "pending" && (
                <div className="mt-3 rounded-md border border-[#cfe0fb] bg-[#eef4ff] px-3 py-2 text-[12px] text-body">
                  A {standaloneAccess.latestCheckout.billingInterval === "year" ? "yearly" : "monthly"} checkout is pending. Retrying reuses the same Stripe session; it does not create a second charge.
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] items-start">
        <Panel title={`Stores (${company.stores.length})`} icon={<IconMapPin size={16} />}>
          {company.stores.length > 0 ? (
            <div className="divide-y divide-[#eef1f6]">
              {company.stores.map((s) => (
                <div key={s.id} className="px-4 py-3"><div className="text-[13px] font-medium text-head">{s.name}</div><div className="text-[12px] text-muted">{s.location}</div></div>
              ))}
            </div>
          ) : <div className="px-4 py-8 text-center text-muted text-[13px]">No stores yet.</div>}
        </Panel>

        <Panel title={`Users (${users.length})`} icon={<IconUsers size={16} />}>
          <div className="divide-y divide-[#eef1f6]">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-2.5 px-4 py-2.5">
                <span className="w-8 h-8 rounded-full bg-[#eef2f7] flex items-center justify-center text-[11px] font-semibold text-[#5b6472]">{u.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-head flex items-center gap-1.5">{u.name}<span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full ${u.role === "Admin" ? "bg-[#efe9fd] text-[#5a44c9]" : "bg-[#e8f1ff] text-primary"}`}>{u.role}</span>{u.status === "Invited" && <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-[#fff4e2] text-[#9a6a12]">Invited</span>}</div>
                  <div className="text-[11.5px] text-muted">{u.email}</div>
                </div>
                <div className="ml-auto flex gap-1.5">
                  {u.role === "Admin" ? (
                    <button
                      disabled={!standaloneAccess?.claimAllowed}
                      title={standaloneAccess?.claimAllowed ? "Send a single-use account claim" : "Payment must be confirmed before a claim can be sent"}
                      onClick={() => setClaimTarget(u)}
                      className="text-[11.5px] px-2 py-1 rounded border border-line text-primary hover:bg-[#e8f1ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {standaloneAccess?.claimAllowed ? "Send access link" : "Payment required"}
                    </button>
                  ) : (
                    <button disabled={!teamInvitesEnabled} onClick={() => resend(u.id, u.name)} className="text-[11.5px] px-2 py-1 rounded border border-line text-body hover:bg-rowhover disabled:cursor-not-allowed disabled:opacity-50">{teamInvitesEnabled ? "Resend" : "Invites paused"}</button>
                  )}
                  {u.role !== "Admin" && <button onClick={() => deactivate(u.id)} className="w-7 h-7 rounded border border-line text-muted hover:bg-[#fcebeb] hover:text-[#a32d2d] flex items-center justify-center"><IconX size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {impersonate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setImpersonate(false)}>
          <div className="bg-white rounded-lg w-full max-w-[420px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4">
              <h3 className="m-0 text-[15px] font-semibold text-head">View as {company.name}?</h3>
              <p className="text-[13px] text-body mt-2 mb-0">You'll see their store exactly as they do, for support. This is logged to the audit trail. You won't make changes on their behalf without confirming.</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-line">
              <button onClick={() => setImpersonate(false)} className="px-4 py-2 text-[13px] rounded-md border border-line text-body hover:bg-rowhover">Cancel</button>
              <button onClick={startImpersonation} className="btn-grad px-4 py-2 text-[13px]">Start session</button>
            </div>
          </div>
        </div>
      )}

      {claimTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !claimSending && setClaimTarget(null)}>
          <div className="bg-white rounded-lg w-full max-w-[440px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4">
              <h3 className="m-0 text-[15px] font-semibold text-head">Send secure access link?</h3>
              <p className="text-[13px] text-body mt-2 mb-0">
                JewelHire will email {claimTarget.name} at {claimTarget.email} a single-use link to set a password for the retained account. The link expires in 3 days.
              </p>
              <p className="text-[12px] text-muted mt-3 mb-0">
                Stripe has confirmed an active standalone organization entitlement. This does not create another company or duplicate retained data.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-line">
              <button disabled={claimSending} onClick={() => setClaimTarget(null)} className="px-4 py-2 text-[13px] rounded-md border border-line text-body hover:bg-rowhover disabled:opacity-50">Cancel</button>
              <button disabled={claimSending} onClick={sendAccessLink} className="btn-grad px-4 py-2 text-[13px] disabled:opacity-60">
                {claimSending ? "Sending…" : "Send secure link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
