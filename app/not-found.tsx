import Link from "next/link";
import { IconDiamond } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f4f7fb] flex items-center justify-center p-6">
      <div className="bg-white border border-[#c2cfe0] rounded-xl px-8 py-10 text-center max-w-[420px]">
        <span className="w-11 h-11 rounded-[10px] bg-brand-grad text-white flex items-center justify-center mx-auto mb-4"><IconDiamond size={22} /></span>
        <div className="text-[40px] font-extrabold text-[#08122B] leading-none">404</div>
        <h1 className="text-[16px] font-semibold text-[#08122B] mt-2 mb-1">Page not found</h1>
        <p className="text-[13px] text-[#5b6472] m-0 leading-relaxed">The page you're looking for doesn't exist or has moved.</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link href="/dashboard" className="btn-grad px-4 py-2 text-[13px] no-underline">Store dashboard</Link>
          <Link href="/portal" className="btn-outline px-4 py-2 text-[13px] no-underline">My portal</Link>
        </div>
      </div>
    </div>
  );
}
