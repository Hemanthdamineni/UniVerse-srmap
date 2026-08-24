import { matchPath } from "react-router-dom";
import {
  BOTTOM_NAV,
  MAIN_NAV,
  isPageVisible,
  PAGE_BLUEPRINTS,
  type Domain,
  type NavItem,
  type NavSection,
  type SidebarItem,
} from "./erpBlueprints";
import { getNavigationExtensions } from "./navigationExtensions";

export type RouteCatalogEntry = {
  route: string;
  label: string;
  group: string;
  domain: Domain;
  keywords?: string;
};

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export const ADMIN_NAV_SECTION: NavSection = {
  section: "ADMINISTRATION",
  icon: "ShieldCheck",
  items: [
    {
      type: "group",
      label: "Admin",
      icon: "ShieldCheck",
      domain: "admin",
      children: [
        { type: "link", label: "Events Management", route: "/admin/events-management", domain: "admin", access: "B" },
        { type: "link", label: "Event Approvals", route: "/admin/event-approvals", domain: "admin", access: "B" },
        { type: "link", label: "Content Management", route: "/admin/content-management", domain: "admin", access: "B" },
        { type: "link", label: "Campus Feedback", route: "/admin/campus-feedback", domain: "admin", access: "B" },
        { type: "link", label: "Companion Analytics", route: "/admin/companion-analytics", domain: "admin", access: "B" },
        { type: "link", label: "LMS Moderation", route: "/admin/lms-moderation", domain: "admin", access: "B" },
        { type: "link", label: "Certificate Templates", route: "/admin/certificate-templates", domain: "admin", access: "B" },
        { type: "link", label: "Department Performance", route: "/admin/department-performance", domain: "admin", access: "B" },
        { type: "link", label: "Helpdesk Tickets", route: "/admin/helpdesk-tickets", domain: "admin", access: "B" },
        { type: "link", label: "Helpdesk FAQs", route: "/admin/helpdesk-faqs", domain: "admin", access: "B" },
        { type: "link", label: "Career Opportunities", route: "/admin/career-opportunities", domain: "admin", access: "B" },
        { type: "link", label: "Career Interviews", route: "/admin/career-interviews", domain: "admin", access: "B" },
        { type: "link", label: "Career Alumni", route: "/admin/career-alumni", domain: "admin", access: "B" },
        { type: "link", label: "Audit Logs", route: "/admin/audit-logs", domain: "admin", access: "B" },
        { type: "link", label: "System Controls", route: "/admin/system-controls", domain: "admin", access: "B" },
      ],
    },
  ],
};

/** Routes that exist in the SPA but are not declared in PAGE_BLUEPRINTS (command palette + breadcrumbs). */
export const SUPPLEMENTAL_ROUTE_CATALOG: RouteCatalogEntry[] = [
  { route: "/events", label: "Discover", group: "Competition Platform", domain: "campus", keywords: "events competitions discovery" },
  { route: "/events/create", label: "Create Event", group: "Competition Platform", domain: "campus" },
  { route: "/events/my-activity", label: "My Activity", group: "Competition Platform", domain: "campus" },
  { route: "/events/my-teams", label: "My Teams", group: "Competition Platform", domain: "campus" },
  { route: "/events/my-created", label: "My Created Events", group: "Competition Platform", domain: "campus" },
  { route: "/learn", label: "Learning home", group: "Learning", domain: "lms", keywords: "lms home hub momentum continue learning" },
  { route: "/learn/discover", label: "Learn", group: "Learning", domain: "lms", keywords: "browse search discover resources guides roadmaps pyq explore" },
  { route: "/learn/materials", label: "Official materials", group: "Learning", domain: "lms", keywords: "learning materials official year course subject" },
  { route: "/learn/practice", label: "Practice", group: "Learning", domain: "lms", keywords: "revision question bank quiz exam prep practice" },
  { route: "/learn/roadmaps", label: "Roadmaps", group: "Learning", domain: "lms", keywords: "roadmaps skill journey career path" },
  { route: "/learn/guides", label: "Guides", group: "Learning", domain: "lms", keywords: "guides study notes directory" },
  { route: "/learn/me", label: "My Learning", group: "Learning", domain: "lms", keywords: "bookmarks collections progress mastery saved" },
  { route: "/learn/contribute", label: "Contribute", group: "Learning", domain: "lms", keywords: "contribute add resource contributions request board" },
  { route: "/learn/contribute/new", label: "New resource", group: "Learning", domain: "lms" },
  { route: "/learn/subjects/:code", label: "Subject hub", group: "Learning", domain: "lms" },
  { route: "/learn/r/:id", label: "Resource detail", group: "Learning", domain: "lms" },
  { route: "/learn/guides/:id", label: "Guide reader", group: "Learning", domain: "lms" },
  { route: "/learn/guides/new", label: "New guide", group: "Learning", domain: "lms" },
  { route: "/learn/roadmaps/:id", label: "Roadmap viewer", group: "Learning", domain: "lms" },
  { route: "/learn/roadmaps/new", label: "New roadmap", group: "Learning", domain: "lms" },
  { route: "/learn/contributors/:userId", label: "Publisher profile", group: "Learning", domain: "lms" },
  { route: "/profile", label: "Profile", group: "Account", domain: "erp", keywords: "student profile account" },
  { route: "/admin/events-management/:eventId", label: "Event Detail", group: "Administration", domain: "admin", keywords: "admin event detail" },
  { route: "/admin/companion-analytics", label: "Companion Analytics", group: "Administration", domain: "admin", keywords: "analytics adoption recommendations conversion retention" },
];

