"use client";

import { CourseBuilder } from "@/components/CourseBuilder";
import { useActiveStoreId } from "@/lib/client-session";

const FALLBACK_STORE_ID = "store-sissys-little-rock";

export default function NewStoreCoursePage() {
  const STORE_ID = useActiveStoreId(FALLBACK_STORE_ID);
  return (
    <CourseBuilder
      endpoint={`/api/stores/${STORE_ID}/courses`}
      backHref="/courses"
      redirectTo="/courses"
      subheading="Build a course for your store. Add modules in order — finishing every module earns the badge. You can include this course when you send a JewelCert."
    />
  );
}
