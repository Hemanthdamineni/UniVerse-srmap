import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, renderHook, act, cleanup } from "@testing-library/react";
import React from "react";
import { useIntersectionObserver } from "./useIntersectionObserver";

// ---------------------------------------------------------------------------
// Types for the mock IntersectionObserver
// ---------------------------------------------------------------------------
type ObserverInstance = {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  /** The callback passed to the constructor – stored so tests can fire it. */
  _callback: IntersectionObserverCallback;
};

// ---------------------------------------------------------------------------
// Mock factory – collects instances so tests can inspect and trigger them
// ---------------------------------------------------------------------------
let mockInstances: ObserverInstance[] = [];

beforeEach(() => {
  mockInstances = [];
  // Use a regular function so `new IntersectionObserver(...)` works (arrow
  // functions are not constructors).
  function MockCtor(
    this: ObserverInstance,
    callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
    this._callback = callback;
    mockInstances.push(this);
  }
  vi.stubGlobal("IntersectionObserver", vi.fn(MockCtor) as unknown as typeof IntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate an intersection entry for the latest (or indexed) observer. */
function simulateIntersection(
  isIntersecting: boolean,
  { index = 0 }: { index?: number } = {},
) {
  const inst = mockInstances[index];
  if (!inst) throw new Error(`No mock observer at index ${index}`);
  act(() => {
    inst._callback(
      [
        {
          isIntersecting,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          target: document.createElement("div"),
          time: performance.now(),
        },
      ],
      inst as unknown as IntersectionObserver,
    );
  });
}

/** Return the indexed mock observer instance. */
function getObserver(index = 0): ObserverInstance {
  const inst = mockInstances[index];
  if (!inst) throw new Error(`No mock observer at index ${index}`);
  return inst;
}

// ---------------------------------------------------------------------------
// Wrapper component that mounts a real DOM node so the ref activates
// ---------------------------------------------------------------------------
function TestComponent({
  threshold,
  rootMargin,
  once,
}: {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}) {
  const { ref } = useIntersectionObserver({ threshold, rootMargin, once });
  return <div ref={ref as React.RefObject<HTMLDivElement | null>} />;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("useIntersectionObserver", () => {
  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------
  it("returns a ref and isVisible = false initially", () => {
    const { result } = renderHook(() => useIntersectionObserver());
    expect(result.current.isVisible).toBe(false);
    expect(result.current.ref).toBeDefined();
    expect(result.current.ref.current).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Observing when ref is attached via component mount
  // -----------------------------------------------------------------------
  it("calls observe on the element when the component mounts", () => {
    render(<TestComponent />);
    expect(mockInstances.length).toBe(1);
    const obs = getObserver();
    expect(obs.observe).toHaveBeenCalledTimes(1);
    // The argument should be an HTML element
    expect(obs.observe.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
  });

  // -----------------------------------------------------------------------
  // Callback on intersection (once mode – sets true and stays)
  // -----------------------------------------------------------------------
  it("sets isVisible to true when element becomes intersecting (once=true)", () => {
    function AssertComponent() {
      const { ref, isVisible } = useIntersectionObserver({ once: true });
      return (
        <div ref={ref as React.RefObject<HTMLDivElement | null>}>
          <span data-testid="visible">{String(isVisible)}</span>
        </div>
      );
    }
    const { getByTestId } = render(<AssertComponent />);
    expect(getByTestId("visible").textContent).toBe("false");

    simulateIntersection(true);
    expect(getByTestId("visible").textContent).toBe("true");
  });

  // -----------------------------------------------------------------------
  // once=true unobserve()s the element after first intersection
  // -----------------------------------------------------------------------
  it("unobserves the element after first intersection when once=true", () => {
    render(<TestComponent once />);
    const obs = getObserver();
    expect(obs.unobserve).not.toHaveBeenCalled();

    simulateIntersection(true);
    expect(obs.unobserve).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // once=false – toggles isVisible on enter/leave
  // -----------------------------------------------------------------------
  it("toggles isVisible on enter/leave when once=false", () => {
    function AssertComponent() {
      const { ref, isVisible } = useIntersectionObserver({ once: false });
      return (
        <div ref={ref as React.RefObject<HTMLDivElement | null>}>
          <span data-testid="visible">{String(isVisible)}</span>
        </div>
      );
    }
    const { getByTestId } = render(<AssertComponent />);
    const el = getByTestId("visible");

    // Enter
    simulateIntersection(true);
    expect(el.textContent).toBe("true");

    // Leave
    simulateIntersection(false);
    expect(el.textContent).toBe("false");

    // Re-enter
    simulateIntersection(true);
    expect(el.textContent).toBe("true");
  });

  // -----------------------------------------------------------------------
  // Cleanup on unmount
  // -----------------------------------------------------------------------
  it("disconnects the observer on unmount", () => {
    const { unmount } = render(<TestComponent />);
    const obs = getObserver();
    expect(obs.disconnect).not.toHaveBeenCalled();

    unmount();
    expect(obs.disconnect).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Missing ref (null ref.current) – nothing crashes
  // -----------------------------------------------------------------------
  it("does nothing when ref.current stays null", () => {
    // Using renderHook without mounting any element – the effect runs with
    // ref.current === null and returns early.
    renderHook(() => useIntersectionObserver());
    expect(mockInstances.length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Custom threshold is forwarded to constructor
  // -----------------------------------------------------------------------
  it("passes threshold to IntersectionObserver", () => {
    render(<TestComponent threshold={0.5} />);

    expect(IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: 0.5 }),
    );
  });

  // -----------------------------------------------------------------------
  // Default threshold is 0
  // -----------------------------------------------------------------------
  it("uses default threshold of 0 when not provided", () => {
    render(<TestComponent />);

    expect(IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: 0 }),
    );
  });

  // -----------------------------------------------------------------------
  // Custom rootMargin is forwarded
  // -----------------------------------------------------------------------
  it("passes rootMargin to IntersectionObserver", () => {
    render(<TestComponent rootMargin="10px 20px" />);

    expect(IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ rootMargin: "10px 20px" }),
    );
  });

  // -----------------------------------------------------------------------
  // Default rootMargin
  // -----------------------------------------------------------------------
  it("uses default rootMargin of 0px when not provided", () => {
    render(<TestComponent />);

    expect(IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ rootMargin: "0px" }),
    );
  });

  // -----------------------------------------------------------------------
  // Re-creates observer when options change
  // -----------------------------------------------------------------------
  it("re-creates observer when threshold changes", () => {
    const { rerender } = render(
      <TestComponent threshold={0.1} />,
    );

    expect(mockInstances.length).toBe(1);

    rerender(<TestComponent threshold={0.5} />);
    expect(mockInstances.length).toBe(2);

    expect(IntersectionObserver).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: 0.5 }),
    );
  });

  // -----------------------------------------------------------------------
  // Disconnect old observer on option change (cleanup)
  // -----------------------------------------------------------------------
  it("disconnects the previous observer when threshold changes", () => {
    const { rerender } = render(
      <TestComponent threshold={0.1} />,
    );

    getObserver(0); // assert exists
    rerender(<TestComponent threshold={0.5} />);

    expect(getObserver(0).disconnect).toHaveBeenCalledTimes(1);
    expect(getObserver(1).disconnect).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // once=false does not call unobserve on enter
  // -----------------------------------------------------------------------
  it("does not call unobserve when once=false and element enters", () => {
    render(<TestComponent once={false} />);
    const obs = getObserver();

    simulateIntersection(true);
    expect(obs.unobserve).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Ref object identity is stable across renders
  // -----------------------------------------------------------------------
  it("returns a stable ref object across renders", () => {
    const { result, rerender } = renderHook(() =>
      useIntersectionObserver(),
    );
    const firstRef = result.current.ref;
    rerender();
    expect(result.current.ref).toBe(firstRef);
  });

  // -----------------------------------------------------------------------
  // Only one observer created per effect cycle
  // -----------------------------------------------------------------------
  it("creates exactly one observer per stable options", () => {
    const { rerender } = render(<TestComponent />);
    expect(mockInstances.length).toBe(1);

    // Re-render with same props – effect deps haven't changed, no new observer
    rerender(<TestComponent />);
    expect(mockInstances.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Changing `once` re-creates observer
  // -----------------------------------------------------------------------
  it("re-creates observer when once changes", () => {
    const { rerender } = render(<TestComponent once />);
    expect(mockInstances.length).toBe(1);

    rerender(<TestComponent once={false} />);
    expect(mockInstances.length).toBe(2);
  });

});
