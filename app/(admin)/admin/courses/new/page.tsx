"use client";

import { CourseBuilder } from "@/components/CourseBuilder";

export default function NewCoursePage() {
  return <CourseBuilder endpoint="/api/admin/courses" backHref="/admin/courses" redirectTo="/admin/courses" />;
}
