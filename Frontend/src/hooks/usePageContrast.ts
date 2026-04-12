import { useCallback, useEffect, type RefObject } from "react";

type Point = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseCssPixels(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePercentVar(style: CSSStyleDeclaration, name: string, fallback: number) {
  const raw = Number.parseFloat(style.getPropertyValue(name));
  return Number.isFinite(raw) ? raw / 100 : fallback;
}

function parseColorAlpha(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized || normalized === "transparent") return 0;

  const rgbaMatch = normalized.match(/^rgba?\((.+)\)$/);
  if (!rgbaMatch) return 1;

  const parts = rgbaMatch[1].split(",").map((part) => part.trim());
  if (parts.length < 4) return 1;

  const alpha = Number.parseFloat(parts[3]);
  return Number.isFinite(alpha) ? alpha : 1;
}

function usesContrastAwareSurface(target: HTMLElement) {
  return (
    target.classList.contains("page-contrast-chip") ||
    target.classList.contains("page-contrast-outline")
  );
}

function hasOwnOpaqueSurface(target: HTMLElement, style: CSSStyleDeclaration) {
  if (usesContrastAwareSurface(target)) return false;
  return parseColorAlpha(style.backgroundColor) >= 0.55;
}

function resolveInlineAnchor(target: HTMLElement, style: CSSStyleDeclaration) {
  const explicitAnchor = target.dataset.pageContrastAnchor?.trim().toLowerCase();
  if (explicitAnchor === "start" || explicitAnchor === "center" || explicitAnchor === "end") {
    return explicitAnchor;
  }

  const textAlign = style.textAlign.trim().toLowerCase();
  const direction = style.direction.trim().toLowerCase();

  if (textAlign === "center" || textAlign === "-webkit-center") return "center";
  if (textAlign === "right") return "end";
  if (textAlign === "left") return "start";
  if (textAlign === "end") return direction === "rtl" ? "start" : "end";
  if (textAlign === "start") return direction === "rtl" ? "end" : "start";

  return direction === "rtl" ? "end" : "start";
}

function resolveSamplePoint(target: HTMLElement, rect: DOMRect, style: CSSStyleDeclaration): Point {
  const anchor = resolveInlineAnchor(target, style);
  const isRtl = style.direction.trim().toLowerCase() === "rtl";

  const paddingLeft = parseCssPixels(style.paddingLeft);
  const paddingRight = parseCssPixels(style.paddingRight);
  const paddingTop = parseCssPixels(style.paddingTop);

  const leadingPadding = isRtl ? paddingRight : paddingLeft;
  const trailingPadding = isRtl ? paddingLeft : paddingRight;
  const baseInsetX = Math.min(Math.max(leadingPadding + 14, 10), Math.max(rect.width - 10, 10));
  const trailingInsetX = Math.min(Math.max(trailingPadding + 14, 10), Math.max(rect.width - 10, 10));
  const topInsetY =
    rect.height <= 44
      ? rect.height / 2
      : Math.min(Math.max(paddingTop + 14, 10), Math.max(rect.height - 10, 10));

  let sampleX = baseInsetX;
  if (anchor === "center") {
    sampleX = rect.width / 2;
  } else if (anchor === "end") {
    sampleX = rect.width - trailingInsetX;
  }

  return {
    x: clamp(sampleX / Math.max(rect.width, 1), 0, 1),
    y: clamp(topInsetY / Math.max(rect.height, 1), 0, 1),
  };
}

function isPointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const denominator = yj - yi || Number.EPSILON;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / denominator + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

// Global semaphore for throttled updates
const pendingUpdates = new WeakMap<HTMLElement, boolean>();

export function usePageContrast(
  rootRef: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
  targetSelector = '[data-page-contrast="true"]'
) {
  const updatePageContrast = useCallback(() => {
    const root = rootRef.current;
    if (!root || pendingUpdates.get(root)) return;

    pendingUpdates.set(root, true);

    requestAnimationFrame(() => {
      try {
        if (!rootRef.current) return;

        const rootRect = root.getBoundingClientRect();
        if (!rootRect.width || !rootRect.height) return;

        const style = getComputedStyle(root);
        const topStart = parsePercentVar(style, "--dash-accent-top-start", 0.6897);
        const rightDrop = parsePercentVar(style, "--dash-accent-right-drop", 0.45);
        const bottomLeftX = parsePercentVar(style, "--dash-accent-bottom-left-x", 0.069);
        const leftStart = parsePercentVar(style, "--dash-accent-left-start", 0.4125);

        const bgContainer = root.closest(".dashboard-background") || root;
        const bgRect = bgContainer.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        const accentPolygon: Point[] = [
          { x: topStart, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: rightDrop },
          { x: bottomLeftX, y: 1 },
          { x: 0, y: 1 },
          { x: 0, y: leftStart },
        ];

        const targets = root.querySelectorAll<HTMLElement>(targetSelector);
        
        // Batch READ phase: Collect all rects and styles first to avoid layout thrashing
        const targetStates = Array.from(targets).map((target) => {
          const rect = target.getBoundingClientRect();
          // Skip elements that are significantly outside the viewport
          if (rect.bottom < -100 || rect.top > viewportHeight + 100) {
            return { target, skip: true };
          }
          return {
            target,
            rect,
            style: getComputedStyle(target),
            skip: false,
          };
        });

        // Batch WRITE phase: Apply changes based on collected data
        targetStates.forEach((state) => {
          if (state.skip) return;
          const { target, rect, style: targetStyle } = state as { target: HTMLElement; rect: DOMRect; style: CSSStyleDeclaration };

          if (hasOwnOpaqueSurface(target, targetStyle)) {
            target.classList.remove("page-on-accent");
            return;
          }

          const relativePoint = resolveSamplePoint(target, rect, targetStyle);
          const point: Point = {
            x: clamp((rect.left - bgRect.left + rect.width * relativePoint.x) / bgRect.width, 0, 1),
            y: clamp((rect.top - bgRect.top + rect.height * relativePoint.y) / bgRect.height, 0, 1),
          };

          target.classList.toggle("page-on-accent", isPointInPolygon(point, accentPolygon));
        });
      } finally {
        pendingUpdates.delete(root);
      }
    });
  }, [rootRef, targetSelector]);

  useEffect(() => {
    updatePageContrast();
    
    // Safety-net timers for catching the end of animations
    const t1 = window.setTimeout(updatePageContrast, 100);
    const t2 = window.setTimeout(updatePageContrast, 350);
    const t3 = window.setTimeout(updatePageContrast, 650);

    const onReflow = () => updatePageContrast();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, { passive: true });

    const root = rootRef.current;
    root?.addEventListener("scroll", onReflow, { capture: true, passive: true });

    // ResizeObserver catches accordion expansions, font changes, and DOM mutations
    let resizeObserver: ResizeObserver | null = null;
    if (root) {
      resizeObserver = new ResizeObserver(() => {
        updatePageContrast();
      });
      resizeObserver.observe(root);
      // Also observe children if needed, but root usually covers content changes
    }

    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow);
      root?.removeEventListener("scroll", onReflow);
      resizeObserver?.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [updatePageContrast, rootRef, ...deps]);
}
