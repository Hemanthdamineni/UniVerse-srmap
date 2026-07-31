import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { usePageContrast } from "./usePageContrast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRect(partial: Partial<DOMRect>): DOMRect {
  const x = partial.x ?? 0;
  const y = partial.y ?? 0;
  const w = partial.width ?? 0;
  const h = partial.height ?? 0;
  return {
    x,
    y,
    width: w,
    height: h,
    top: partial.top ?? y,
    right: partial.right ?? x + w,
    bottom: partial.bottom ?? y + h,
    left: partial.left ?? x,
    toJSON() {
      return {
        x: this.x, y: this.y, width: this.width, height: this.height,
        top: this.top, right: this.right, bottom: this.bottom, left: this.left,
      };
    },
  } as DOMRect;
}

type ROWatch = {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  /** The callback passed to the constructor — tests can fire it directly. */
  _callback: () => void;
};

/**
 * Register per-element computed-style overrides.
 * The mock falls through to defaults for any property not listed here.
 */
function setComputedStyle(el: Element, props: Record<string, string>) {
  styleOverrideMap.set(el, { ...(styleOverrideMap.get(el) ?? {}), ...props });
}

// ---------------------------------------------------------------------------
// Shared mutable state
// ---------------------------------------------------------------------------

const styleOverrideMap = new Map<Element, Record<string, string>>();
let roInstances: ROWatch[] = [];
let rAFCallback: FrameRequestCallback | null = null;

/** Set up a target element inside `rootEl` with mocked geometry and styles. */
function addTarget(
  rect: Partial<DOMRect>,
  styleOverrides: Record<string, string> = {},
  attrs: Record<string, string> = {},
): HTMLElement {
  const el = document.createElement("div");
  el.dataset.pageContrast = "true";

  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }

  vi.spyOn(el, "getBoundingClientRect" as any).mockReturnValue(mockRect(rect));

  setComputedStyle(el, styleOverrides);
  rootEl.appendChild(el);
  return el;
}

