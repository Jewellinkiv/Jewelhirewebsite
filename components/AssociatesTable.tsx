"use client";

import { useState } from "react";
import Link from "next/link";
import { FitBadge, TypeLabel } from "@/components/ui";
import { PROFILES, ProfileCode, FitTier } from "@/lib/gemmatch";
import { IconSend, IconChevronUp, IconChevronDown, IconChevronsUpDown } from "@/components/icons";

export interface AssocRow {
  id: string;
  name: string;
  initials: string;
  primary: ProfileCode;
  role: string;
  type: string;
  secondary: string;
  floorFit: number;
  fitTier: FitTier;
  tenure: string;
  tenureMonths: number;
  lastAssessed: string;
  lastAssessedTs: number;
  status: string;
}

type SortKey = "name" | "role" | "type" | "secondary" | "floorFit" | "tenureMonths" | "lastAssessedTs" | "status";

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-[#e1f5ee] text-[#0f6e56]",
  "On leave": "bg-[#fdf0e2] text-[#9a5a12]",
  New: "bg-[#e8f1ff] text-primary",
};

const COLS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: "name", label: "Associate" },
  { key: "role", label: "Role" },
  { key: "type", label: "GemMatch type" },
  { key: "secondary", label: "Secondary" },
  { key: "floorFit", label: "Floor fit", num: true },
  { key: "tenureMonths", label: "Tenure", num: true },
  { key: "lastAssessedTs", label: "Last assessed", num: true },
  { key: "status", label: "Status" },
];

export function AssociatesTable({ rows }: { rows: AssocRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "floorFit", dir: "desc" });

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const toggle = (key: SortKey, num?: boolean) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: num ? "desc" : "asc" }));

  const Arrow = ({ k }: { k: SortKey }) =>
    sort.key !== k ? (
      <IconChevronsUpDown size={13} className="text-[#b4bdcb]" />
    ) : sort.dir === "asc" ? (
      <IconChevronUp size={13} className="text-primary" />
    ) : (
      <IconChevronDown size={13} className="text-primary" />
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[860px]">
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={c.key} className="text-left border-b border-line px-4 py-2.5 whitespace-nowrap">
                <button
                  onClick={() => toggle(c.key, c.num)}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide ${sort.key === c.key ? "text-primary" : "text-muted hover:text-body"}`}
                >
                  {c.label}
                  <Arrow k={c.key} />
                </button>
              </th>
            ))}
            <th className="border-b border-line px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr key={m.id} className="hover:bg-rowhover">
              <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: PROFILES[m.primary].color }}>{m.initials}</span>
                  <span className="font-medium text-head whitespace-nowrap">{m.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] whitespace-nowrap">{m.role}</td>
              <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] whitespace-nowrap"><TypeLabel primary={m.primary} type={m.type} /></td>
              <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] text-muted whitespace-nowrap">{m.secondary}</td>
              <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]"><FitBadge score={m.floorFit} tier={m.fitTier} /></td>
              <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] text-body whitespace-nowrap">{m.tenure}</td>
              <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px] text-muted whitespace-nowrap">{m.lastAssessed}</td>
              <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                <span className={`text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[m.status]}`}>{m.status}</span>
              </td>
              <td className="px-4 py-3 border-b border-[#eef1f6] text-[13px]">
                <Link href="/send-jewelcert" title="Send JewelCert" className="w-8 h-8 rounded-md border border-line text-muted hover:bg-rowhover hover:text-primary flex items-center justify-center"><IconSend size={16} /></Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
