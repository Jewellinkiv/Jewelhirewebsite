// Lightweight inline icon set (no external dependency).
import { CSSProperties, ReactNode } from "react";

function S({ size = 24, className, style, children }: { size?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

type P = { size?: number; className?: string; style?: CSSProperties };

export const IconDiamond = ({ size }: P) => (<S size={size}><path d="M3 9l4-5h10l4 5-9 12z" /><path d="M3 9h18" /></S>);
export const IconLayoutDashboard = ({ size }: P) => (<S size={size}><rect x="3" y="3" width="7" height="8" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="15" width="7" height="6" rx="1" /></S>);
export const IconUsers = ({ size }: P) => (<S size={size}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><path d="M16 5.5a3 3 0 0 1 0 5.5" /><path d="M21 20c0-2-1.5-3.5-4-4" /></S>);
export const IconUsersGroup = ({ size }: P) => (<S size={size}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><path d="M16 5.5a3 3 0 0 1 0 5.5" /><path d="M21 20c0-2-1.5-3.5-4-4" /></S>);
export const IconBriefcase = ({ size }: P) => (<S size={size}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 12h18" /></S>);
export const IconSend = ({ size }: P) => (<S size={size}><path d="M22 2 11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></S>);
export const IconTargetArrow = ({ size }: P) => (<S size={size}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></S>);
export const IconClipboardList = ({ size }: P) => (<S size={size}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9z" /><path d="M9 11h6M9 15h6" /></S>);
export const IconIdBadge2 = ({ size }: P) => (<S size={size}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10" r="2.5" /><path d="M8 17c0-2 2-3 4-3s4 1 4 3" /></S>);
export const IconSchool = ({ size }: P) => (<S size={size}><path d="M12 4 2 9l10 5 10-5z" /><path d="M5 11v5c0 1.5 3 3 7 3s7-1.5 7-3v-5" /></S>);
export const IconSettings = ({ size }: P) => (<S size={size}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></S>);
export const IconChevronDown = ({ size, className }: P) => (<S size={size} className={className}><path d="M6 9l6 6 6-6" /></S>);
export const IconChevronRight = ({ size, className }: P) => (<S size={size} className={className}><path d="M9 6l6 6-6 6" /></S>);
export const IconBell = ({ size }: P) => (<S size={size}><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 21h4" /></S>);
export const IconTriangle = ({ size }: P) => (<S size={size}><path d="M12 4 21 19H3z" /></S>);
export const IconUserPlus = ({ size }: P) => (<S size={size}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5c1.4 0 2.7.4 3.7 1.1" /><path d="M17 14v6M14 17h6" /></S>);
export const IconUser = ({ size }: P) => (<S size={size}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></S>);
export const IconFileText = ({ size }: P) => (<S size={size}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h5" /></S>);
export const IconLock = ({ size }: P) => (<S size={size}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></S>);
export const IconProgress = ({ size }: P) => (<S size={size}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>);
export const IconCheck = ({ size, className }: P) => (<S size={size} className={className}><path d="M5 12l5 5L19 6" /></S>);
export const IconX = ({ size }: P) => (<S size={size}><path d="M6 6l12 12M18 6 6 18" /></S>);
export const IconCalendar = ({ size }: P) => (<S size={size}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></S>);
export const IconBulb = ({ size }: P) => (<S size={size}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z" /></S>);
export const IconSearch = ({ size, className }: P) => (<S size={size} className={className}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></S>);
export const IconStar = ({ size = 24, className }: P) => (
  <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.5l2.7 5.8 6.3.6-4.8 4.2 1.4 6.2L12 16.9 6.4 19.3l1.4-6.2L3 8.9l6.3-.6z" />
  </svg>
);
export const IconMapPin = ({ size, className, style }: P) => (<S size={size} className={className} style={style}><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></S>);
export const IconPlus = ({ size, className }: P) => (<S size={size} className={className}><path d="M12 5v14M5 12h14" /></S>);
export const IconChevronLeft = ({ size, className }: P) => (<S size={size} className={className}><path d="M15 6l-6 6 6 6" /></S>);
export const IconPlayerPlay = ({ size = 24, className }: P) => (
  <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.87l13-7.5a1 1 0 0 0 0-1.74l-13-7.5A1 1 0 0 0 7 4.5z" /></svg>
);
export const IconClock = ({ size, className }: P) => (<S size={size} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></S>);
export const IconCertificate = ({ size, className }: P) => (<S size={size} className={className}><circle cx="12" cy="9" r="5" /><path d="M9 13.5 8 21l4-2 4 2-1-7.5" /></S>);
export const IconPalette = ({ size, className }: P) => (<S size={size} className={className}><path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1-1.6-.6-1 .1-2.4 1.3-2.4H17a4 4 0 0 0 4-4c0-5-4-8-9-8z" /><circle cx="7.5" cy="10.5" r="1" /><circle cx="12" cy="7.5" r="1" /><circle cx="16.5" cy="10.5" r="1" /></S>);
export const IconLink = ({ size, className }: P) => (<S size={size} className={className}><path d="M9 15l6-6" /><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1" /><path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1" /></S>);
export const IconCopy = ({ size, className }: P) => (<S size={size} className={className}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></S>);
export const IconQrcode = ({ size, className }: P) => (<S size={size} className={className}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 14v.01M14 20v.01M20 20v.01M17 17v3" /></S>);
export const IconArrowUpRight = ({ size, className }: P) => (<S size={size} className={className}><path d="M7 17 17 7" /><path d="M8 7h9v9" /></S>);
export const IconChevronUp = ({ size, className }: P) => (<S size={size} className={className}><path d="M6 15l6-6 6 6" /></S>);
export const IconMail = ({ size, className }: P) => (<S size={size} className={className}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></S>);
export const IconVideo = ({ size, className }: P) => (<S size={size} className={className}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m22 8-6 4 6 4z" /></S>);
export const IconChevronsUpDown = ({ size, className }: P) => (<S size={size} className={className}><path d="M8 9l4-4 4 4" /><path d="M8 15l4 4 4-4" /></S>);
export const IconMenu = ({ size, className }: P) => (<S size={size} className={className}><path d="M4 6h16M4 12h16M4 18h16" /></S>);
export const IconRefresh = ({ size, className }: P) => (<S size={size} className={className}><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 4v5h-5" /></S>);
