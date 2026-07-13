"use client";

import { useEffect } from "react";

export function PublicCareersTracker({
  storeSlug,
  event,
  jobId,
}: {
  storeSlug: string;
  event: "page_view" | "application_start";
  jobId?: string;
}) {
  useEffect(() => {
    const key = `jewelhire:careers-event:${storeSlug}:${event}:${jobId || "page"}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Analytics must never affect the application experience.
    }
    const payload = JSON.stringify({ event, ...(jobId ? { jobId } : {}) });
    const endpoint = `/api/public/stores/${encodeURIComponent(storeSlug)}/events`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([payload], { type: "application/json" }));
    } else {
      void fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true });
    }
  }, [event, jobId, storeSlug]);

  return null;
}
