import { IconLogout } from "@/components/icons";

export function LogoutButton({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const label = "Log out";
  return (
    <form action="/api/auth/logout" method="post" className="shrink-0">
      <button
        type="submit"
        aria-label={label}
        title={label}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md border font-medium ${
          compact ? "w-[34px] h-[34px]" : "px-3 py-2 text-[12.5px]"
        } ${
          dark
            ? "border-[#1c2942] text-[#f1a6a6] hover:bg-[#16243d]"
            : "border-line bg-panel text-[#a32d2d] hover:bg-[#fcebeb]"
        }`}
      >
        <IconLogout size={15} />
        {!compact && <span>Log out</span>}
      </button>
    </form>
  );
}
