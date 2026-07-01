import Link from "next/link";
import { EmptyState } from "@/components/states";
import { IconSearch } from "@/components/icons";

export default function NotFound() {
  return (
    <EmptyState
      icon={<IconSearch size={20} />}
      title="Page not found"
      message="That admin page doesn't exist."
      action={<Link href="/admin" className="btn-grad px-4 py-2 text-[13px] no-underline">Back to overview</Link>}
    />
  );
}
