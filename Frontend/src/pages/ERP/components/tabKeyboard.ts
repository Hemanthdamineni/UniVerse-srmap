import type { KeyboardEvent } from "react";

/**
 * Roving-focus arrow-key handling for tablists: Left/Right move selection,
 * wrapping at the ends. Attach to both the tablist and each tab button.
 */
export function handleTabArrowKeys(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  const tablist = event.currentTarget.closest('[role="tablist"]');
  if (!tablist) return;
  const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>("[role='tab']"));
  const currentIndex = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  if (currentIndex === -1) return;
  const delta = event.key === "ArrowRight" ? 1 : -1;
  const nextTab = tabs[(currentIndex + delta + tabs.length) % tabs.length];
  nextTab?.focus();
  nextTab?.click();
}
