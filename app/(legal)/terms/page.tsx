import type { Metadata } from "next";
import Link from "next/link";
import { IconDiamond } from "@/components/icons";
import { TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service · JewelHire",
  description: "Terms governing use of JewelHire.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-page px-5 py-10">
      <article className="mx-auto max-w-[760px] rounded-xl border border-line bg-white p-6 sm:p-10 text-[14px] leading-relaxed text-body">
        <Link href="/login" className="mb-8 inline-flex items-center gap-2 text-head no-underline">
          <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-brand-grad text-white"><IconDiamond size={19} /></span>
          <span className="text-[18px]">Jewel<span className="font-extrabold">Hire</span></span>
        </Link>
        <h1 className="m-0 text-[28px] font-extrabold text-head">Terms of Service</h1>
        <p className="mt-2 text-[12.5px] text-muted">Effective and last updated: {TERMS_VERSION}</p>
        <p className="mt-6">These Terms govern access to JewelHire. By creating an account, submitting an application, or using the service, you agree to these Terms and the <Link href="/privacy" className="text-primary">Privacy Policy</Link>.</p>

        <Section title="Accounts and eligibility">
          <p>You must provide accurate information, keep credentials secure, and use only accounts you are authorized to use. You are responsible for activity under your account and should promptly report suspected unauthorized access.</p>
        </Section>

        <Section title="Applicant services">
          <p>JewelHire helps applicants share information with participating jewelry businesses, complete assessments and training, and manage hiring activity. Submitting an application does not guarantee an interview, offer, employment, or any particular outcome. Assessment and fit information is one input for participating businesses and must not be treated as the sole basis for an employment decision.</p>
        </Section>

        <Section title="Employer and store responsibilities">
          <p>Business subscribers are responsible for their job postings, hiring decisions, authorized users, applicant communications, and compliance with employment, privacy, accessibility, anti-discrimination, recordkeeping, and other applicable laws. Businesses may use applicant information only for legitimate hiring and workforce purposes.</p>
        </Section>

        <Section title="Subscriptions and payments">
          <p>Paid subscriptions are processed through the checkout terms displayed at purchase. Prices, billing periods, promotions, renewals, and cancellation terms shown in checkout or an applicable order control the subscription. Payment processing is provided by a third party and JewelHire does not store full payment-card details.</p>
        </Section>

        <Section title="Acceptable use">
          <p>You may not misuse the service, access another person&apos;s or business&apos;s data without authorization, interfere with security or availability, introduce malicious code, scrape or reverse engineer protected portions of the service, send unlawful or deceptive content, or use assessments or applicant information unlawfully.</p>
        </Section>

        <Section title="Content and intellectual property">
          <p>You retain rights in content you submit and grant JewelHire the limited rights needed to host, process, display, and transmit it to provide the service. JewelHire and its licensors retain rights in the service, software, branding, assessment materials, training content, and related intellectual property.</p>
        </Section>

        <Section title="Third-party services">
          <p>The service may connect to payment, email, authentication, calendar, media, and other third-party services. Their terms and privacy practices apply to their services, and their availability is outside JewelHire&apos;s control.</p>
        </Section>

        <Section title="Service changes, suspension, and termination">
          <p>We may update the service, suspend access needed to protect users or systems, or discontinue features. You may stop using the service at any time. Provisions that by their nature should survive termination—including ownership, payment obligations, disclaimers, and limits of liability—will survive.</p>
        </Section>

        <Section title="Disclaimers and liability">
          <p>The service is provided on an “as available” basis to the extent permitted by law. JewelHire does not guarantee uninterrupted operation, hiring outcomes, candidate performance, or that every error will be corrected. To the maximum extent permitted by law, JewelHire will not be liable for indirect, incidental, special, consequential, or punitive damages, lost profits, or lost business opportunities arising from use of the service.</p>
        </Section>

        <Section title="Changes and contact">
          <p>We may update these Terms as the service changes. Material changes will be reflected by a new effective date and, when appropriate, an in-product notice. Questions may be sent to <a href="mailto:william@jewellink.com" className="text-primary">william@jewellink.com</a>.</p>
        </Section>

        <div className="mt-9 border-t border-line pt-5 text-[12.5px] text-muted">
          Read the <Link href="/privacy" className="text-primary">Privacy Policy</Link>.
        </div>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="m-0 text-[17px] font-semibold text-head">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