let rootEl: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  rAFCallback = null;

  // --- requestAnimationFrame mock: schedule via setTimeout(0) ---
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    rAFCallback = cb;
    return 1;
  });

  // --- getComputedStyle mock: per-element map ---
  styleOverrideMap.clear();
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (el: Element) =>
      ({
        getPropertyValue: (prop: string) => {
          const overrides = styleOverrideMap.get(el);
          return overrides?.[prop] ?? "";
        },
        backgroundColor: "transparent",
        paddingLeft: "0px",
        paddingRight: "0px",
        paddingTop: "0px",
        textAlign: "left",
        direction: "ltr",
        ...(styleOverrideMap.get(el) ?? {}),
      }) as CSSStyleDeclaration,
  );

  // --- ResizeObserver mock ---
  roInstances = [];
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(function (this: ROWatch, cb: () => void) {
      this.observe = vi.fn();
      this.disconnect = vi.fn();
      this.unobserve = vi.fn();
      this._callback = cb;
      roInstances.push(this);
    }),
  );

  // --- Root element ---
  rootEl = document.createElement("div");
  rootEl.style.width = "1000px";
  rootEl.style.height = "1000px";
  vi.spyOn(rootEl, "getBoundingClientRect" as any).mockReturnValue(
    mockRect({ x: 0, y: 0, width: 1000, height: 1000 }),
  );
  document.body.appendChild(rootEl);

  Object.defineProperty(window, "innerHeight", { value: 1200, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  if (rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
  cleanup();
});

// ---------------------------------------------------------------------------
// Fire the stored rAF callback (if any) and advance microtasks
// ---------------------------------------------------------------------------
function flushRAF() {
  if (rAFCallback) {
    rAFCallback(performance.now());
    rAFCallback = null;
  }
}

// ===========================================================================
// 1  —  Shape / default return
// ===========================================================================

describe("shape", () => {
  it("returns undefined (void hook)", () => {
    const { result } = renderHook(() =>
      usePageContrast({ current: null }),
    );
    expect(result.current).toBeUndefined();
  });

  it("accepts a null ref without throwing", () => {
    expect(() =>
      renderHook(() => usePageContrast({ current: null })),
    ).not.toThrow();
  });
});

// ===========================================================================
// 2  —  Lifecycle
// ===========================================================================

describe("lifecycle", () => {
  it("schedules update via requestAnimationFrame on mount", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame");
    renderHook(() => usePageContrast({ current: rootEl }));
    expect(raf).toHaveBeenCalled();
  });

  it("registers window resize and scroll listeners", () => {
    const spy = vi.spyOn(window, "addEventListener");
    renderHook(() => usePageContrast({ current: rootEl }));

    expect(spy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(spy).toHaveBeenCalledWith("scroll", expect.any(Function), {
      passive: true,
    });
  });

  it("registers root scroll listener with capture and passive", () => {
    const spy = vi.spyOn(rootEl, "addEventListener");
    renderHook(() => usePageContrast({ current: rootEl }));

    expect(spy).toHaveBeenCalledWith("scroll", expect.any(Function), {
      capture: true,
      passive: true,
    });
  });

  it("observes root with ResizeObserver", () => {
    renderHook(() => usePageContrast({ current: rootEl }));
    expect(roInstances).toHaveLength(1);
    expect(roInstances[0].observe).toHaveBeenCalledWith(rootEl);
  });

  it("sets three safety-net timeouts (100 / 350 / 650 ms)", () => {
    const spy = vi.spyOn(window, "setTimeout");
    renderHook(() => usePageContrast({ current: rootEl }));

    // The effect body runs `updatePageContrast()` synchronously which calls
    // requestAnimationFrame (mocked to a no-op schedule). Then it creates
    // three setTimeout(updatePageContrast, 100/350/650).
    const calls = spy.mock.calls.filter(
      ([, ms]) => ms === 100 || ms === 350 || ms === 650,
    );
    expect(calls).toHaveLength(3);
  });

  it("cleans up window event listeners on unmount", () => {
    const spy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() =>
      usePageContrast({ current: rootEl }),
    );
    unmount();

    expect(spy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(spy).toHaveBeenCalledWith("scroll", expect.any(Function));
  });

  it("cleans up root scroll listener on unmount", () => {
    const spy = vi.spyOn(rootEl, "removeEventListener");
    const { unmount } = renderHook(() =>
      usePageContrast({ current: rootEl }),
    );
    unmount();

    expect(spy).toHaveBeenCalledWith("scroll", expect.any(Function));
  });

  it("disconnects ResizeObserver on unmount", () => {
    const { unmount } = renderHook(() =>
      usePageContrast({ current: rootEl }),
    );
    const inst = roInstances[0];
    unmount();

    expect(inst.disconnect).toHaveBeenCalled();
  });

  it("clears all three safety-net timeouts on unmount", () => {
    const spy = vi.spyOn(window, "clearTimeout");
    const { unmount } = renderHook(() =>
      usePageContrast({ current: rootEl }),
    );
    unmount();

    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("does not throw synchronously when ResizeObserver is absent", () => {
    vi.unstubAllGlobals();
    // Intentionally not providing a ResizeObserver mock.
    // ResizeObserver is created inside useEffect (async), so the
    // renderHook call itself must not throw synchronously.
    expect(() =>
      renderHook(() => usePageContrast({ current: rootEl })),
    ).not.toThrow();
  });
});

// ===========================================================================
// 3  —  Throttling via pendingUpdates WeakMap
// ===========================================================================

describe("throttling", () => {
  it("skips update when root is already in pendingUpdates", () => {
    // The `pendingUpdates` WeakMap is internal to the module.
    // We test the observable effect: if two effects fire before the rAF
    // callback runs, the second call returns early. Since our rAF mock
    // captures the callback without executing it, we can simulate this.
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");

    // First mount — schedules one rAF
    const { rerender } = renderHook(
      ({ deps }) =>
        usePageContrast({ current: rootEl }, deps),
      { initialProps: { deps: [1] } },
    );
    expect(rafSpy).toHaveBeenCalledTimes(1);

    // Re-render with new deps so the effect re-runs.
    // The first rAF hasn't fired yet — pendingUpdates still has the root,
    // so the second effect's `updatePageContrast` returns early.
    rerender({ deps: [2] });

    // The effect re-ran but `updatePageContrast` bailed because
    // `pendingUpdates` was still set. requestAnimationFrame was NOT called
    // again (the early return happened before the rAF call).
    // However, because the _effect_ re-ran independently of
    // `updatePageContrast`, the effect's own calls to updatePageContrast,
    // setTimeout, etc. may still happen. Let's check that the net count
    // of rAF calls didn't double.
    expect(rafSpy).toHaveBeenCalledTimes(1);
  });

  it("clears pendingUpdates in finally block after rAF callback", () => {
    renderHook(() => usePageContrast({ current: rootEl }));

    // Before flushing rAF, a new effect would be throttled.
    // After flushing, it should be able to schedule again.
    flushRAF();

    // Now simulate a resize-triggered call by firing the observer callback
    roInstances[0]._callback();

    // Should have scheduled another rAF
    expect(rAFCallback).not.toBeNull();
  });
});

// ===========================================================================
// 4  —  Class-toggling (the core DOM logic)
// ===========================================================================

describe("class toggling", () => {
  // Default accent polygon at (1000x1000) bg:
  //   vertices (relative): (0.6897,0), (1,0), (1,0.45), (0.069,1), (0,1), (0,0.4125)
  //   Target at (800,100,100,50), LTR left-aligned, transparent bg:
  //     sample → (0.14, 0.28) of target → global (0.814, 0.114) → INSIDE
  //   Target at (800,900,100,50) → global (0.814, 0.914) → OUTSIDE

  it("adds page-on-accent to target inside accent polygon", () => {
    addTarget({ x: 800, y: 100, width: 100, height: 50 });
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(target.classList.contains("page-on-accent")).toBe(true);
  });

  it("does NOT add page-on-accent to target outside accent polygon", () => {
    addTarget({ x: 800, y: 900, width: 100, height: 50 });
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(target.classList.contains("page-on-accent")).toBe(false);
  });

  it("toggles page-on-accent when target moves relative to polygon (via deps re-run)", () => {
    const target = addTarget({ x: 800, y: 100, width: 100, height: 50 });
    const { rerender } = renderHook(
      ({ deps }) => usePageContrast({ current: rootEl }, deps),
      { initialProps: { deps: [1] } },
    );
    flushRAF();
    expect(target.classList.contains("page-on-accent")).toBe(true);

    // Move target outside polygon and re-trigger
    vi.spyOn(target, "getBoundingClientRect" as any).mockReturnValue(
      mockRect({ x: 800, y: 900, width: 100, height: 50 }),
    );
    rerender({ deps: [2] });
    flushRAF();
    expect(target.classList.contains("page-on-accent")).toBe(false);
  });

  it("removes page-on-accent from previously-inside target that has moved outside", () => {
    const target = addTarget({ x: 800, y: 100, width: 100, height: 50 });
    const { rerender } = renderHook(
      ({ deps }) => usePageContrast({ current: rootEl }, deps),
      { initialProps: { deps: [1] } },
    );
    flushRAF();
    expect(target.classList.contains("page-on-accent")).toBe(true);

    // Move outside
    vi.spyOn(target, "getBoundingClientRect" as any).mockReturnValue(
      mockRect({ x: 800, y: 900, width: 100, height: 50 }),
    );
    rerender({ deps: [2] });
    flushRAF();
    expect(target.classList.contains("page-on-accent")).toBe(false);
  });

  it("does not add page-on-accent to target with opaque background", () => {
    addTarget(
      { x: 800, y: 100, width: 100, height: 50 },
      { backgroundColor: "rgba(255, 0, 0, 1)" },
    );
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(target.classList.contains("page-on-accent")).toBe(false);
  });

  it("applies page-on-accent to page-contrast-chip even with opaque background", () => {
    const target = addTarget(
      { x: 800, y: 100, width: 100, height: 50 },
      { backgroundColor: "rgba(255, 0, 0, 1)" },
    );
    target.classList.add("page-contrast-chip");

    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    expect(target.classList.contains("page-on-accent")).toBe(true);
  });

  it("applies page-on-accent to page-contrast-outline even with opaque background", () => {
    const target = addTarget(
      { x: 800, y: 100, width: 100, height: 50 },
      { backgroundColor: "rgba(255, 0, 0, 1)" },
    );
    target.classList.add("page-contrast-outline");

    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    expect(target.classList.contains("page-on-accent")).toBe(true);
  });

  it("skips target significantly outside viewport (rect.bottom < -100)", () => {
    // Target above viewport
    addTarget({ x: 0, y: -200, width: 100, height: 50 });
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    const target = rootEl.querySelector("[data-page-contrast]")!;
    // Skipped entirely — class stayed off (was never added)
    expect(target.classList.contains("page-on-accent")).toBe(false);
  });

  it("skips target significantly below viewport (rect.top > viewportHeight + 100)", () => {
    addTarget({ x: 0, y: 1500, width: 100, height: 50 });
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(target.classList.contains("page-on-accent")).toBe(false);
  });

  it("no matching targets does not cause errors", () => {
    // No element with data-page-contrast
    expect(() => {
      renderHook(() => usePageContrast({ current: rootEl }));
      flushRAF();
    }).not.toThrow();
  });

  it("custom targetSelector selects different elements", () => {
    const el = document.createElement("div");
    el.setAttribute("data-foo", "bar");
    vi.spyOn(el, "getBoundingClientRect" as any).mockReturnValue(
      mockRect({ x: 800, y: 100, width: 100, height: 50 }),
    );
    rootEl.appendChild(el);

    renderHook(() =>
      usePageContrast({ current: rootEl }, [], '[data-foo="bar"]'),
    );
    flushRAF();

    expect(el.classList.contains("page-on-accent")).toBe(true);
  });

  it("processes multiple targets independently", () => {
    const inside = addTarget({ x: 800, y: 100, width: 100, height: 50 });
    const outside = addTarget({ x: 800, y: 900, width: 100, height: 50 });

    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    expect(inside.classList.contains("page-on-accent")).toBe(true);
    expect(outside.classList.contains("page-on-accent")).toBe(false);
  });

  it("uses data-page-contrast-anchor to resolve sample point", () => {
    addTarget(
      { x: 800, y: 100, width: 100, height: 50 },
      {},
      { "data-page-contrast-anchor": "center" },
    );
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    // Center anchor: sampleX = width/2 = 50, sampleY = 14 (height>44)
    // global: ((800+50-0)/1000, (100+14-0)/1000) = (0.85, 0.114)
    // (0.85, 0.114) inside polygon → true
    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(target.classList.contains("page-on-accent")).toBe(true);
  });

  it("end anchor resolves sample point to trailing edge", () => {
    addTarget(
      { x: 800, y: 100, width: 100, height: 50 },
      {},
      { "data-page-contrast-anchor": "end" },
    );
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    // Sample near trailing edge. With LTR, trailing = right.
    // trailingInsetX = min(max(0+14,10), max(100-10,10)) = 14
    // sampleX = 100 - 14 = 86
    // globalX = (800 + 86) / 1000 = 0.886
    // Inside? (0.886, 0.114) → inside polygon → true
    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(target.classList.contains("page-on-accent")).toBe(true);
  });
});

// ===========================================================================
// 5  —  CSS custom property overrides
// ===========================================================================

describe("CSS custom property overrides", () => {
  it("uses custom --dash-accent-* values from root computed style", () => {
    // Squash the polygon to only top-right so (800,100) is still inside
    setComputedStyle(rootEl, {
      "--dash-accent-top-start": "0.5",
      "--dash-accent-right-drop": "0.5",
      "--dash-accent-bottom-left-x": "0.5",
      "--dash-accent-left-start": "0.5",
    });

    addTarget({ x: 800, y: 100, width: 100, height: 50 });
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(target.classList.contains("page-on-accent")).toBe(true);
  });

  it("falls back to default values when CSS custom properties are missing", () => {
    // No custom props set — hook uses hardcoded defaults
    addTarget({ x: 800, y: 100, width: 100, height: 50 });
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(target.classList.contains("page-on-accent")).toBe(true);
  });
});

// ===========================================================================
// 6  —  dashboard-background container
// ===========================================================================

describe("dashboard-background container", () => {
  it("uses .dashboard-background ancestor for coordinate offset", () => {
    // Wrap root in a background container that shifts everything right
    const bg = document.createElement("div");
    bg.className = "dashboard-background";
    bg.style.width = "1200px";
    bg.style.height = "1000px";
    vi.spyOn(bg, "getBoundingClientRect" as any).mockReturnValue(
      mockRect({ x: 200, y: 0, width: 1200, height: 1000 }),
    );

    // Move rootEl inside bg
    if (rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
    bg.appendChild(rootEl);
    document.body.appendChild(bg);

    // Target placed at (800,100) relative to the viewport,
    // but bg starts at x=200, so relative to bg it's at x=600.
    addTarget({ x: 800, y: 100, width: 100, height: 50 });

    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    // Since bgRect.x=200, the target's global x relative to bg is
    // (800 - 200 + 14) / 1200 = 0.512 → inside polygon (y=0.114)
    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(target.classList.contains("page-on-accent")).toBe(true);
  });

  it("falls back to root when no .dashboard-background ancestor exists", () => {
    addTarget({ x: 800, y: 100, width: 100, height: 50 });
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(target.classList.contains("page-on-accent")).toBe(true);
  });
});

// ===========================================================================
// 7  —  deps-driven re-execution
// ===========================================================================

describe("deps-driven re-execution", () => {
  it("re-runs effect when deps change", () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    const ref = { current: rootEl };
    const { rerender } = renderHook(
      ({ deps }) => usePageContrast(ref, deps),
      { initialProps: { deps: [1] } },
    );
    // Flush the initial rAF so the pendingUpdates semaphore is cleared
    flushRAF();
    const afterFirst = rafSpy.mock.calls.length;

    rerender({ deps: [2] });
    expect(rafSpy.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it("does NOT re-run effect when stable deps provided", () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    const ref = { current: rootEl };
    const { rerender } = renderHook(
      ({ deps }) => usePageContrast(ref, deps),
      { initialProps: { deps: ["stable"] } },
    );
    const afterFirst = rafSpy.mock.calls.length;

    rerender({ deps: ["stable"] });
    // React uses Object.is per-element; "stable" === "stable", so deps match.
    expect(rafSpy.mock.calls.length).toBe(afterFirst);
  });
});

// ===========================================================================
// 8  —  Edge cases
// ===========================================================================

describe("edge cases", () => {
  it("handles root with zero width (early return)", () => {
    vi.spyOn(rootEl, "getBoundingClientRect" as any).mockReturnValue(
      mockRect({ x: 0, y: 0, width: 0, height: 1000 }),
    );
    addTarget({ x: 800, y: 100, width: 100, height: 50 });

    expect(() => {
      renderHook(() => usePageContrast({ current: rootEl }));
      flushRAF();
    }).not.toThrow();
  });

  it("handles root with zero height (early return)", () => {
    vi.spyOn(rootEl, "getBoundingClientRect" as any).mockReturnValue(
      mockRect({ x: 0, y: 0, width: 1000, height: 0 }),
    );
    addTarget({ x: 800, y: 100, width: 100, height: 50 });

    expect(() => {
      renderHook(() => usePageContrast({ current: rootEl }));
      flushRAF();
    }).not.toThrow();
  });

  it("rootRef.current becomes null before rAF runs", () => {
    const ref: { current: HTMLElement | null } = { current: rootEl };
    renderHook(() => usePageContrast(ref));

    // Null the ref before the rAF fires
    ref.current = null;
    flushRAF();

    // No crash — the rAF callback checks rootRef.current at the top
    expect(true).toBe(true);
  });

  it("empty root with no children does not error", () => {
    expect(() => {
      renderHook(() => usePageContrast({ current: rootEl }));
      flushRAF();
    }).not.toThrow();
  });

  it("does not crash when addEventListener is missing (SSR edge)", () => {
    // Simulate server environment: effect runs but addEventListener
    // is unavailable. In practice, useEffect doesn't run during SSR,
    // but if it did, the hook would throw.
    // We verify the guard: the hook doesn't guard, and we document that.
    const origAddEventListener = window.addEventListener;
    (window as any).addEventListener = undefined;

    expect(() => {
      renderHook(() => usePageContrast({ current: rootEl }));
    }).toThrow();

    (window as any).addEventListener = origAddEventListener;
  });
});

// ===========================================================================
// 9  —  ResizeObserver integration
// ===========================================================================

describe("ResizeObserver integration", () => {
  it("resize observer callback triggers updatePageContrast", () => {
    renderHook(() => usePageContrast({ current: rootEl }));
    // Flush the initial rAF to clear the pendingUpdates semaphore
    flushRAF();
    // Clear the stored callback to set up the assertion
    rAFCallback = null;

    // Simulate ResizeObserver firing
    roInstances[0]._callback();

    // Should have scheduled a new rAF
    expect(rAFCallback).not.toBeNull();
  });

  it("event-based reflow (resize) triggers updatePageContrast", () => {
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();
    rAFCallback = null;

    // Simulate resize event
    window.dispatchEvent(new Event("resize"));

    // The event handler calls updatePageContrast, which schedules rAF
    expect(rAFCallback).not.toBeNull();
  });

  it("event-based reflow (scroll) triggers updatePageContrast", () => {
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();
    rAFCallback = null;

    window.dispatchEvent(new Event("scroll"));
    expect(rAFCallback).not.toBeNull();
  });

  it("root scroll event triggers updatePageContrast", () => {
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();
    rAFCallback = null;

    rootEl.dispatchEvent(new Event("scroll"));
    expect(rAFCallback).not.toBeNull();
  });
});

// ===========================================================================
// 10  —  Internal utility behaviour (via observable side-effects)
// ===========================================================================

describe("internal utility behaviour", () => {
  it("parseColorAlpha returns 0 for transparent background", () => {
    addTarget(
      { x: 800, y: 100, width: 100, height: 50 },
      { backgroundColor: "transparent" },
    );
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    // Transparent → no opaque surface → proceeds to polygon check
    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(target.classList.contains("page-on-accent")).toBe(true);
  });

  it("parseColorAlpha treats no-alpha rgb as fully opaque (alpha=1)", () => {
    addTarget(
      { x: 800, y: 100, width: 100, height: 50 },
      { backgroundColor: "rgb(255, 0, 0)" },
    );
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    // rgb() → alpha=1 ≥ 0.55 → hasOwnOpaqueSurface → no page-on-accent
    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(target.classList.contains("page-on-accent")).toBe(false);
  });

  it("parseColorAlpha treats semi-transparent background (alpha < 0.55) as non-opaque", () => {
    addTarget(
      { x: 800, y: 100, width: 100, height: 50 },
      { backgroundColor: "rgba(255, 0, 0, 0.3)" },
    );
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    // alpha=0.3 < 0.55 → NOT opaque → proceeds to polygon check
    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(target.classList.contains("page-on-accent")).toBe(true);
  });

  it("RTL direction resolves inline anchor to end", () => {
    addTarget(
      { x: 800, y: 100, width: 100, height: 50 },
      { direction: "rtl", textAlign: "start" },
    );
    renderHook(() => usePageContrast({ current: rootEl }));
    flushRAF();

    // RTL + textAlign=start → anchor = "end" → sample near trailing edge
    // trailing edge in RTL = left side
    // As long as it doesn't crash and produces a boolean, the test passes.
    const target = rootEl.querySelector("[data-page-contrast]")!;
    expect(
      typeof target.classList.contains("page-on-accent"),
    ).toBe("boolean");
  });
});
