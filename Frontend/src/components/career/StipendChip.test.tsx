import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StipendChip } from "./CareerChips";

describe("StipendChip", () => {
  it("shows stipend when provided", () => {
    render(<StipendChip stipend="₹20,000/mo" isFree={false} />);
    expect(screen.getByText(/20,000/i)).toBeInTheDocument();
  });

  it("shows prize when no stipend", () => {
    render(<StipendChip prize="₹1L" />);
    expect(screen.getByText(/Prize:/i)).toBeInTheDocument();
  });

  it("shows paid when not free and no money fields", () => {
    render(<StipendChip isFree={false} />);
    expect(screen.getByText(/Paid Opportunity/i)).toBeInTheDocument();
  });

  it("shows Free when free and no stipend", () => {
    render(<StipendChip isFree />);
    expect(screen.getByText(/^Free$/i)).toBeInTheDocument();
  });
});
