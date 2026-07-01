import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/server/auth";
import type { AuthSession } from "@/lib/server/auth";

export const runtime = "nodejs";

const week = 60 * 60 * 24 * 7;

const sessions: Record<string, Omit<AuthSession, "exp"> & { destination: string }> = {
  admin: {
    userId: "dev-admin-william",
    name: "William JewelLink",
    email: "william@jewellink.com",
    role: "admin",
    storeIds: ["store-sissys-little-rock", "store-harbor-memphis"],
    activeStoreId: "store-sissys-little-rock",
    destination: "/admin",
    guardrails: {
      phase: "phase_1_single_store",
      applicantScope: "store_private",
      marketplace: false,
      candidateReviews: false,
    },
  },
  store_owner: {
    userId: "user-hiring-manager",
    name: "Jordan Smith",
    email: "jordan@email.com",
    role: "store_owner",
    storeIds: ["store-sissys-little-rock"],
    activeStoreId: "store-sissys-little-rock",
    destination: "/",
    guardrails: {
      phase: "phase_1_single_store",
      applicantScope: "store_private",
      marketplace: false,
      candidateReviews: false,
    },
  },
  applicant: {
    userId: "user-applicant-maya-chen",
    name: "Maya Chen",
    email: "maya.chen@email.com",
    role: "associate",
    storeIds: [],
    activeStoreId: "",
    destination: "/portal",
    guardrails: {
      phase: "phase_1_single_store",
      applicantScope: "store_private",
      marketplace: false,
      candidateReviews: false,
    },
  },
};

function safeNext(value: unknown, fallback: string) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => null)) || {};
  }
  const form = await request.formData().catch(() => null);
  return Object.fromEntries(form?.entries() || []);
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  }

  const body = await readBody(request);
  const key = typeof body.user === "string" ? body.user : "";
  const template = sessions[key];
  if (!template) {
    return NextResponse.json({ error: { code: "invalid_dev_user" } }, { status: 400 });
  }

  const { destination, ...sessionTemplate } = template;
  const session: AuthSession = {
    ...sessionTemplate,
    exp: Math.floor(Date.now() / 1000) + week,
  };
  const response = NextResponse.redirect(new URL(safeNext(body.next, destination), request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: week,
  });
  return response;
}
