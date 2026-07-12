import Link from "next/link";

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      <Link href="/privacy" className="text-primary no-underline hover:underline">Privacy</Link>
      <span aria-hidden="true"> · </span>
      <Link href="/terms" className="text-primary no-underline hover:underline">Terms</Link>
    </span>
  );
}
