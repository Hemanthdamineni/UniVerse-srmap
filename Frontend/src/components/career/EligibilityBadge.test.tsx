import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EligibilityBadge } from "./CareerChips";

describe("EligibilityBadge", () => {
  it("shows eligible state", () => {
    render(<EligibilityBadge eligible label="CSE" />);
    expect(screen.getByText(/Eligible: CSE/i)).toBeInTheDocument();
  });

  it("shows not eligible", () => {
    render(<EligibilityBadge eligible={false} label="ECE" />);
    expect(screen.getByText(/Not Eligible: ECE/i)).toBeInTheDocument();
  });
});
