import Link from "next/link";
import { EmptyState } from "@/components/states";
import { IconSearch } from "@/components/icons";

export default function NotFound() {
  return (
    <EmptyState
      icon={<IconSearch size={20} />}
      title="Page not found"
      message="We couldn't find that store page."
      action={<Link href="/dashboard" className="btn-grad px-4 py-2 text-[13px] no-underline">Back to dashboard</Link>}
    />
  );
}
