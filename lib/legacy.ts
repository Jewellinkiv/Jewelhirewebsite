export type LegacyAssessmentType = "Trait profile" | "Knowledge check";

export interface LegacyAssessment {
  title: string;
  type: LegacyAssessmentType;
  durationMinutes: number;
  questionCount: number;
  targets: string[];
  media: string[];
  migrationNote: string;
}

export const LEGACY_ASSESSMENTS: LegacyAssessment[] = [
  {
    title: "12 Essentials: Understanding your potential",
    type: "Trait profile",
    durationMinutes: 60,
    questionCount: 36,
    targets: [
      "Passion",
      "Self-Motivation",
      "Accountability",
      "Adaptability",
      "Integrity",
      "Problem-Solving Ability",
      "Teamwork",
      "Communication Skills",
      "Customer Focus",
      "Growth Mindset",
      "Results Orientation",
      "Resilience",
    ],
    media: ["12essentialstest.mp4", "SMP1Png File.png"],
    migrationNote: "Keep as legacy comparison data; consider folding into JewelCert coaching notes.",
  },
  {
    title: "Sales Personality Profiling Test",
    type: "Trait profile",
    durationMinutes: 30,
    questionCount: 24,
    targets: [
      "Strategic Closer",
      "Assertive Negotiator",
      "Relationship Champion",
      "Detail-Oriented Educator",
    ],
    media: ["4traitstest.mp4", "SMP2Png File.png"],
    migrationNote: "Use as a bridge from legacy sales traits to the new JewelCert profile language.",
  },
  {
    title: "Jewelry Basic Knowledge Assessment",
    type: "Knowledge check",
    durationMinutes: 60,
    questionCount: 22,
    targets: [
      "Metals",
      "Gemstones",
      "Diamonds",
      "Jewelry Types",
      "Jewelry Settings and Mountings",
      "Watches",
      "Jewelry Repairs",
    ],
    media: ["basic knowledgetest.mp4", "SMP2Png File.png"],
    migrationNote: "Seed as an answer-key knowledge check with category scoring and training recommendations.",
  },
];

export type CourseStatus = "Published" | "Unpublished";

export interface LegacyCourse {
  title: string;
  status: CourseStatus;
  durationHours: number;
  owner: string;
  place: string;
  type: string;
  coverImage: string;
  summary: string;
  video?: string;
}

export type CourseReadiness = "Ready to seed" | "Needs media" | "Needs review";

export interface LegacyCourseLesson {
  title: string;
  skills: string[];
  videoFilename: string;
  status: "Documented" | "Needs URL";
  summary: string;
}

export interface CourseReadinessItem {
  title: string;
  audience: string;
  readiness: CourseReadiness;
  lessonCount: number;
  warnings: string[];
}

export interface TrainingAssignment {
  person: string;
  role: string;
  course: string;
  context: string;
  progress: number;
  status: "Assigned" | "In progress" | "Complete" | "Blocked";
}

export interface FeaturedCourseDetail {
  slug: string;
  title: string;
  audience: string;
  category: string;
  owner: string;
  durationHours: number;
  status: CourseStatus;
  moduleTitle: string;
  summary: string;
  coverImage: string;
  badgeImage: string;
  courseVideo: string;
  publishChecks: {
    label: string;
    state: "Pass" | "Warning" | "Blocked";
    detail: string;
  }[];
  assignmentRules: string[];
  learnerMilestones: string[];
}

export interface LearnerPreview {
  learnerName: string;
  role: string;
  assignedBy: string;
  progress: number;
  activeLessonIndex: number;
  lessonStates: ("Complete" | "Active" | "Locked")[];
  materials: {
    title: string;
    state: "Available" | "Pending asset";
    note: string;
  }[];
  finalCheck: {
    title: string;
    questions: number;
    passingScore: string;
    state: "Locked" | "Available";
  };
}