const DOMAIN_TRAILS: { prefix: string; label: string; href: string; domain: Domain }[] = [
  { prefix: "/events", label: "Competition platform", href: "/events", domain: "campus" },
  { prefix: "/learn", label: "Learning", href: "/learn", domain: "lms" },
  { prefix: "/academic-tracker", label: "Learning management", href: "/academic-tracker/progress-overview", domain: "lms" },
  { prefix: "/career", label: "Career services", href: "/career", domain: "career" },
  { prefix: "/admin", label: "Administration", href: "/admin/events-management", domain: "admin" },
  { prefix: "/helpdesk", label: "Helpdesk", href: "/helpdesk/faqs", domain: "campus" },
  { prefix: "/feedback", label: "Feedback", href: "/feedback/course-feedback", domain: "campus" },
];

function cloneSidebarItem(item: SidebarItem): SidebarItem {
  if ("submenu" in item && item.submenu) {
    return {
      ...item,
      submenu: item.submenu.filter((s) => PAGE_BLUEPRINTS[s.route] ? isPageVisible(PAGE_BLUEPRINTS[s.route]) : true).map((s) => ({ ...s })),
    };
  }
  return { ...item };
}

function isSidebarItemVisible(item: SidebarItem): boolean {
  if ("submenu" in item && item.submenu) {
    return item.submenu.length > 0;
  }
  return !("route" in item) || !item.route || (PAGE_BLUEPRINTS[item.route] ? isPageVisible(PAGE_BLUEPRINTS[item.route]) : true);
}

export function convertNavItemToSidebarItem(item: NavItem): SidebarItem {
  if (item.type === "link") {
    return {
      label: item.label,
      icon: item.icon ?? "LayoutDashboard",
      domain: item.domain,
      route: item.route,
      type: item.access,
    };
  }

  return {
    label: item.label,
    icon: item.icon ?? "LayoutDashboard",
    domain: item.domain ?? "mixed",
    submenu: item.children.map((child) => ({
      label: child.label,
      route: child.route,
      type: child.access ?? "B",
      domain: child.domain,
    })),
  };
}

type NavViewOptions = {
  isAdmin?: boolean;
};

export function getMainNavSections(options: NavViewOptions = {}): NavSection[] {
  const sections = [...MAIN_NAV];
  if (options.isAdmin) {
    sections.push(ADMIN_NAV_SECTION);
  }
  return sections;
}

export function getSidebarNav(options: NavViewOptions = {}): SidebarItem[] {
  const items = getMainNavSections(options)
    .flatMap((section) => section.items.map(convertNavItemToSidebarItem))
    .map(cloneSidebarItem)
    .filter(isSidebarItemVisible);
  for (const ext of getNavigationExtensions()) {
    if (ext.mainNavAppend?.length) {
      items.push(...ext.mainNavAppend.map(cloneSidebarItem).filter(isSidebarItemVisible));
    }
  }
  return items;
}

export function getMergedMainNav(): SidebarItem[] {
  return getSidebarNav();
}

export function getCommandPaletteGroupOrder(options: NavViewOptions = {}): string[] {
  return getSidebarNav(options).map((item) => item.label);
}

export function flattenNavRoutes(items: SidebarItem[]): { route: string; label: string; group: string; domain: Domain }[] {
  const out: { route: string; label: string; group: string; domain: Domain }[] = [];

  for (const item of items) {
    if ("submenu" in item && item.submenu) {
      for (const sub of item.submenu) {
        out.push({ route: sub.route, label: sub.label, group: item.label, domain: sub.domain });
      }
    } else if ("route" in item && item.route) {
      out.push({ route: item.route, label: item.label, group: item.label, domain: item.domain });
    }
  }

  return out;
}

