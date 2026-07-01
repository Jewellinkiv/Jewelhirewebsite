import { NextResponse } from "next/server";
import { ADJECTIVES, PROFILES } from "@/lib/gemmatch";

function adjectiveId(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function GET() {
  const items = ADJECTIVES.map((adjective) => {
    const profile = PROFILES[adjective.profile];
    return {
      id: adjectiveId(adjective.text),
      text: adjective.text,
      profile: adjective.profile,
      profileName: profile.name,
      lane: profile.lane,
      color: profile.color,
    };
  });

  return NextResponse.json({
    count: items.length,
    profiles: PROFILES,
    items,
  });
}
