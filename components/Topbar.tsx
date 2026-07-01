import Link from "next/link";
import { IconChevronDown, IconBell, IconSend } from "@/components/icons";
import { PortalSwitcher } from "@/components/PortalSwitcher";
import { MobileNav } from "@/components/MobileNav";

export function Topbar() {
  return (
    <div className="flex items-center gap-3 px-4 lg:px-[22px] py-2.5 bg-panel border-b border-line sticky top-0 z-10">
      <MobileNav />
      <div className="flex items-center gap-2 font-medium text-head cursor-pointer text-[14px] lg:text-base min-w-0">
        <span className="truncate">Sissy&apos;s Log Cabin · Little Rock</span>
        <IconChevronDown size={16} className="text-muted shrink-0" />
      </div>
      <div className="flex-1" />
      <PortalSwitcher current="store_owner" />
      <button className="w-[34px] h-[34px] rounded-md border border-line bg-panel text-muted flex items-center justify-center relative">
        <IconBell size={18} />
        <span className="absolute top-1.5 right-2 w-[7px] h-[7px] rounded-full bg-prof-d border-[1.5px] border-white" />
      </button>
      <Link href="/send-jewelcert" className="btn-grad inline-flex items-center gap-1.5 px-3 sm:px-[17px] py-2.5 text-[13px] no-underline shrink-0">
        <IconSend size={16} /> <span className="hidden sm:inline">Send JewelCert</span>
      </Link>
      <div className="w-[34px] h-[34px] rounded-full bg-[#e8f1ff] text-primary flex items-center justify-center font-semibold text-xs shrink-0">
        WJ
      </div>
    </div>
  );
}