export function getRouteCatalog(options: NavViewOptions = {}): RouteCatalogEntry[] {
  const map = new Map<string, RouteCatalogEntry>();

  for (const entry of SUPPLEMENTAL_ROUTE_CATALOG) {
    map.set(entry.route, entry);
  }

  for (const bp of Object.values(PAGE_BLUEPRINTS)) {
    if (!isPageVisible(bp)) continue;
    if (map.has(bp.route)) continue;
    map.set(bp.route, {
      route: bp.route,
      label: bp.heading,
      group: "All pages",
      domain: bp.domain,
      keywords: `${bp.heading} ${bp.route} ${bp.renderer}`,
    });
  }

  const nav = getSidebarNav(options);
  for (const row of flattenNavRoutes(nav)) {
    if (map.has(row.route)) {
      const existing = map.get(row.route)!;
      map.set(row.route, { ...existing, group: row.group, label: existing.label || row.label });
    } else {
      map.set(row.route, {
        route: row.route,
        label: row.label,
        group: row.group,
        domain: row.domain,
        keywords: `${row.label} ${row.group} ${row.route}`,
      });
    }
  }

  for (const leaf of BOTTOM_NAV) {
    if (leaf.label.toLowerCase() === "logout") continue;
    if (!map.has(leaf.route)) {
      map.set(leaf.route, {
        route: leaf.route,
        label: leaf.label,
        group: "Quick access",
        domain: leaf.domain,
      });
    }
  }

  const all = Array.from(map.values()).filter((entry) => (PAGE_BLUEPRINTS[entry.route] ? isPageVisible(PAGE_BLUEPRINTS[entry.route]) : true));
  if (options.isAdmin) {
    return all;
  }
  return all.filter((entry) => entry.domain !== "admin");
}

function titleCaseSegment(segment: string): string {
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function resolveDomainTrail(pathname: string): BreadcrumbItem | null {
  let best: (typeof DOMAIN_TRAILS)[number] | null = null;
  for (const row of DOMAIN_TRAILS) {
    if (pathname === row.prefix || pathname.startsWith(`${row.prefix}/`)) {
      if (!best || row.prefix.length > best.prefix.length) {
        best = row;
      }
    }
  }
  if (!best) return null;
  return { label: best.label, href: best.href };
}

/** Longest registered route that matches pathname exactly or as a parent path. */
export function resolveCatalogRoute(pathname: string, options: NavViewOptions = {}): RouteCatalogEntry | null {
  const catalog = getRouteCatalog(options);
  let best: RouteCatalogEntry | null = null;
  for (const entry of catalog) {
    if (matchPath({ path: entry.route, end: false }, pathname)) {
      if (!best || entry.route.length > best.route.length) best = entry;
    }
  }
  if (best) return best;

  const direct = PAGE_BLUEPRINTS[pathname as keyof typeof PAGE_BLUEPRINTS];
  if (direct) {
    return {
      route: direct.route,
      label: direct.heading,
      group: "All pages",
      domain: direct.domain,
      keywords: `${direct.heading} ${direct.route}`,
    };
  }
  return null;
}

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === "/dashboard") {
    return [{ label: "Dashboard" }];
  }

  const items: BreadcrumbItem[] = [{ label: "Dashboard", href: "/dashboard" }];
  const domain = resolveDomainTrail(pathname);
  const match = resolveCatalogRoute(pathname);

  if (domain) {
    const onDomainRoot = pathname === domain.href;
    items.push(onDomainRoot ? { label: domain.label } : { label: domain.label, href: domain.href });
  }

  if (match) {
    if (pathname === match.route) {
      if (!domain || domain.href !== match.route) {
        items.push({ label: match.label });
      }
      return items;
    }

    if (match.route !== domain?.href) {
      items.push({ label: match.label, href: match.route });
    }

    const remainder = pathname.startsWith(match.route) ? pathname.slice(match.route.length).replace(/^\//, "") : "";
    const segments = remainder.split("/").filter(Boolean);
    const last = segments.pop();
    items.push({ label: last ? titleCaseSegment(last) : "Details" });
    return items;
  }

  if (!domain) {
    items.push({ label: "Page" });
  }

  return items;
}

export const COMMAND_PALETTE_EXTRA_GROUPS = ["Quick access", "All pages", "Session"] as const;
