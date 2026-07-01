import { NextResponse } from "next/server";
import { CERT_COMPONENTS, CERT_COURSES } from "@/lib/jewelcert";

export function GET() {
  return NextResponse.json({
    components: CERT_COMPONENTS,
    courses: CERT_COURSES,
  });
}
