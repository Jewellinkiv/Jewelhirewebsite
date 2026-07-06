// JewelCert = the single screening package a store sends to a candidate.
// It can bundle any combination of components — all OPTIONAL, chosen per send
// (nothing pre-selected). JewelCert results still feed the sales floor downstream.

export type ComponentKind = "gemmatch" | "test" | "knowledge" | "course";

export interface CertComponent {
  id: string;
  label: string;
  desc: string;
  kind: ComponentKind;
  meta: string; // duration / question count
}

export const CERT_COMPONENTS: CertComponent[] = [
  { id: "gemmatch", label: "JewelCert", desc: "Behavioral / sales-floor fit profile", kind: "gemmatch", meta: "~3 min" },
  { id: "12-essentials", label: "12 Essentials", desc: "Sales potential profile", kind: "test", meta: "36 questions · 60 min" },
  { id: "sales-personality", label: "Sales Personality", desc: "Sales traits profile", kind: "test", meta: "24 questions · 30 min" },
  { id: "jewelry-knowledge", label: "Jewelry Knowledge", desc: "Knowledge check (metals, gems, diamonds…)", kind: "knowledge", meta: "22 questions · 60 min" },
];

// Optional courses that can be attached to a JewelCert (pulled from the catalog).
export interface CertCourseRef {
  slug: string;
  title: string;
}

export const CERT_COURSES: CertCourseRef[] = [
  { slug: "first-impressions", title: "First Impressions" },
  { slug: "four-cs", title: "Mastering the Four C's: Diamond Excellence" },
  { slug: "art-of-experience", title: "The Art of Experience in Jewelry Sales" },
];

export interface JewelCertDraft {
  componentIds: string[]; // selected components, none by default
  courseSlugs: string[]; // optional attached courses
}
