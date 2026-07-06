import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/server/access-control";
import { cloudinaryPublicConfig, signCloudinaryParams } from "@/lib/server/cloudinary";

export const runtime = "nodejs";

// Issues a short-lived signed upload payload so a course builder can upload a
// video straight to Cloudinary from the browser. Restricted to course authors
// (admins + store owners) so applicants can't push files to our Cloudinary.
export async function POST() {
  const session = await getSessionContext().catch(() => null);
  if (!session || session.role === "associate") {
    return NextResponse.json({ error: { code: "forbidden", message: "Not allowed." } }, { status: 403 });
  }
  const pub = cloudinaryPublicConfig();
  if (!pub) {
    return NextResponse.json({ error: { code: "not_configured", message: "Video upload isn't configured on the server." } }, { status: 503 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "jewelhire/courses";
  // Only folder + timestamp are signed/enforced; the upload lands in our folder
  // and the signature expires (Cloudinary rejects stale timestamps).
  const signature = signCloudinaryParams({ folder, timestamp });
  return NextResponse.json({ cloudName: pub.cloudName, apiKey: pub.apiKey, timestamp, folder, signature });
}
