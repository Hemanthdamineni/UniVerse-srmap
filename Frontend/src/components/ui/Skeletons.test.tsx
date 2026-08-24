import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErpPageShell } from "../erp/ErpPrimitives";
import { PageSkeleton } from "./Skeletons";

describe("PageSkeleton", () => {
  it("announces the loading message to screen readers without rendering it visually", () => {
    render(<PageSkeleton message="Loading paid fees..." />);
    const message = screen.getByText("Loading paid fees...");
    expect(message).toHaveClass("sr-only");
  });

  it("exposes a polite status region with aria-busy", () => {
    render(<PageSkeleton message="Loading..." />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("hides decorative shimmer bars from the accessibility tree", () => {
    const { container } = render(<PageSkeleton message="Loading..." />);
    const decorative = container.querySelector("div[aria-hidden='true']");
    expect(decorative).not.toBeNull();
    decorative!.querySelectorAll(".skeleton-shimmer").forEach((bar) => {
      expect(bar.closest("[aria-hidden='true']")).not.toBeNull();
    });
  });

  it("defaults to the table variant", () => {
    const { container } = render(<PageSkeleton />);
    // Table skeleton: header bar + rotated-width rows inside a table card.
    const rows = container.querySelectorAll(".dashboard-card.overflow-hidden");
    expect(rows.length).toBe(1);
  });

  it("stats variant renders a KPI grid, tab bar, and table card", () => {
    const { container } = render(<PageSkeleton variant="stats" />);
    const kpiGrid = container.querySelector(".grid.md\\:grid-cols-2");
    expect(kpiGrid).not.toBeNull();
    expect(kpiGrid!.childElementCount).toBe(4);
    expect(container.querySelectorAll(".dashboard-card").length).toBe(5);
  });

  it("document variant renders a single document card", () => {
    const { container } = render(<PageSkeleton variant="document" />);
    expect(container.querySelectorAll(".dashboard-card").length).toBe(1);
  });
});

describe("ErpPageShell loading state", () => {
  function Shell({ isLoading }: { isLoading: boolean }) {
    return (
      <ErpPageShell
        title="Fees Paid"
        source="Live ERP"
        isLoading={isLoading}
        loadingMessage="Loading paid fees..."
      >
        <div data-testid="page-content">Paid receipts table</div>
      </ErpPageShell>
    );
  }

  it("replaces children with the layout skeleton while loading", () => {
    render(<Shell isLoading />);
    expect(screen.getByText("Loading paid fees...")).toBeInTheDocument();
    expect(screen.queryByTestId("page-content")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders children and drops the skeleton once loading finishes", () => {
    render(<Shell isLoading={false} />);
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(screen.queryByText("Loading paid fees...")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
