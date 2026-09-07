import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceBadge } from "./CareerChips";

describe("SourceBadge", () => {
  it("renders nothing for internal-only origins (no 'VIA MANUAL' leak)", () => {
    const { container } = render(<SourceBadge source="manual" />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/manual/i)).not.toBeInTheDocument();
  });

  it("renders nothing for seed / internal / admin sources", () => {
    for (const source of ["seed", "internal", "admin"]) {
      const { container } = render(<SourceBadge source={source} />);
      expect(container).toBeEmptyDOMElement();
    }
  });

  it("normalizes jobspy to a real portal name", () => {
    render(<SourceBadge source="jobspy" />);
    expect(screen.getByText(/via LinkedIn/i)).toBeInTheDocument();
  });

  it("shows a friendly name for known portals", () => {
    render(<SourceBadge source="unstop" />);
    expect(screen.getByText(/via Unstop/i)).toBeInTheDocument();
  });

  it("passes an unknown source through rather than hiding it", () => {
    render(<SourceBadge source="TechFest" />);
    expect(screen.getByText(/via TechFest/i)).toBeInTheDocument();
  });
});
