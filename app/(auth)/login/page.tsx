import { IconDiamond } from "@/components/icons";
import { LegalLinks } from "@/components/LegalLinks";
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
  const jewelLinkConfigured = Boolean(process.env.JEWELLINK_URL && (process.env.JEWELLINK_SSO_SHARED_SECRET || process.env.JEWELHIRE_SSO_SHARED_SECRET));
  const jewelLinkHref = `/api/auth/jewellink/start?next=${encodeURIComponent(next)}`;

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
          Use your JewelHire email and password, or continue with a Google account your store added to the workspace.
        </p>
        {searchParams?.error && (
          <div className="rounded-md border border-[#f2c2c2] bg-[#fff4f4] px-3 py-2 text-[13px] text-[#a32d2d] mb-4">
            {errorMessage(searchParams.error)}
          </div>
        )}
        <form action="/api/auth/password/session" method="post" className="space-y-3 mb-5" data-testid="password-login-form">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="block text-[12px] font-semibold text-muted mb-1">Email</span>
            <input
              autoComplete="email"
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand"
              data-testid="password-login-email"
              name="email"
              placeholder="you@store.com"
              required
              type="email"
            />
          </label>
          <label className="block">
            <span className="block text-[12px] font-semibold text-muted mb-1">Password</span>
            <input
              autoComplete="current-password"
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[14px] text-head outline-none focus:border-brand"
              data-testid="password-login-password"
              name="password"
              placeholder="Your password"
              required
              type="password"
            />
          </label>
          <button className="btn-grad w-full inline-flex items-center justify-center px-5 py-3 text-[14px]" data-testid="password-login-submit" type="submit">
            Sign in with email
          </button>
          <div className="text-center">
            <a href="/forgot-password" className="text-[12.5px] text-primary no-underline hover:underline">Forgot your password?</a>
          </div>
        </form>
        <div className="relative my-5 text-center text-[12px] text-muted">
          <span className="bg-white px-3 relative z-10">or</span>
          <span className="absolute left-0 right-0 top-1/2 h-px bg-line" aria-hidden="true" />
        </div>
        {firebaseConfigured && <FirebaseGoogleButton next={next} config={firebaseConfig} />}
        {configured && (
          <a href={googleHref} className={`${firebaseConfigured ? "mt-3 " : ""}btn-grad w-full inline-flex items-center justify-center px-5 py-3 text-[14px] no-underline`}>
            Continue with Google
          </a>
        )}
        {jewelLinkConfigured && (
          <a href={jewelLinkHref} className="mt-3 w-full inline-flex items-center justify-center rounded-md border border-line bg-white px-5 py-3 text-[14px] font-semibold text-head no-underline hover:bg-[#f8fafc]">
            Continue with JewelLink
          </a>
        )}
        {!configured && !firebaseConfigured && (
          <div className="rounded-md border border-line bg-[#f8fafc] px-3 py-2 text-[13px] text-muted">
            Google sign-in needs OAuth or Firebase credentials configured before live login can start.
          </div>
        )}
        <p className="text-center text-[12.5px] text-muted mt-6 mb-1">
          New here? <a href="/signup" className="text-primary no-underline hover:underline">Create an applicant account</a>
        </p>
        <p className="text-center text-[12.5px] text-muted mt-0 mb-0">
          Own a store? <a href="/signup/store" className="text-primary no-underline hover:underline">Start your store on JewelHire</a>
        </p>
        <div className="mt-5 text-center text-[11.5px] text-muted"><LegalLinks /></div>
      </section>
    </main>
  );
}

function errorMessage(error: string) {
  switch (error) {
    case "unauthorized":
      return "That Google account is not active in JewelHire yet.";
    case "password":
      return "That email and password could not be verified.";
    case "password_config":
      return "Email/password login is not configured for this environment yet.";
    case "too_many":
      return "Too many sign-in attempts. Please wait a few minutes and try again.";
    case "jewellink_required":
      return "This account, including every platform administrator, signs in only through JewelLink MFA. Continue with JewelLink below.";
    case "jewellink_state":
      return "That JewelLink sign-in was opened in another browser or has already been used. Start again with Continue with JewelLink.";
    case "jewellink_assurance":
      return "JewelLink could not confirm a recent MFA sign-in. Return to JewelLink, complete MFA, and launch JewelHire again.";
    case "jewellink_identity":
      return "That email is already attached to a different JewelHire identity. Contact support before linking this JewelLink account.";
    case "jewellink_code":
    case "jewellink_exchange":
      return "That JewelLink sign-in link is invalid or expired. Please launch JewelHire from JewelLink again.";
    case "jewellink_access":
      return "Your JewelLink account is not eligible for JewelHire access yet.";
    case "jewellink_config":
      return "JewelLink sign-in is being connected for this environment. Please return to JewelLink or contact your administrator.";
    default:
      return "We could not complete sign in. Try again.";
  }
}
