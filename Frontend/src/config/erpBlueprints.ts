import { BOTTOM_NAV, DASHBOARD_QUICK_LINKS, MAIN_NAV, PAGE_BLUEPRINTS } from "./erpBlueprintData";
import type { Domain, NavItem, NavSection, PageBlueprint, PlaceholderPageBlueprint, SidebarItem } from "./erpBlueprintTypes";
export { BOTTOM_NAV, DASHBOARD_QUICK_LINKS, MAIN_NAV, PAGE_BLUEPRINTS } from "./erpBlueprintData";
export type {
  AccessType,
  ActivePageBlueprint,
  Domain,
  IntegrationState,
  NavGroupItem,
  NavItem,
  NavLinkItem,
  NavSection,
  PageBlueprint,
  PageRenderer,
  PageSourceMode,
  PlaceholderPageBlueprint,
  SidebarDomain,
  SidebarGroupItem,
  SidebarItem,
  SidebarLeafItem,
  SidebarSubItem,
} from "./erpBlueprintTypes";

/** Routes that stay in PAGE_BLUEPRINTS but are omitted from sidebar + command palette. */
export const NAV_HIDDEN_ROUTES = new Set<string>([
  "/exams/essentials",
  "/transport-hostel/outing-maintenance",
  "/registration/registration-tracker",
  "/registration/events-registration",
]);

export function isPlaceholderBlueprint(blueprint: PageBlueprint): blueprint is PlaceholderPageBlueprint {
  return blueprint.integrationState === "placeholder";
}

const KNOWN_DOMAINS = new Set<Domain>(["erp", "lms", "career", "campus", "admin"]);

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[erpBlueprints] ${message}`);
  }
}

function assertKnownDomain(domain: string, context: string): asserts domain is Domain {
  invariant(KNOWN_DOMAINS.has(domain as Domain), `${context} must use a supported domain, received "${domain}".`);
}

function validateBlueprints(pageBlueprints: Record<string, PageBlueprint>) {
  for (const [pageKey, blueprint] of Object.entries(pageBlueprints)) {
    invariant(pageKey === blueprint.route, `Blueprint key "${pageKey}" must match route "${blueprint.route}".`);
    assertKnownDomain(blueprint.domain, `Blueprint "${blueprint.route}" domain`);

    if (isPlaceholderBlueprint(blueprint)) {
      invariant(blueprint.fetchKeys.length === 0, `Placeholder page "${blueprint.route}" must have empty fetchKeys.`);
      invariant(
        Boolean(blueprint.placeholderReason.trim()),
        `Placeholder page "${blueprint.route}" must define a placeholderReason.`
      );
      invariant(
        !("sourceMode" in blueprint) || blueprint.sourceMode === undefined,
        `Placeholder page "${blueprint.route}" must omit sourceMode.`
      );
      continue;
    }

    invariant(Boolean(blueprint.sourceMode), `Non-placeholder page "${blueprint.route}" must define sourceMode.`);

    if (blueprint.integrationState === "native") {
      invariant(
        blueprint.sourceMode === "internal" || blueprint.sourceMode === "erp",
        `Native page "${blueprint.route}" cannot use sourceMode "${blueprint.sourceMode}".`
      );
    }

    if (blueprint.integrationState === "adapter" || blueprint.integrationState === "summary") {
      invariant(
        blueprint.sourceMode === "external" || blueprint.sourceMode === "erp",
        `${blueprint.integrationState} page "${blueprint.route}" cannot use sourceMode "${blueprint.sourceMode}".`
      );
    }
  }
}

function validateNavItems(
  items: SidebarItem[],
  pageBlueprints: Record<string, PageBlueprint>,
  collectionName: string
) {
  for (const item of items) {
    if ("submenu" in item && item.submenu) {
      const childDomains = new Set<Domain>();

      for (const subItem of item.submenu) {
        assertKnownDomain(subItem.domain, `${collectionName} > ${item.label} > ${subItem.label}`);
        childDomains.add(subItem.domain);

        const linkedBlueprint = pageBlueprints[subItem.route];
        if (linkedBlueprint) {
          invariant(
            linkedBlueprint.domain === subItem.domain,
            `${collectionName} > ${item.label} > ${subItem.label} must match blueprint domain "${linkedBlueprint.domain}".`
          );
        }
      }

      if (item.domain === "mixed") {
        invariant(
          childDomains.size > 1,
          `${collectionName} > ${item.label} can only use "mixed" when child items span multiple domains.`
        );
        continue;
      }

      assertKnownDomain(item.domain, `${collectionName} > ${item.label}`);
      for (const childDomain of childDomains) {
        invariant(
          childDomain === item.domain,
          `${collectionName} > ${item.label} must use "mixed" because child domain "${childDomain}" differs from "${item.domain}".`
        );
      }
      continue;
    }

    assertKnownDomain(item.domain, `${collectionName} > ${item.label}`);

    const linkedBlueprint = pageBlueprints[item.route];
    if (linkedBlueprint) {
      invariant(
        linkedBlueprint.domain === item.domain,
        `${collectionName} > ${item.label} must match blueprint domain "${linkedBlueprint.domain}".`
      );
    }
  }
}

function convertNavItemToSidebarItem(item: NavItem): SidebarItem {
  if (item.type === "link") {
    return {
      label: item.label,
      icon: item.icon ?? "/src/assets/Icons/Dashboard.png",
      domain: item.domain,
      route: item.route,
      type: item.access,
    };
  }

  return {
    label: item.label,
    icon: item.icon ?? "/src/assets/Icons/Dashboard.png",
    domain: item.domain ?? "mixed",
    submenu: item.children.map((child) => ({
      label: child.label,
      route: child.route,
      type: child.access ?? "B",
      domain: child.domain,
    })),
  };
}

function validateNavSections(
  sections: NavSection[],
  pageBlueprints: Record<string, PageBlueprint>,
  collectionName: string
) {
  for (const section of sections) {
    invariant(Boolean(section.section.trim()), `${collectionName} section must have a title.`);
    validateNavItems(
      section.items.map(convertNavItemToSidebarItem),
      pageBlueprints,
      `${collectionName} > ${section.section}`
    );
  }
}

validateBlueprints(PAGE_BLUEPRINTS);
validateNavSections(MAIN_NAV, PAGE_BLUEPRINTS, "MAIN_NAV");
validateNavItems(BOTTOM_NAV, PAGE_BLUEPRINTS, "BOTTOM_NAV");

for (const quickLink of DASHBOARD_QUICK_LINKS) {
  invariant(
    Boolean(PAGE_BLUEPRINTS[quickLink.route]),
    `Dashboard quick link "${quickLink.label}" must point to a defined page blueprint.`
  );
}
