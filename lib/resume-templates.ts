// Resume templates the associate can choose for their resume layout/theme.

export interface ResumeTemplate {
  id: string;
  name: string;
  blurb: string;
  layout: "classic" | "modern" | "compact";
  accent: string; // hex
  font: "sans" | "serif";
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  { id: "classic", name: "Classic", blurb: "Timeless single-column, easy to scan.", layout: "classic", accent: "#123FB9", font: "serif" },
  { id: "modern", name: "Modern", blurb: "Accent header with a clean sidebar feel.", layout: "modern", accent: "#2F7DFF", font: "sans" },
  { id: "compact", name: "Compact", blurb: "Dense one-pager for lots of experience.", layout: "compact", accent: "#0f6e56", font: "sans" },
];
