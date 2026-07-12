import type { Metadata } from "next";
import Link from "next/link";
import { IconDiamond } from "@/components/icons";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy · JewelHire",
  description: "How JewelHire collects, uses, and shares information.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-page px-5 py-10">
      <article className="mx-auto max-w-[760px] rounded-xl border border-line bg-white p-6 sm:p-10 text-[14px] leading-relaxed text-body">
        <Link href="/login" className="mb-8 inline-flex items-center gap-2 text-head no-underline">
          <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-brand-grad text-white"><IconDiamond size={19} /></span>
          <span className="text-[18px]">Jewel<span className="font-extrabold">Hire</span></span>
        </Link>
        <h1 className="m-0 text-[28px] font-extrabold text-head">Privacy Policy</h1>
        <p className="mt-2 text-[12.5px] text-muted">Effective and last updated: {PRIVACY_POLICY_VERSION}</p>

        <Section title="Information we collect">
          <p>JewelHire collects information you provide when you create an account, apply for a role, complete a profile or resume, take an assessment, respond to an interview, complete training, or contact a participating jewelry business. This may include your name, contact information, work history, education, skills, application activity, assessment responses and results, interview information, and training records.</p>
          <p>We also process limited account, device, request, authentication, security, and service-usage information needed to operate, protect, and troubleshoot the service. Store subscribers provide business, account, billing-reference, and team information.</p>
        </Section>

        <Section title="How we use information">
          <p>We use information to provide applicant and employer workflows, match applications to the correct store and role, deliver assessments and training, schedule interviews, operate accounts and subscriptions, send requested service communications, prevent abuse, secure the service, and improve reliability.</p>
        </Section>

        <Section title="How information is shared">
          <p>Applicant information is shared with the jewelry business associated with the role, application, or invitation. Participating businesses control their own hiring decisions and their use of applicant information. We also use service providers for cloud hosting, databases, authentication, email delivery, media, calendar connections, and payment processing. They receive information only as needed to provide those services.</p>
          <p>We may disclose information when required by law, to protect people or the service, or as part of a business transaction. JewelHire does not sell applicant personal information for advertising.</p>
        </Section>

        <Section title="Choices and rights">
          <p>You can update profile and notification settings from your account. Depending on where you live, you may have rights to access, correct, delete, or obtain a copy of personal information, or to object to certain processing. You may also contact the jewelry business that received your application.</p>
        </Section>

        <Section title="Retention and security">
          <p>We retain information for as long as reasonably needed to provide the service, support hiring and account records, meet legal obligations, resolve disputes, and protect the service. Retention may also depend on the participating business that controls a hiring record. We use administrative, technical, and organizational safeguards, but no system can guarantee absolute security.</p>
        </Section>

        <Section title="International use and children">
          <p>Information may be processed where JewelHire and its service providers operate. JewelHire is intended for people who are legally able to apply for employment or manage a business account in their location; it is not designed for children to use independently.</p>
        </Section>

        <Section title="Changes and contact">
          <p>We may update this policy as the service changes. Material changes will be reflected by a new effective date and, when appropriate, an in-product notice. For privacy questions or requests, contact <a href="mailto:william@jewellink.com" className="text-primary">william@jewellink.com</a>.</p>
        </Section>

        <div className="mt-9 border-t border-line pt-5 text-[12.5px] text-muted">
          Read the <Link href="/terms" className="text-primary">Terms of Service</Link>.
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
