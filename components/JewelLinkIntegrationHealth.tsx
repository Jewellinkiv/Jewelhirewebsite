"use client";

import { useCallback, useEffect, useState } from "react";
import { IconCheck, IconLink, IconRefresh } from "@/components/icons";
import { Panel } from "@/components/ui";

type IntegrationIssue = {
  id: string;
  kind: "hire" | "jewelcert_result";
  applicationId: string;
  name: string;
  email: string;
  status: "pending" | "failed";
  errorMessage?: string;
  occurredAt: string;
};

type HealthResponse = {
  configuration: {
    configured: boolean;
    urlConfigured: boolean;
    secretConfigured: boolean;
    httpsReady: boolean;
  };
  issueCount: number;
  issues: IntegrationIssue[];
};

const ERROR_LABELS: Record<string, string> = {
  jewellink_url_not_configured: "JewelLink URL is not configured.",
  jewellink_https_required: "JewelLink must use HTTPS in production.",
  jewellink_integration_secret_not_configured: "The shared integration secret is not configured.",
  jewellink_organization_not_linked: "This organization is not linked to JewelLink.",
  jewellink_location_not_linked: "The selected location is not linked to JewelLink.",
  jewellink_provisioning_failed: "JewelLink user provisioning failed.",
  jewellink_result_delivery_failed: "JewelCert result delivery failed.",
};

function issueKey(issue: IntegrationIssue) {
  return `${issue.kind}:${issue.id}`;
}

export function JewelLinkIntegrationHealth({ storeId }: { storeId: string }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/stores/${storeId}/integrations/jewellink/health`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    setHealth(response.ok ? data : null);
    if (!response.ok) setNotice("Unable to load JewelLink integration health.");
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (issue: IntegrationIssue) => {
    const key = issueKey(issue);
    setRetrying(key);
    setNotice("");
    const response = await fetch(`/api/stores/${storeId}/integrations/jewellink/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: issue.kind,
        id: issue.kind === "hire" ? issue.applicationId : issue.id,
      }),
    });
    const data = await response.json().catch(() => null);
    setNotice(response.ok
      ? `${issue.kind === "hire" ? "Hire" : "JewelCert result"} synchronized successfully.`
      : data?.error?.message || data?.error || "Synchronization is still failing. Check the integration configuration and retry.");
    setRetrying("");
    await load();
  };

  return (
    <Panel
      title="JewelLink integration"
      icon={<IconLink size={16} />}
      className="mb-[18px]"
      action={(
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-body hover:bg-page disabled:opacity-50"
        >
          <IconRefresh size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      )}
    >
      <div className="p-4">
        {loading && !health ? (
          <div className="text-[12.5px] text-muted">Checking JewelLink synchronization health…</div>
        ) : health ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${health.configuration.configured ? "bg-[#e1f5ee] text-[#0f6e56]" : "bg-[#fcebeb] text-[#a32d2d]"}`}>
                {health.configuration.configured && <IconCheck size={12} />}
                {health.configuration.configured ? "Configured" : "Configuration required"}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${health.issueCount ? "bg-[#fff4e2] text-[#9a6a12]" : "bg-[#eef2f7] text-[#5b6472]"}`}>
                {health.issueCount} pending or failed
              </span>
            </div>

            {!health.configuration.configured && (
              <div className="mt-3 rounded-md border border-[#f3c8c8] bg-[#fff5f5] px-3 py-2.5 text-[12px] text-[#8f2f2f]">
                Configure the JewelLink HTTPS URL and shared integration secret before retrying production handoffs.
              </div>
            )}

            {health.issues.length === 0 ? (
              <div className="mt-3 rounded-md border border-[#cce8de] bg-[#f1faf7] px-3 py-2.5 text-[12.5px] text-[#0f6e56]">
                No pending or failed JewelLink handoffs.
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-md border border-line">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['Handoff', 'Person', 'Status', 'Details', ''].map((heading) => (
                        <th key={heading} className="border-b border-line px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {health.issues.map((issue) => {
                      const key = issueKey(issue);
                      return (
                        <tr key={key} className="last:[&>td]:border-b-0">
                          <td className="border-b border-[#eef1f6] px-3 py-2.5 text-[12px] font-medium text-head">
                            {issue.kind === "hire" ? "New hire" : "JewelCert result"}
                          </td>
                          <td className="border-b border-[#eef1f6] px-3 py-2.5">
                            <div className="text-[12px] font-medium text-head">{issue.name}</div>
                            <div className="text-[10.5px] text-muted">{issue.email}</div>
                          </td>
                          <td className="border-b border-[#eef1f6] px-3 py-2.5 text-[11.5px] font-semibold text-[#9a6a12]">{issue.status}</td>
                          <td className="max-w-[260px] border-b border-[#eef1f6] px-3 py-2.5 text-[11px] text-muted">
                            <div>{ERROR_LABELS[issue.errorMessage || ""] || issue.errorMessage || "Waiting to synchronize."}</div>
                            <div className="mt-0.5">{new Date(issue.occurredAt).toLocaleString()}</div>
                          </td>
                          <td className="border-b border-[#eef1f6] px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => void retry(issue)}
                              disabled={Boolean(retrying) || !health.configuration.configured}
                              className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-page disabled:opacity-50"
                            >
                              <IconRefresh size={12} className={retrying === key ? "animate-spin" : ""} /> Retry
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
        {notice && <div className="mt-3 text-[12px] text-body">{notice}</div>}
      </div>
    </Panel>
  );
}
