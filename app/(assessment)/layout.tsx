import { JewelCertBrand } from "@/components/JewelCertBrand";

// Focused, distraction-free shell for taking an assessment. Unlike the portal
// (AssociateShell), there is intentionally no nav — an applicant on their phone
// should see only the test and the JewelCert brand while completing it.
export default function AssessmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-page flex flex-col">
      <header className="bg-white border-b border-line sticky top-0 z-30">
        <div className="w-full max-w-[680px] mx-auto px-4 h-[56px] flex items-center">
          <JewelCertBrand />
        </div>
      </header>
      <main className="flex-1 w-full max-w-[680px] mx-auto px-4 flex flex-col">{children}</main>
    </div>
  );
}
