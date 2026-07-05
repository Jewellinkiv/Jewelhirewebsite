"use client";

import { CourseBuilder } from "@/components/CourseBuilder";

const STORE_ID = "store-sissys-little-rock";

export default function NewStoreCoursePage() {
  return (
    <CourseBuilder
      endpoint={`/api/stores/${STORE_ID}/courses`}
      backHref="/courses"
      redirectTo="/courses"
      subheading="Build a course for your store. Add modules in order — finishing every module earns the badge. You can include this course when you send a JewelCert."
    />
  );
}
