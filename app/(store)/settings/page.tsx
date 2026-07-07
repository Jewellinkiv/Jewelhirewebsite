"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common";
import { Panel } from "@/components/ui";
import { CalendarEmailSettings } from "@/components/CalendarEmailSettings";
import { UsersSettings } from "@/components/UsersSettings";
import { SaveButton } from "@/components/SaveButton";
import { IconArrowUpRight, IconBell, IconBriefcase, IconProgress, IconSettings } from "@/components/icons";
import { useActiveStoreId } from "@/lib/client-session";
import { StoreSettingsRecord } from "@/lib/local-settings-store";

const PIPELINE = ["Applied", "Cert sent", "JewelCert done", "In review", "Interview", "Offer", "Hired"];

const NOTIFICATIONS = [
  { label: "Candidate completes JewelCert", channel: "Email + in-app", owner: "Hiring manager" },
  { label: "Assessment package expires", channel: "In-app", owner: "Store admin" },
  { label: "Training assignment overdue", channel: "Email", owner: "Manager" },
  { label: "New strong-fit candidate", channel: "Email + in-app", owner: "Manager" },
];

const FALLBACK_STORE_ID = "store-sissys-little-rock";
// Neutral placeholder shown before the store's real settings load (and if the
// load fails). Deliberately blank — never a specific store's name — so one
// store's owner can't see another store's details.
function fallbackSettings(storeId: string): StoreSettingsRecord {
  return {
    storeId,
    organization: {
      company: "",
      primaryStore: "",
      defaultManager: "",
    },
    workflow: PIPELINE,
    notifications: NOTIFICATIONS,
    updatedAt: new Date().toISOString(),
  };
}

function SettingRow({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[190px_1fr] gap-2 md:gap-4 py-3 border-b border-[#eef1f6] last:border-0">
      <div>
        <div className="text-[13px] font-medium text-head">{label}</div>
        <div className="text-[11.5px] text-muted mt-0.5">{helper}</div>
      </div>
      <div className="rounded-md border border-line bg-page px-3 py-2 text-[13px] text-body">{value}</div>
    </div>
  );
}

function BillingSettings({ storeId }: { storeId: string }) {
  const [configured, setConfigured] = useState(false);
  const [allowPromotionCodes, setAllowPromotionCodes] = useState(true);
  const [promotionCode, setPromotionCode] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stores/${storeId}/billing/checkout`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { configured: boolean; allowPromotionCodes: boolean }) => {
        if (!cancelled) {
          setConfigured(data.configured);
          setAllowPromotionCodes(data.allowPromotionCodes);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfigured(false);
          setAllowPromotionCodes(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const openCheckout = async () => {
    setLoading(true);
    setStatus("");
    const response = await fetch(`/api/stores/${storeId}/billing/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promotionCode: promotionCode.trim() || undefined }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok || !data?.url) {
      setStatus(data?.error?.message || "Stripe checkout is unavailable.");
      return;
    }
    window.location.assign(data.url);
  };

  return (
    <Panel title="Billing" icon={<IconProgress size={16} />} className="mb-[18px]">
      <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-md border border-line bg-white px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase text-muted">Stripe</div>
            <div className="mt-1 text-[13px] font-medium text-head">{configured ? "Connected" : "Not configured"}</div>
          </div>
          <div className="rounded-md border border-line bg-white px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase text-muted">Discount codes</div>
            <div className="mt-1 text-[13px] font-medium text-head">{allowPromotionCodes ? "Accepted" : "Off"}</div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[11.5px] font-medium text-head" htmlFor="promotion-code">Promotion code</label>
          <input
            id="promotion-code"
            className="rounded-md border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-primary"
            value={promotionCode}
            onChange={(event) => setPromotionCode(event.target.value)}
            placeholder="Optional"
            disabled={!allowPromotionCodes}
          />
          <button
            type="button"
            className="btn-grad inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-[12.5px] disabled:opacity-60"
            onClick={openCheckout}
            disabled={!configured || loading}
          >
            Open Stripe <IconArrowUpRight size={14} />
          </button>
          {status && <div className="text-[12px] text-[#a32d2d]">{status}</div>}
        </div>
      </div>
    </Panel>
  );
}

export default function SettingsPage() {
  const storeId = useActiveStoreId(FALLBACK_STORE_ID);
  const [settings, setSettings] = useState<StoreSettingsRecord>(() => fallbackSettings(FALLBACK_STORE_ID));

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stores/${storeId}/settings`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { settings: StoreSettingsRecord }) => {
        if (!cancelled) setSettings(data.settings);
      })
      .catch(() => {
        if (!cancelled) setSettings(fallbackSettings(storeId));
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const saveSettings = async () => {
    const response = await fetch(`/api/stores/${storeId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organization: settings.organization,
        workflow: settings.workflow,
        notifications: settings.notifications,
      }),
    });
    if (!response.ok) return;
    const data = await response.json() as { settings: StoreSettingsRecord };
    setSettings(data.settings);
  };

  return (
    <div className="max-w-[940px]">
      <PageHeader
        title="Settings"
        subtitle="Users, calendar & email, organization, and workflow."
        action={<SaveButton onSave={saveSettings} />}
      />

      <UsersSettings storeId={storeId} />

      <CalendarEmailSettings storeId={storeId} />

      <BillingSettings storeId={storeId} />

      <Panel title="Organization" icon={<IconBriefcase size={16} />} className="mb-[18px]">
        <div className="px-4">
          <SettingRow label="Company" value={settings.organization.company} helper="Name shown across JewelHire." />
          <SettingRow label="Primary store" value={settings.organization.primaryStore} helper="Default location for candidates, jobs, and reporting." />
          <SettingRow label="Default manager" value={settings.organization.defaultManager} helper="Receives candidate completion and fit-review notifications." />
        </div>
      </Panel>

      <Panel title="Hiring workflow" icon={<IconSettings size={16} />} className="mb-[18px]">
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
            {settings.workflow.map((stage, index) => (
              <div key={stage} className="rounded-md border border-line bg-white px-3 py-2.5">
                <div className="text-[11px] font-semibold text-muted">Step {index + 1}</div>
                <div className="mt-0.5 text-[12.5px] font-medium text-head">{stage}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-md border border-[#cfe0fb] bg-[#eef4ff] px-3 py-2.5 text-[12.5px] text-body">
            JewelCert is the primary candidate signal. Aptitude, knowledge, and your custom assessments are optional per-role requirements.
          </div>
        </div>
      </Panel>

      <Panel title="Notifications" icon={<IconBell size={16} />}>
        <div className="overflow-x-auto"><table className="w-full border-collapse">
          <thead>
            <tr>
              {["Trigger", "Channel", "Owner"].map((h) => (
                <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5 border-b border-line">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {settings.notifications.map((item) => (
              <tr key={item.label} className="hover:bg-rowhover">
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] font-medium text-head">{item.label}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-body">{item.channel}</td>
                <td className="px-4 py-3 border-b border-[#eef1f6] text-[12.5px] text-muted">{item.owner}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Panel>
    </div>
  );
}
