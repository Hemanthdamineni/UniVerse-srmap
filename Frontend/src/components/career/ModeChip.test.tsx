import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModeChip } from "./CareerChips";

describe("ModeChip", () => {
  it("renders remote", () => {
    render(<ModeChip mode="remote" />);
    expect(screen.getByText(/remote/i)).toBeInTheDocument();
  });

  it("renders nothing without mode", () => {
    const { container } = render(<ModeChip />);
    expect(container.firstChild).toBeNull();
  });
});
