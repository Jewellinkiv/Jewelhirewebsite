// Learner-facing Training Center (catalog + video course player).
// Matches the legacy JewelLink course flow (thumbnail cards → course detail with
// intro video + lessons + skills + certificate) in the v2 design. Mock data.

export type LessonType = "Video" | "Reading" | "Quiz";

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  durationMin: number;
  completed: boolean;
}

export interface Module {
  title: string;
  lessons: Lesson[];
}

export type CourseIcon = "platform" | "sales" | "product" | "service" | "leadership" | "ops";

export interface Course {
  slug: string;
  title: string;
  instructor: string;
  category: string;
  durationLabel: string;
  blurb: string;
  skills: string[];
  accent: string; // thumbnail color
  icon: CourseIcon;
  progress: number; // 0..100
  certificate: string;
  modules: Module[];
}

function lessons(items: [string, LessonType, number, boolean][]): Lesson[] {
  return items.map(([title, type, durationMin, completed], i) => ({ id: `l${i}`, title, type, durationMin, completed }));
}

export const COURSES: Course[] = [
  {
    slug: "jewellink-premium-how-to",
    title: "JewelLink Premium How To",
    instructor: "JewelLink",
    category: "Platform",
    durationLabel: "20 hours",
    blurb: "A series of videos and tools that introduce jewelry businesses to JewelLink — recruitment, onboarding, training, and engagement, all in one platform.",
    skills: ["Business", "Profile", "Post a job", "Team", "Training center", "Social"],
    accent: "#123FB9",
    icon: "platform",
    progress: 35,
    certificate: "Participant badge added to your resume on completion.",
    modules: [
      { title: "Getting started", lessons: lessons([["Introduction to the course", "Video", 6, true], ["Setting up your store profile", "Video", 9, true], ["Posting your first job", "Video", 8, false]]) },
      { title: "For business owners", lessons: lessons([["Using JewelCert to screen", "Video", 11, false], ["Building your sales floor with GemMatch", "Video", 12, false], ["Social & brand promotion", "Video", 7, false], ["Knowledge check", "Quiz", 5, false]]) },
    ],
  },
  {
    slug: "art-of-experience",
    title: "The Art of Experience in Jewelry Sales",
    instructor: "JewelLink",
    category: "Sales",
    durationLabel: "1 hour",
    blurb: "Create consistent, engaging customer experiences. Learn to build relationships, ask meaningful questions, and guide customers through a memorable sales journey.",
    skills: ["Clienteling", "Storytelling", "Relationship building"],
    accent: "#7C6CF0",
    icon: "sales",
    progress: 100,
    certificate: "Participant badge added to your resume on completion.",
    modules: [
      { title: "The experience mindset", lessons: lessons([["Why experience wins", "Video", 8, true], ["Shepherd of the experience", "Video", 10, true]]) },
      { title: "In practice", lessons: lessons([["Asking better questions", "Video", 9, true], ["Final reflection", "Reading", 6, true]]) },
    ],
  },
  {
    slug: "four-cs",
    title: "Mastering the Four C's: Diamond Excellence",
    instructor: "JewelLink",
    category: "Product",
    durationLabel: "1 hour",
    blurb: "Confidently navigate Carat, Clarity, Color, and Cut — how each shapes value and how to communicate them to build trust with customers.",
    skills: ["Diamonds", "Grading", "Customer education"],
    accent: "#1f9e75",
    icon: "product",
    progress: 64,
    certificate: "Participant badge added to your resume on completion.",
    modules: [
      { title: "The Four C's", lessons: lessons([["Carat weight", "Video", 8, true], ["Clarity", "Video", 9, true], ["Color", "Video", 8, true], ["Cut & brilliance", "Video", 10, false]]) },
      { title: "On the floor", lessons: lessons([["Talking the Four C's with clients", "Video", 11, false], ["Knowledge check", "Quiz", 5, false]]) },
    ],
  },
  {
    slug: "first-impressions",
    title: "First Impressions",
    instructor: "JewelLink",
    category: "Service",
    durationLabel: "1 hour",
    blurb: "Make outstanding first impressions — shaping perceptions, greeting with confidence, and avoiding common pitfalls to build instant rapport.",
    skills: ["Greeting", "Rapport", "Confidence"],
    accent: "#e2683c",
    icon: "service",
    progress: 0,
    certificate: "Participant badge added to your resume on completion.",
    modules: [
      { title: "First five seconds", lessons: lessons([["Why first impressions matter", "Video", 7, false], ["Greeting with confidence", "Video", 9, false], ["Avoiding common pitfalls", "Video", 8, false]]) },
    ],
  },
  {
    slug: "high-performance-team",
    title: "Building & Managing a High-Performance Sales Team",
    instructor: "JewelLink",
    category: "Leadership",
    durationLabel: "2 hours",
    blurb: "Principles of recruiting, developing, and managing a high-performing jewelry sales team — from hiring fit to ongoing coaching.",
    skills: ["Recruiting", "Coaching", "Team building"],
    accent: "#9a6a12",
    icon: "leadership",
    progress: 0,
    certificate: "Participant badge added to your resume on completion.",
    modules: [
      { title: "Build the team", lessons: lessons([["Hiring for fit", "Video", 12, false], ["Balancing your sales floor", "Video", 11, false]]) },
      { title: "Lead the team", lessons: lessons([["Coaching rhythms", "Video", 10, false], ["Managing performance", "Video", 12, false]]) },
    ],
  },
  {
    slug: "clienteling-follow-up",
    title: "Clienteling & Follow-up",
    instructor: "JewelLink",
    category: "Sales",
    durationLabel: "1 hour",
    blurb: "Grow and manage a personal client book — thoughtful follow-up, outreach, and long-term relationships that drive repeat luxury sales.",
    skills: ["Client book", "Follow-up", "CRM"],
    accent: "#2F7DFF",
    icon: "ops",
    progress: 0,
    certificate: "Participant badge added to your resume on completion.",
    modules: [
      { title: "Your client book", lessons: lessons([["Starting a client book", "Video", 8, false], ["Follow-up that works", "Video", 9, false], ["Outreach & events", "Video", 8, false]]) },
    ],
  },
];

export function getCourse(slug: string): Course | undefined {
  return COURSES.find((c) => c.slug === slug);
}

export function courseStats(c: Course) {
  const all = c.modules.flatMap((m) => m.lessons);
  const done = all.filter((l) => l.completed).length;
  return { total: all.length, done, mins: all.reduce((s, l) => s + l.durationMin, 0) };
}