export interface CourseAssignmentDraft {
  dueInDays: number;
  assignmentContext: string;
  managerMessage: string;
  recipients: {
    name: string;
    role: string;
    source: "Candidate" | "Roster";
    eligibility: "Eligible" | "Review";
    reason: string;
  }[];
  createdRecords: string[];
  deliveryChecks: {
    label: string;
    state: "Ready" | "Warning";
    detail: string;
  }[];
}

export interface CourseAssignmentConfirmation {
  draftId: string;
  status: "Draft" | "Ready to send" | "Blocked";
  summary: {
    label: string;
    value: string;
    detail: string;
  }[];
  enrollments: {
    person: string;
    recordType: "Course Enrollment" | "Review Hold";
    status: "Drafted" | "Held";
    due: string;
    note: string;
  }[];
  notifications: {
    channel: string;
    recipient: string;
    state: "Queued" | "Suppressed";
    message: string;
  }[];
  auditTrail: string[];
  blockers: string[];
}

export interface CourseMediaResolver {
  unresolvedCount: number;
  resolvedCount: number;
  sources: {
    label: string;
    state: "Available" | "Needs access" | "Manual";
    detail: string;
  }[];
  assets: {
    usage: string;
    filename: string;
    source: string;
    status: "Resolved" | "Needs URL" | "Needs review";
    nextStep: string;
  }[];
  publishGate: {
    label: string;
    state: "Pass" | "Blocked" | "Warning";
    detail: string;
  }[];
}

