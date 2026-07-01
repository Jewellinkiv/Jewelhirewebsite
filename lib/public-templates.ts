// Public hiring page templates + theme config (Phase 1, store-scoped).
// Each template comes default "almost ready to go" — the store tweaks logo/colors/
// fonts/hours and toggles the testimonials slider.

export interface PublicTheme {
  primary: string;
  accent: string;
  bg: string;
  text: string;
  fontId: string;
}

export interface FontOption {
  id: string;
  label: string;
  stack: string;
}

export const FONTS: FontOption[] = [
  { id: "inter", label: "Inter (modern)", stack: "Inter, system-ui, sans-serif" },
  { id: "serif", label: "Serif (classic)", stack: "Georgia, 'Times New Roman', serif" },
  { id: "system", label: "System (clean)", stack: "system-ui, -apple-system, sans-serif" },
  { id: "rounded", label: "Rounded (friendly)", stack: "'Trebuchet MS', 'Segoe UI', sans-serif" },
];

export function fontStack(id: string): string {
  return FONTS.find((f) => f.id === id)?.stack ?? FONTS[0].stack;
}

export type JobLayout = "list" | "cards";

export interface PublicTemplate {
  id: string;
  name: string;
  blurb: string;
  theme: PublicTheme;
  jobLayout: JobLayout;
}

export const TEMPLATES: PublicTemplate[] = [
  {
    id: "modern-blue",
    name: "Modern Blue",
    blurb: "Bold, JewelLink-style. Great default.",
    theme: { primary: "#123FB9", accent: "#2F7DFF", bg: "#f7f9ff", text: "#08122B", fontId: "inter" },
    jobLayout: "cards",
  },
  {
    id: "classic-elegance",
    name: "Classic Elegance",
    blurb: "Navy + gold, serif. Timeless fine-jewelry feel.",
    theme: { primary: "#0b1f3a", accent: "#b9933f", bg: "#ffffff", text: "#1a2233", fontId: "serif" },
    jobLayout: "list",
  },
  {
    id: "warm-boutique",
    name: "Warm Boutique",
    blurb: "Cream + bronze. Friendly, family-owned.",
    theme: { primary: "#8a5a2b", accent: "#c9892f", bg: "#fbf7f1", text: "#2b2118", fontId: "serif" },
    jobLayout: "cards",
  },
];

export interface Hours {
  day: string;
  hours: string;
}

export const DEFAULT_HOURS: Hours[] = [
  { day: "Mon–Fri", hours: "10:00 AM – 6:00 PM" },
  { day: "Saturday", hours: "10:00 AM – 5:00 PM" },
  { day: "Sunday", hours: "Closed" },
];

export interface Testimonial {
  id?: string;
  name: string;
  rating: number;
  text: string;
  source?: "customer" | "employee" | "manual" | "imported";
  status?: "draft" | "published" | "hidden";
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_TESTIMONIALS: Testimonial[] = [
  { name: "Nisha C.", rating: 5, text: "Beautiful store and the team treats you like family. Found the perfect ring here." },
  { name: "Marcus T.", rating: 5, text: "Knowledgeable staff and an honest repair department. Highly recommend." },
  { name: "Dana R.", rating: 4, text: "Great selection for bridal. Friendly, no-pressure experience." },
];

export interface PublicPageConfig {
  templateId: string;
  logoText: string;
  logoUrl?: string;
  logoAssetId?: string;
  theme: PublicTheme;
  jobLayout: JobLayout;
  headline: string;
  about: string;
  hours: Hours[];
  showReviews: boolean;
  testimonials: Testimonial[];
  status: "draft" | "published" | "paused";
}
