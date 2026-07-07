import { NextResponse } from "next/server";
import { ADJECTIVE_ITEMS } from "@/lib/gemmatch-adjectives";

// Returns adjectives as TEXT ONLY — never the profile/trait each word scores
// into. Exposing that mapping (as this used to) hands the assessment answer key
// to the client. Scoring is server-side (see /api/gemmatch/responses).
export function GET() {
  return NextResponse.json({ count: ADJECTIVE_ITEMS.length, items: ADJECTIVE_ITEMS });
}
