import { IconDiamond } from "@/components/icons";
import { googleAuthConfigured } from "@/lib/server/auth";
import { firebaseAuthConfigured, firebaseClientConfig } from "@/lib/server/firebase-auth";
import { FirebaseGoogleButton } from "./FirebaseGoogleButton";

export default async function LoginPage(props: { searchParams?: Promise<{ next?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const next = searchParams?.next || "/";
  const googleHref = `/api/auth/google/start?next=${encodeURIComponent(next)}`;
  const configured = googleAuthConfigured();
  const firebaseConfigured = firebaseAuthConfigured();
  const firebaseConfig = firebaseClientConfig();

  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-[420px] bg-white border border-line rounded-lg shadow-sm p-8">
        <div className="flex items-center gap-2.5 mb-7">
          <span className="w-9 h-9 rounded-[9px] bg-brand-grad text-white flex items-center justify-center">
            <IconDiamond size={20} />
          </span>
          <span className="text-[20px] text-head font-medium">
            Jewel<span className="font-extrabold">Hire</span>
          </span>
        </div>
        <h1 className="text-[26px] leading-tight font-extrabold text-head m-0">Sign in to JewelHire</h1>
        <p className="text-[14px] text-muted leading-relaxed mt-3 mb-6">
          Use the Google account your store or JewelHire admin added to the workspace.
        </p>
        {searchParams?.error && (
          <div className="rounded-md border border-[#f2c2c2] bg-[#fff4f4] px-3 py-2 text-[13px] text-[#a32d2d] mb-4">
            {searchParams.error === "unauthorized" ? "That Google account is not active in JewelHire yet." : "We could not complete sign in. Try again."}
          </div>
        )}
        {firebaseConfigured && <FirebaseGoogleButton next={next} config={firebaseConfig} />}
        {configured && (
          <a href={googleHref} className={`${firebaseConfigured ? "mt-3 " : ""}btn-grad w-full inline-flex items-center justify-center px-5 py-3 text-[14px] no-underline`}>
            Continue with Google
          </a>
        )}
        {!configured && !firebaseConfigured && (
          <div className="rounded-md border border-line bg-[#f8fafc] px-3 py-2 text-[13px] text-muted">
            Google sign-in needs OAuth or Firebase credentials configured before live login can start.
          </div>
        )}
      </section>
    </main>
  );
}
