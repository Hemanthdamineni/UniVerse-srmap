import type { SidebarItem } from "./erpBlueprints";

export type NavigationExtension = {
  id: string;
  mainNavAppend?: SidebarItem[];
};

const extensions: NavigationExtension[] = [];

export function getNavigationExtensions(): readonly NavigationExtension[] {
  return extensions;
}

/** Register additional sidebar sections or top-level groups at runtime (plugins, feature flags). */
export function registerNavigationExtension(extension: NavigationExtension): void {
  if (!extension.id?.trim()) {
    throw new Error("[navigation] Extension requires a non-empty id.");
  }
  if (extensions.some((e) => e.id === extension.id)) {
    throw new Error(`[navigation] Extension "${extension.id}" is already registered.`);
  }
  extensions.push(extension);
}

export function clearNavigationExtensionsForTests(): void {
  extensions.length = 0;
}