export const LEGACY_COURSES: LegacyCourse[] = [
  {
    title: "JewelLink Premium How to",
    status: "Published",
    durationHours: 20,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "SMP2Png File.png",
    summary: "JewelLink tools for recruitment, onboarding, training, and employee engagement.",
  },
  {
    title: "Individual Account How To",
    status: "Published",
    durationHours: 20,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "SMP1Png File.png",
    summary: "JewelLink for job seekers and jewelry professionals.",
  },
  {
    title: "Building and Managing a High-Performance Sales Team",
    status: "Published",
    durationHours: 1,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "management.jpg",
    summary: "Recruiting, developing, and managing high-performing jewelry sales teams.",
  },
  {
    title: "The Art of Experience in Jewelry Sales",
    status: "Published",
    durationHours: 1,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "shutterstock_2400843241.jpg",
    summary: "Consistent, engaging customer experiences in jewelry sales.",
  },
  {
    title: "One Piece Rule",
    status: "Published",
    durationHours: 1,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "shutterstock_772456309.jpg",
    summary: "Customer interaction and presentation training.",
  },
  {
    title: "Adding Value in the Jewelry Industry",
    status: "Published",
    durationHours: 1,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "shutterstock_2490342135.jpg",
    summary: "Creating value through stronger customer experiences.",
  },
  {
    title: "First Impressions",
    status: "Published",
    durationHours: 1,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "shutterstock_692204281.jpg",
    summary: "How sales professionals create strong first impressions.",
  },
  {
    title: "Team Etiquette Essentials (Job Seeker)",
    status: "Published",
    durationHours: 0.5,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "shutterstock_2489916669.jpg",
    summary: "Store and team etiquette for jewelry sales associates.",
  },
  {
    title: "Mastering the Four C's: A Guide to Diamond Excellence",
    status: "Published",
    durationHours: 0.5,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "shutterstock_1766030882.jpg",
    summary: "Diamond knowledge and confidence for sales associates.",
  },
  {
    title: "Jewelry Business Model: Building Customer-Centric Success",
    status: "Published",
    durationHours: 0.5,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "shutterstock_2485923623.jpg",
    summary: "Customer relationships and the jewelry business model.",
  },
  {
    title: "Inventory Security in Retail Jewelry: Protecting Assets and Ensuring Safety",
    status: "Published",
    durationHours: 0.5,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "shutterstock_2123020886.jpg",
    summary: "Inventory risk, asset protection, and retail store safety.",
  },
  {
    title: "Mastering Key Performance Indicators (KPIs) in Jewelry Sales",
    status: "Published",
    durationHours: 1,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "shutterstock_2508942019.jpg",
    summary: "Sales KPIs for jewelry sales success.",
  },
  {
    title: "Effective Onboarding: Building Strong Foundations for Success",
    status: "Published",
    durationHours: 1,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "management.jpg",
    summary: "Clear expectations and foundation-setting for new hires.",
  },
  {
    title: "Understanding Personality Traits for Effective Sales Teams",
    status: "Published",
    durationHours: 1,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "management.jpg",
    summary: "Assertive, Recessive, Emotional, and Product-Based traits for teams.",
  },
  {
    title: "4 Personality Traits for Sales Success",
    status: "Published",
    durationHours: 1,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "management.jpg",
    summary: "How the four sales traits affect sales performance.",
  },
  {
    title: "Jewelry Basics: Terminology, Metals, and Maintenance",
    status: "Published",
    durationHours: 1,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "shutterstock_2304033839.jpg",
    summary: "Foundational terminology, metal types, and common repairs.",
  },
  {
    title: "Building a Staffing Matrix for Jewelry Stores",
    status: "Published",
    durationHours: 0.5,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "management.jpg",
    summary: "Staffing matrix planning from store needs and service patterns.",
  },
  {
    title: "Introduction to JewelLink: Revolutionizing Recruitment and Team Development",
    status: "Published",
    durationHours: 0.5,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "SMP2Png File.png",
    summary: "JewelLink as a recruiting, onboarding, and development tool.",
  },
  {
    title: "Diamond Product Knowledge Book",
    status: "Published",
    durationHours: 2,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "shutterstock_2501691699.jpg",
    summary: "Diamond product knowledge basics.",
  },
  {
    title: "Becoming a Top-Tier Jewelry Sales Professional",
    status: "Published",
    durationHours: 0.5,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "AdobeStock_549433335.jpeg",
    summary: "Sales associate growth into top-tier jewelry sales professionalism.",
  },
  {
    title: "Overview of The 4 Sales Traits",
    status: "Unpublished",
    durationHours: 6,
    owner: "John Matthews / William Jones",
    place: "Online",
    type: "Standard",
    coverImage: "woman-owning-small-business-for-optical-shop-2023-11-27-05-30-04-utc.jpg",
    summary: "Five-part draft about Recessive, Product-Based, Assertive, and Emotional sales traits.",
    video: "Traits.m4v",
  },
  {
    title: "Basic Etiquette",
    status: "Unpublished",
    durationHours: 2,
    owner: "John Matthews",
    place: "Online",
    type: "Standard",
    coverImage: "gift-for-the-favourite-2024-09-19-06-31-39-utc.jpg",
    summary: "Seventeen-part draft about teamwork, procedure, and basic store etiquette.",
  },
  {
    title: "Always be recruiting",
    status: "Unpublished",
    durationHours: 1,
    owner: "John Matthews",
    place: "Online",
    type: "Standard",
    coverImage: "Heights Store.JPG",
    summary: "Three-part draft about ongoing recruiting and training.",
  },
  {
    title: "Mastering the 4C's of Diamond Value",
    status: "Unpublished",
    durationHours: 1,
    owner: "JewelLink",
    place: "Online",
    type: "Standard",
    coverImage: "Screen Shot 2024-08-13 at 1.35.09 PM.png",
    summary: "Diamond value and selling confidence using the 4Cs.",
  },
];

