import { Mix } from "@/lib/gemmatch";

export type RoleTemplateStatus = "Active" | "Draft" | "Paused";

export interface RoleTemplate {
  role: string;
  title: string;
  location: string;
  status: RoleTemplateStatus;
  openings: number;
  pipeline: number;
  idealMix: Mix;
  priority: string;
  assessments: string[];
  courses: string[];
  notes: string;
  updatedAt: string;
}

type RoleTemplateInput = Partial<Omit<RoleTemplate, "role" | "updatedAt">>;

declare global {
  // eslint-disable-next-line no-var
  var __jewelhireRoleTemplates: RoleTemplate[] | undefined;
}

const DEFAULT_ROLE_TEMPLATES: RoleTemplate[] = [
  {
    role: "sales-associate",
    title: "Sales Associate",
    location: "Little Rock",
    status: "Active",
    openings: 2,
    pipeline: 0,
    idealMix: { V: 15, C: 45, F: 25, D: 15 },
    priority: "Balance a drive-heavy floor with Connector energy and steady follow-through.",
    assessments: ["GemMatch profile", "Sales Personality Profiling Test", "Jewelry Basic Knowledge Assessment"],
    courses: ["Mastering the Four C's", "Jewelry Basics", "Clienteling and Follow-up"],
    notes: "Best candidates should show client warmth, teachable jewelry knowledge, and enough drive to close without overpowering the floor.",
    updatedAt: "2026-06-24T00:00:00.000Z",
  },
  {
    role: "sales-manager",
    title: "Sales Manager",
    location: "Little Rock",
    status: "Active",
    openings: 1,
    pipeline: 0,
    idealMix: { V: 25, C: 25, F: 10, D: 40 },
    priority: "Add accountable floor leadership without losing people sense.",
    assessments: ["GemMatch profile", "12 Essentials: Understanding your potential", "Sales Personality Profiling Test"],
    courses: ["Building and Managing a High-Performance Sales Team", "Mastering Key Performance Indicators"],
    notes: "Look for a Determined primary or secondary who can coach, inspect pipeline behavior, and protect the service standard.",
    updatedAt: "2026-06-24T00:00:00.000Z",
  },
  {
    role: "bench-jeweler",
    title: "Bench Jeweler",
    location: "Little Rock",
    status: "Draft",
    openings: 1,
    pipeline: 0,
    idealMix: { V: 20, C: 5, F: 55, D: 20 },
    priority: "Strengthen precision, craft quality, and repair consistency.",
    assessments: ["GemMatch profile", "Jewelry Basic Knowledge Assessment"],
    courses: ["Inventory Security in Retail Jewelry", "Diamond Product Knowledge Book"],
    notes: "Foundation should be the strongest signal. Avoid candidates who need constant pace changes or heavy social selling.",
    updatedAt: "2026-06-24T00:00:00.000Z",
  },
];

export function roleSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cloneTemplate(template: RoleTemplate): RoleTemplate {
  return {
    ...template,
    idealMix: { ...template.idealMix },
    assessments: [...template.assessments],
    courses: [...template.courses],
  };
}

function templates() {
  globalThis.__jewelhireRoleTemplates ??= DEFAULT_ROLE_TEMPLATES.map(cloneTemplate);
  return globalThis.__jewelhireRoleTemplates;
}

export function listRoleTemplates() {
  return templates().map(cloneTemplate);
}

export function getRoleTemplate(role: string) {
  const slug = roleSlug(role);
  const item = templates().find((template) => template.role === slug || roleSlug(template.title) === slug);
  return item ? cloneTemplate(item) : undefined;
}

export function updateRoleTemplate(role: string, input: RoleTemplateInput) {
  const slug = roleSlug(role);
  const items = templates();
  let index = items.findIndex((template) => template.role === slug || roleSlug(template.title) === slug);
  if (index < 0) {
    items.push({
      role: slug,
      title: input.title || role,
      location: input.location || "",
      status: input.status || "Draft",
      openings: input.openings || 0,
      pipeline: input.pipeline || 0,
      idealMix: input.idealMix || { V: 25, C: 25, F: 25, D: 25 },
      priority: input.priority || "",
      assessments: input.assessments || [],
      courses: input.courses || [],
      notes: input.notes || "",
      updatedAt: new Date().toISOString(),
    });
    index = items.length - 1;
  } else {
    const current = items[index];
    items[index] = {
      ...current,
      ...input,
      idealMix: input.idealMix ? { ...input.idealMix } : current.idealMix,
      assessments: input.assessments ? [...input.assessments] : current.assessments,
      courses: input.courses ? [...input.courses] : current.courses,
      updatedAt: new Date().toISOString(),
    };
  }
  return cloneTemplate(items[index]);
}
