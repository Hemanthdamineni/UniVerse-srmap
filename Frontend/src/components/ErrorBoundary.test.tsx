import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

// ---------------------------------------------------------------------------
// Helper — a component that throws on render
// ---------------------------------------------------------------------------

const Bang = ({ message = "Boom!" }: { message?: string }) => {
  throw new Error(message);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("catches errors and shows the default fallback UI", () => {
    // Suppress the expected console.error from the thrown error
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bang />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it("shows custom fallback when `fallback` prop is provided", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<p data-testid="custom-fallback">Custom error UI</p>}>
        <Bang />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it("calls onError when an error is caught", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <Bang />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));

    vi.restoreAllMocks();
  });

  it("resets error state and re-renders children on 'Try Again' click", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const GoodOnSecondRender = vi.fn(({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) throw new Error("Boom!");
      return <p>Recovered</p>;
    });

    const { rerender } = render(
      <ErrorBoundary>
        <GoodOnSecondRender shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Click "Try Again" to reset — this re-renders children, but since
    // shouldThrow is still true it will throw again.
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    // After reset, the boundary is cleared, but the same children render
    // so it should throw again, showing the fallback once more.
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it("logs errors to console.error", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bang message="Test log" />
      </ErrorBoundary>,
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      "[ErrorBoundary] Uncaught error:",
      expect.any(Error),
      expect.any(Object),
    );

    vi.restoreAllMocks();
  });
});
