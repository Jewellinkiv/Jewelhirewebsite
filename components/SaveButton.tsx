"use client";

import { useState } from "react";
import { IconCheck } from "@/components/icons";

// Lightweight save affordance for mock settings — gives the user feedback on
// click (no backend yet). Replace onClick with a real PATCH when wired.
export function SaveButton({ label = "Save changes", onSave }: { label?: string; onSave?: () => Promise<void> | void }) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      onClick={async () => {
        await onSave?.();
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      }}
      className="btn-grad inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[12.5px]"
    >
      <IconCheck size={15} /> {saved ? "Saved" : label}
    </button>
  );
}