export const FEATURED_COURSE_LESSONS: LegacyCourseLesson[] = [
  {
    title: "Setting Up Your Store Profile",
    skills: ["business", "profile"],
    videoFilename: "business%20profile_1.mp4",
    status: "Needs URL",
    summary: "Store profile setup, business information, brand presentation, and employer visibility.",
  },
  {
    title: "JewelCert: Assessing Candidate Potential",
    skills: ["Skills 1"],
    videoFilename: "jewelcert.mp4",
    status: "Needs URL",
    summary: "Using JewelCert to evaluate candidates and bring assessment evidence into hiring decisions.",
  },
  {
    title: "Posting a Job",
    skills: ["post a job"],
    videoFilename: "posting%20a%20job.mp4",
    status: "Needs URL",
    summary: "Creating job posts and connecting hiring needs to applicants inside the platform.",
  },
  {
    title: "Managing Your Team with JewelLink",
    skills: ["team"],
    videoFilename: "my%20team.mp4",
    status: "Needs URL",
    summary: "Team management, roster visibility, and using JewelLink as the ongoing employee hub.",
  },
  {
    title: "Training Center: Building a Knowledgeable Team",
    skills: ["training", "center"],
    videoFilename: "training%20center.mp4",
    status: "Needs URL",
    summary: "Training Center courses, product knowledge, onboarding, badges, progress, and manager insight.",
  },
  {
    title: "Leveraging Social Features and Reviews",
    skills: ["social", "network"],
    videoFilename: "social%20and%20reviews.mp4",
    status: "Needs URL",
    summary: "Social/review features, achievements, community, reputation, employee reviews, comments, and likes.",
  },
];

export const FEATURED_COURSE_DETAIL: FeaturedCourseDetail = {
  slug: "jewellink-premium-how-to",
  title: "JewelLink Premium How to",
  audience: "Store owners",
  category: "Standard Training",
  owner: "JewelLink",
  durationHours: 20,
  status: "Published",
  moduleTitle: "Business Owners",
  summary: "JewelLink tools for recruitment, onboarding, training, team management, social proof, and employee engagement.",
  coverImage: "SMP2Png File.png",
  badgeImage: "badge-image.svg",
  courseVideo: "Legacy course-level video field observed, filename not exposed in current lesson editor pass.",
  publishChecks: [
    { label: "General course fields", state: "Pass", detail: "Title, category, duration, owner, audience, and publish status captured." },
    { label: "Module and lesson order", state: "Pass", detail: "Business Owners module and six lesson rows captured in order." },
    { label: "Lesson media URLs", state: "Blocked", detail: "Six lesson videos expose filenames only; full Bubble/CDN URLs still need resolution." },
    { label: "Lesson materials", state: "Warning", detail: "Download slots exist, but no attached material filenames were visible." },
    { label: "Skill taxonomy", state: "Warning", detail: "One lesson still carries placeholder source value `Skills 1`." },
  ],
  assignmentRules: [
    "Available to store owners and employer admins after v2 entitlement checks.",
    "Assignable from onboarding plans, roster development plans, and candidate-to-hire transitions.",
    "Not used as a primary pre-hire screen; JewelCert and aptitude assessments own screening evidence.",
    "Completion can create a manager-visible badge when all lessons and the final check are complete.",
  ],
  learnerMilestones: [
    "Open course and confirm store profile setup context.",
    "Complete all six Business Owners lessons.",
    "Review downloadable materials when available.",
    "Pass final knowledge check if a course test is attached.",
    "Earn completion status for manager dashboard and team development records.",
  ],
};

export const FEATURED_LEARNER_PREVIEW: LearnerPreview = {
  learnerName: "Sara Pope",
  role: "Bridal Specialist",
  assignedBy: "Maria King",
  progress: 42,
  activeLessonIndex: 2,
  lessonStates: ["Complete", "Complete", "Active", "Locked", "Locked", "Locked"],
  materials: [
    {
      title: "Store profile setup checklist",
      state: "Pending asset",
      note: "Legacy editor showed material upload slots, but no file was visible.",
    },
    {
      title: "JewelCert manager review guide",
      state: "Pending asset",
      note: "Add v2 downloadable once source document is confirmed.",
    },
  ],
  finalCheck: {
    title: "Business Owners completion check",
    questions: 8,
    passingScore: "6 correct",
    state: "Locked",
  },
};

