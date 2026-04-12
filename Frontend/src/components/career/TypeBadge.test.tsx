import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TypeBadge from "./TypeBadge";

describe("TypeBadge", () => {
  it("renders job label", () => {
    render(<TypeBadge type="job" />);
    expect(screen.getByText(/job/i)).toBeInTheDocument();
  });
});
