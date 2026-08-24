import type { LucideIcon } from "lucide-react";
import {
  BellIcon,
  BookOpenIcon,
  BriefcaseIcon,
  Building2Icon,
  CalendarPlusIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CompassIcon,
  FoldersIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  HouseIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  LibraryBigIcon,
  LogOutIcon,
  MessageSquareTextIcon,
  NetworkIcon,
  RouteIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TargetIcon,
  TrendingUpIcon,
  UserRoundIcon,
  UsersRoundIcon,
  WalletIcon,
} from "lucide-react";

// Keys are lucide display names so nav configs stay serializable data while
// the sidebar renders theme-aware inline SVGs (currentColor) instead of
// filtered PNG images.
export const NAV_ICON_MAP: Record<string, LucideIcon> = {
  Bell: BellIcon,
  BookOpen: BookOpenIcon,
  Briefcase: BriefcaseIcon,
  Building2: Building2Icon,
  CalendarPlus: CalendarPlusIcon,
  ClipboardCheck: ClipboardCheckIcon,
  ClipboardList: ClipboardListIcon,
  Compass: CompassIcon,
  Folders: FoldersIcon,
  GraduationCap: GraduationCapIcon,
  HeartHandshake: HeartHandshakeIcon,
  House: HouseIcon,
  LayoutDashboard: LayoutDashboardIcon,
  LifeBuoy: LifeBuoyIcon,
  LibraryBig: LibraryBigIcon,
  LogOut: LogOutIcon,
  MessageSquareText: MessageSquareTextIcon,
  Network: NetworkIcon,
  Route: RouteIcon,
  Search: SearchIcon,
  Settings: SettingsIcon,
  ShieldCheck: ShieldCheckIcon,
  Target: TargetIcon,
  TrendingUp: TrendingUpIcon,
  UserRound: UserRoundIcon,
  UsersRound: UsersRoundIcon,
  Wallet: WalletIcon,
};

function isAssetPath(icon: string | undefined): icon is string {
  return typeof icon === "string" && (icon.startsWith("/") || icon.includes("."));
}

function resolveAssetPath(src: string) {
  if (!src.startsWith("/assets/")) return src;

  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${src.slice(1)}`;
}

export function SidebarNavIcon({
  icon,
  className = "h-6 w-6 shrink-0",
}: {
  icon?: string;
  className?: string;
}) {
  if (isAssetPath(icon)) {
    // Navigation extensions may still register legacy asset-path icons.
    return <img src={resolveAssetPath(icon)} alt="" className={`${className} object-contain`} aria-hidden="true" />;
  }

  const IconComponent = (icon && NAV_ICON_MAP[icon]) || LayoutDashboardIcon;
  return <IconComponent className={className} aria-hidden="true" strokeWidth={1.75} />;
}
