import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the correct label for a given status", () => {
    render(<StatusBadge status="ongoing" />);
    expect(screen.getByText(/In Progress/i)).toBeInTheDocument();
  });

  it("applies the pulse animation for 'ongoing'", () => {
    const { container } = render(<StatusBadge status="ongoing" />);
    // Pulse animation adds a specific pulse span alongside the text
    expect(container.querySelector(".status-pulse")).toBeInTheDocument();
  });

  it("does not apply pulse for static statuses like 'draft'", () => {
    const { container } = render(<StatusBadge status="draft" />);
    expect(screen.getByText(/Draft/i)).toBeInTheDocument();
    expect(container.querySelector(".status-pulse")).toBeNull();
  });

  it("uses the correct ARIA attributes", () => {
    render(<StatusBadge status="results-published" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveAttribute("aria-label", "results-published");
  });
});