export const FEATURED_ASSIGNMENT_DRAFT: CourseAssignmentDraft = {
  dueInDays: 14,
  assignmentContext: "Post-hire onboarding and current-team development",
  managerMessage:
    "Please complete the JewelLink Premium How to course so your team setup, training center, and review workflows are ready for v2.",
  recipients: [
    {
      name: "Sara Pope",
      role: "Bridal Specialist",
      source: "Roster",
      eligibility: "Eligible",
      reason: "Current-team development assignment for training center and review workflows.",
    },
    {
      name: "Maria King",
      role: "Sales Manager",
      source: "Roster",
      eligibility: "Eligible",
      reason: "Manager owns team onboarding and should complete store-owner flow first.",
    },
    {
      name: "Maya Chen",
      role: "Sales Associate candidate",
      source: "Candidate",
      eligibility: "Review",
      reason: "Use only after hire or offer stage; training should not replace screening.",
    },
  ],
  createdRecords: [
    "Course enrollment for each eligible learner",
    "Lesson completion shell for all six Business Owners lessons",
    "Manager progress row tied to roster or candidate-to-hire context",
    "Completion badge placeholder after final check is passed",
    "Notification task with due date and manager message",
  ],
  deliveryChecks: [
    {
      label: "Audience entitlement",
      state: "Ready",
      detail: "Store owner and employer admin audience is modeled before assignment.",
    },
    {
      label: "Media readiness",
      state: "Warning",
      detail: "Assignment can be drafted, but publishing should wait for full lesson video URLs.",
    },
    {
      label: "Screening separation",
      state: "Ready",
      detail: "Candidate recipients are marked for post-hire use, not pre-hire aptitude screening.",
    },
  ],
};

export const FEATURED_ASSIGNMENT_CONFIRMATION: CourseAssignmentConfirmation = {
  draftId: "TRN-DRAFT-1042",
  status: "Blocked",
  summary: [
    { label: "Eligible enrollments", value: "2", detail: "Sara Pope and Maria King can receive the assignment." },
    { label: "Review holds", value: "1", detail: "Maya Chen is held until candidate-to-hire transition." },
    { label: "Lesson shells", value: "12", detail: "Six lessons per eligible learner." },
    { label: "Send state", value: "Blocked", detail: "Lesson media URLs must be resolved before sending." },
  ],
  enrollments: [
    {
      person: "Sara Pope",
      recordType: "Course Enrollment",
      status: "Drafted",
      due: "14 days after send",
      note: "Current-team development assignment with lesson shells ready.",
    },
    {
      person: "Maria King",
      recordType: "Course Enrollment",
      status: "Drafted",
      due: "14 days after send",
      note: "Manager assignment for store-owner workflow ownership.",
    },
    {
      person: "Maya Chen",
      recordType: "Review Hold",
      status: "Held",
      due: "After hire",
      note: "Candidate assignment waits for offer/hire stage to preserve screening separation.",
    },
  ],
  notifications: [
    {
      channel: "Email",
      recipient: "Sara Pope",
      state: "Queued",
      message: "Training assignment notification will send when publish blockers clear.",
    },
    {
      channel: "In-app",
      recipient: "Maria King",
      state: "Queued",
      message: "Manager dashboard task will appear with due date and progress tracking.",
    },
    {
      channel: "Candidate timeline",
      recipient: "Maya Chen",
      state: "Suppressed",
      message: "No candidate notification until manager confirms post-hire assignment.",
    },
  ],
  auditTrail: [
    "Assignment draft created from JewelLink Premium How to.",
    "Audience entitlement checked against store-owner/employer-admin rules.",
    "Two roster recipients converted into enrollment drafts.",
    "One candidate recipient placed on review hold.",
    "Media readiness warning promoted to send blocker.",
  ],
  blockers: [
    "Resolve six lesson video filenames into full stored URLs.",
    "Confirm whether downloadable materials exist for the Business Owners module.",
    "Replace or approve the placeholder skill value `Skills 1` before publish.",
  ],
};

