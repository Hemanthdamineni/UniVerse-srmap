import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeadlineBadge } from "./CareerChips";

describe("DeadlineBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-11T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders null when no deadline", () => {
    const { container } = render(<DeadlineBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("shows today chip when deadline equals now (same instant)", () => {
    render(<DeadlineBadge deadline="2026-04-11T12:00:00.000Z" />);
    expect(screen.getByText(/Today/i)).toBeInTheDocument();
  });

  it("shows urgent copy under 3 days", () => {
    render(<DeadlineBadge deadline="2026-04-13T12:00:00.000Z" />);
    expect(screen.getByText(/left/i)).toBeInTheDocument();
  });

  it("shows Expired when deadline passed", () => {
    render(<DeadlineBadge deadline="2026-01-01T00:00:00.000Z" />);
    expect(screen.getByText(/Expired/i)).toBeInTheDocument();
  });

  it("shows calendar date when far away", () => {
    render(<DeadlineBadge deadline="2026-08-15T00:00:00.000Z" />);
    expect(screen.getByText(/Deadline:/i)).toBeInTheDocument();
  });
});
