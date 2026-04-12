import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SourceBadge from "./SourceBadge";

describe("SourceBadge", () => {
  it("renders manual source", () => {
    render(<SourceBadge source="manual" />);
    expect(screen.getByText(/via manual/i)).toBeInTheDocument();
  });

  it("normalizes jobspy label", () => {
    render(<SourceBadge source="jobspy" />);
    expect(screen.getByText(/via LinkedIn/i)).toBeInTheDocument();
  });
});
