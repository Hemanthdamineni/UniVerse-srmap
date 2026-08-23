export type AccessType = "B" | "A";

export type Domain = "erp" | "lms" | "career" | "campus" | "admin";
export type SidebarDomain = Domain | "mixed";
export type PageSourceMode = "erp" | "internal" | "external";
export type IntegrationState = "native" | "adapter" | "summary" | "placeholder";
export type PageStatus = "active" | "hidden" | "coming-soon" | "experimental";

export type PageRenderer =
  | "dashboard"
  | "timetable"
  | "attendance"
  | "curriculum"
  | "vacant-rooms"
  | "results-current"
  | "results-earlier"
  | "finance-dues"
  | "finance-paid"
  | "bank-details"
  | "room-details"
  | "sap-scholarships"
  | "faqs"
  | "refund-change"
  | "document"
  | "profile"
  | "announcements"
  | "generic";

interface PageBlueprintBase {
  route: string;
  heading: string;
  fetchKeys: string[];
  domain: Domain;
  renderer: PageRenderer;
  status?: PageStatus;
  transform?: string;
  loadingMessage?: string;
  placeholderReason?: string;
  includeSessionProfile?: boolean;
}

export type ActivePageBlueprint =
  | (PageBlueprintBase & {
      integrationState: "native";
      sourceMode: "erp" | "internal";
    })
  | (PageBlueprintBase & {
      integrationState: "adapter";
      sourceMode: "erp" | "external";
    })
  | (PageBlueprintBase & {
      integrationState: "summary";
      sourceMode: "erp" | "external";
    });

export type PlaceholderPageBlueprint = Omit<PageBlueprintBase, "fetchKeys"> & {
  fetchKeys: [];
  integrationState: "placeholder";
  placeholderReason: string;
  sourceMode?: never;
};

export type PageBlueprint = ActivePageBlueprint | PlaceholderPageBlueprint;

export interface SidebarSubItem {
  label: string;
  route: string;
  type: AccessType;
  domain: Domain;
}

export interface SidebarLeafItem {
  label: string;
  icon: string;
  domain: Domain;
  type?: AccessType;
  route: string;
  submenu?: never;
}

export interface SidebarGroupItem {
  label: string;
  icon: string;
  domain: SidebarDomain;
  route?: never;
  type?: never;
  submenu: SidebarSubItem[];
}

export type SidebarItem = SidebarLeafItem | SidebarGroupItem;

export interface NavLinkItem {
  type: "link";
  label: string;
  route: string;
  icon?: string;
  domain: Domain;
  access?: AccessType;
}

export interface NavGroupItem {
  type: "group";
  label: string;
  icon?: string;
  domain?: SidebarDomain;
  children: NavLinkItem[];
}

export type NavItem = NavLinkItem | NavGroupItem;

export interface NavSection {
  section: string;
  icon: string;
  items: NavItem[];
}
