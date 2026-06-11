import type { PageBlueprint } from "./erpBlueprintTypes";
import { CORE_PAGE_BLUEPRINTS } from "./erpBlueprintRegistry/coreBlueprints";
import { EVENT_PAGE_BLUEPRINTS } from "./erpBlueprintRegistry/eventBlueprints";
import { WORKSPACE_PAGE_BLUEPRINTS } from "./erpBlueprintRegistry/workspaceBlueprints";

export { BOTTOM_NAV, DASHBOARD_QUICK_LINKS, MAIN_NAV } from "./erpBlueprintRegistry/navigation";

export const PAGE_BLUEPRINTS: Record<string, PageBlueprint> = {
  ...CORE_PAGE_BLUEPRINTS,
  ...EVENT_PAGE_BLUEPRINTS,
  ...WORKSPACE_PAGE_BLUEPRINTS,
};
