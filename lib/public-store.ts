// Public hiring portal data (Phase 1 — single store, private).
// Powers the store's website-facing careers page. Applicants only see THIS store.

export interface StoreReview {
  name: string;
  rating: number; // 1..5
  text: string;
  when: string;
}

export interface PublicJob {
  id: string;
  title: string;
  type: "Full-time" | "Part-time";
  location: string;
  salary: string;
  blurb: string;
}

export const STORE = {
  name: "Sissy's Log Cabin",
  tagline: "Family-owned fine jewelry since 1970",
  location: "Little Rock, Arkansas",
  about:
    "A premier family-owned jeweler with seven Arkansas locations, known for exceptional client service, bridal, and custom design. We hire people who love building relationships and helping clients mark life's biggest moments.",
  benefits: ["401(k)", "Health insurance", "Paid holidays", "Employee discounts", "Commission", "Training on-site"],
  rating: 4.8,
  reviewCount: 42,
  founded: 1970,
  locations: 7,
  careersUrl: "sissyslogcabin.com/careers",
};

export const STORE_JOBS: PublicJob[] = [
  {
    id: "luxury-sales-associate",
    title: "Luxury Jewelry Sales Associate",
    type: "Full-time",
    location: "Little Rock, AR",
    salary: "$60,000 – $85,000",
    blurb: "Deliver a luxury shopping experience, build a personal client book, and grow with ongoing product training.",
  },
  {
    id: "sales-manager",
    title: "Sales Manager",
    type: "Full-time",
    location: "Little Rock, AR",
    salary: "$75,000 – $125,000",
    blurb: "Lead and coach a high-performing sales team while driving clienteling and store performance.",
  },
  {
    id: "bench-jeweler",
    title: "Bench Jeweler / Repair Specialist",
    type: "Full-time",
    location: "Little Rock, AR",
    salary: "$55,000 – $90,000",
    blurb: "Precision repair, sizing, and custom bench work for a busy, quality-focused service department.",
  },
];

export const STORE_REVIEWS: StoreReview[] = [
  { name: "Nisha C.", rating: 5, text: "Beautiful store and the team treats you like family. Found the perfect ring here.", when: "2 months ago" },
  { name: "Marcus T.", rating: 5, text: "Knowledgeable staff and an honest repair department. Highly recommend.", when: "5 months ago" },
  { name: "Dana R.", rating: 4, text: "Great selection for bridal. Friendly, no-pressure experience.", when: "8 months ago" },
];
