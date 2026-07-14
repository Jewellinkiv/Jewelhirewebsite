import { after } from "next/server";
import { handlePasswordResetRequest } from "@/lib/server/password-reset-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handlePasswordResetRequest(request, (task) => after(task));
}
