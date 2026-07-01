import { NextResponse } from "next/server";
import { RESUME_TEMPLATES } from "@/lib/resume-templates";

export function GET() {
  return NextResponse.json({
    count: RESUME_TEMPLATES.length,
    items: RESUME_TEMPLATES,
  });
}