export const FEATURED_MEDIA_RESOLVER: CourseMediaResolver = {
  unresolvedCount: 9,
  resolvedCount: 2,
  sources: [
    {
      label: "Bubble editor",
      state: "Available",
      detail: "Admin UI exposes filenames and upload slots, but not every stored URL.",
    },
    {
      label: "Bubble data/API",
      state: "Needs access",
      detail: "Use course and lesson records to resolve stored file URLs for import.",
    },
    {
      label: "Network inspection",
      state: "Manual",
      detail: "Fallback path if the editor serves media through signed or transformed URLs.",
    },
  ],
  assets: [
    {
      usage: "Course cover",
      filename: "SMP2Png File.png",
      source: "Course editor",
      status: "Resolved",
      nextStep: "Keep as cover asset and verify final image dimensions.",
    },
    {
      usage: "Course badge",
      filename: "badge-image.svg",
      source: "Course editor",
      status: "Needs review",
      nextStep: "Confirm actual badge file or replace with v2 completion badge.",
    },
    ...FEATURED_COURSE_LESSONS.map((lesson) => ({
      usage: "Lesson video",
      filename: lesson.videoFilename,
      source: lesson.title,
      status: "Needs URL" as const,
      nextStep: "Resolve full Bubble/CDN storage URL before learner playback can publish.",
    })),
    {
      usage: "Download materials",
      filename: "No filename visible",
      source: "Business Owners module",
      status: "Needs review",
      nextStep: "Confirm whether material uploads exist or create v2 downloadable checklists.",
    },
  ],
  publishGate: [
    {
      label: "Learner playback",
      state: "Blocked",
      detail: "Six lesson videos have filenames but no full storage URL.",
    },
    {
      label: "Assignment send",
      state: "Blocked",
      detail: "Drafts can be created, but notifications should not send until media URLs are resolved.",
    },
    {
      label: "Course metadata",
      state: "Pass",
      detail: "Title, audience, module, lesson order, and visible lesson summaries are ready.",
    },
    {
      label: "Materials",
      state: "Warning",
      detail: "Download upload slots were visible, but source files were not exposed.",
    },
  ],
};

export const COURSE_READINESS_QUEUE: CourseReadinessItem[] = [
  {
    title: "JewelLink Premium How to",
    audience: "Store owners",
    readiness: "Needs media",
    lessonCount: FEATURED_COURSE_LESSONS.length,
    warnings: ["Resolve six lesson video URLs", "Replace placeholder skill tag", "Confirm downloadable materials"],
  },
  {
    title: "Jewelry Basic Knowledge Assessment",
    audience: "Candidates and team",
    readiness: "Ready to seed",
    lessonCount: 0,
    warnings: ["Keep as assessment seed, not course test"],
  },
  {
    title: "Overview of The 4 Sales Traits",
    audience: "Managers",
    readiness: "Needs review",
    lessonCount: 5,
    warnings: ["Unpublished draft", "Confirm whether to fold into JewelCert language"],
  },
  {
    title: "Basic Etiquette",
    audience: "New hires",
    readiness: "Needs review",
    lessonCount: 17,
    warnings: ["Unpublished draft", "Review duplicated onboarding content"],
  },
];

export const TRAINING_ASSIGNMENTS: TrainingAssignment[] = [
  {
    person: "Maya Chen",
    role: "Sales Associate candidate",
    course: "Diamond Fundamentals",
    context: "Post-offer onboarding path",
    progress: 64,
    status: "In progress",
  },
  {
    person: "Devon Ross",
    role: "Bench Jeweler candidate",
    course: "Inventory Security in Retail Jewelry",
    context: "Role-specific risk training",
    progress: 0,
    status: "Assigned",
  },
  {
    person: "Sara Pope",
    role: "Bridal Specialist",
    course: "Training Center: Building a Knowledgeable Team",
    context: "Current-team development",
    progress: 100,
    status: "Complete",
  },
  {
    person: "Tomás Lee",
    role: "Repair Coordinator",
    course: "Jewelry Basics: Terminology, Metals, and Maintenance",
    context: "Manager-assigned development",
    progress: 22,
    status: "In progress",
  },
];

export const LEGACY_COURSE_TOTALS = {
  published: LEGACY_COURSES.filter((c) => c.status === "Published").length,
  unpublished: LEGACY_COURSES.filter((c) => c.status === "Unpublished").length,
  total: LEGACY_COURSES.length,
};
