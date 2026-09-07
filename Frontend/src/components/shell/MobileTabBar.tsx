import { NavLink, useLocation } from "react-router-dom";
import { Compass, GraduationCap, LayoutDashboard, LibraryBig, Menu } from "lucide-react";

/**
 * Bottom tab bar for narrow viewports.
 *
 * Below 768px the sidebar collapses to an unlabelled icon rail that costs a
 * third of the screen and names none of its destinations. This replaces it with
 * the pattern students already know from every other app on their phone: the
 * four product pillars as labelled tabs, plus a "More" tab that opens the full
 * sidebar as a sheet.
 *
 * Rendered only under `md`; the sidebar remains the desktop navigation.
 */

type Tab = {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  /** Path prefixes that should light this tab up, longest-match wins. */
  match: string[];
};

const TABS: Tab[] = [
  { label: "Home", to: "/dashboard", icon: LayoutDashboard, match: ["/dashboard"] },
  {
    label: "Academics",
    to: "/academic/attendance-details",
    icon: GraduationCap,
    match: ["/academic", "/exams", "/finance", "/registration", "/academic-tracker", "/campus"],
  },
  { label: "Events", to: "/events", icon: Compass, match: ["/events"] },
  { label: "Learn", to: "/learn", icon: LibraryBig, match: ["/learn"] },
];

function isTabActive(tab: Tab, pathname: string): boolean {
  return tab.match.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function MobileTabBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { pathname } = useLocation();

  // A tab owns the route only if no other tab matches more specifically, so
  // /events/... never lights up both Events and a broader sibling.
  const activeTab = TABS.reduce<Tab | null>((best, tab) => {
    if (!isTabActive(tab, pathname)) return best;
    const depth = Math.max(...tab.match.filter((p) => pathname.startsWith(p)).map((p) => p.length));
    const bestDepth = best
      ? Math.max(...best.match.filter((p) => pathname.startsWith(p)).map((p) => p.length))
      : -1;
    return depth > bestDepth ? tab : best;
  }, null);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--surface)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="flex list-none items-stretch justify-around gap-0.5 px-1 py-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab;
          return (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 no-underline transition-colors"
                style={{
                  color: active ? "var(--comp-accent)" : "var(--text-secondary)",
                  background: active ? "var(--comp-accent-light, transparent)" : "transparent",
                }}
              >
                <Icon size={21} aria-hidden="true" strokeWidth={active ? 2.4 : 1.9} />
                <span className="text-[11px] font-semibold leading-none">{tab.label}</span>
              </NavLink>
            </li>
          );
        })}
        <li className="flex-1">
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex min-h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Open navigation menu"
          >
            <Menu size={21} aria-hidden="true" strokeWidth={1.9} />
            <span className="text-[11px] font-semibold leading-none">More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
