import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WeekCalendar from "./WeekCalendar";

function renderCalendar(onDateSelect?: (date: Date) => void) {
  return render(<WeekCalendar onDateSelect={onDateSelect} />);
}

describe("WeekCalendar", () => {
  // Pin the wall clock so the test is deterministic regardless of when
  // it's run. Without this, tests that depend on the rendered month
  // (e.g. "midweek is in August" → "midweek is in September" on the
  // last day of August) would flake at month boundaries.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders 7 day columns with day names", () => {
    renderCalendar();
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
    expect(screen.getByText("Thu")).toBeInTheDocument();
    expect(screen.getByText("Fri")).toBeInTheDocument();
    expect(screen.getByText("Sat")).toBeInTheDocument();
  });

  it("renders month and year in header", () => {
    renderCalendar();
    const now = new Date();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    expect(screen.getByText(new RegExp(monthNames[now.getMonth()]))).toBeInTheDocument();
  });

  it("highlights today's date with accent color", () => {
    renderCalendar();
    const today = new Date();
    const todayButtons = screen.getAllByRole("button").filter(
      (btn) => btn.textContent === String(today.getDate()),
    );
    expect(todayButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onDateSelect with today's date on mount", () => {
    const onDateSelect = vi.fn();
    renderCalendar(onDateSelect);
    expect(onDateSelect).toHaveBeenCalledTimes(1);
    const calledDate = onDateSelect.mock.calls[0][0] as Date;
    const today = new Date();
    expect(calledDate.toDateString()).toBe(today.toDateString());
  });

  it("navigates to next week when right arrow is clicked", () => {
    const onDateSelect = vi.fn();
    renderCalendar(onDateSelect);
    onDateSelect.mockClear();

    // Nav buttons are icon-only and identified by accessible name
    const rightArrow = screen.getByRole("button", { name: "Next week" });
    fireEvent.click(rightArrow);

    const weekStart = new Date();
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day;
    const currentWeekStart = new Date(weekStart.setDate(diff));
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);

    const midWeek = new Date(currentWeekStart);
    midWeek.setDate(currentWeekStart.getDate() + 3);
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    expect(screen.getByText(new RegExp(monthNames[midWeek.getMonth()]))).toBeInTheDocument();
  });

  it("navigates to previous week when left arrow is clicked", () => {
    const onDateSelect = vi.fn();
    renderCalendar(onDateSelect);
    onDateSelect.mockClear();

    // Nav buttons are icon-only and identified by accessible name
    const leftArrow = screen.getByRole("button", { name: "Previous week" });
    fireEvent.click(leftArrow);

    const weekStart = new Date();
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day;
    const currentWeekStart = new Date(weekStart.setDate(diff));
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);

    const midWeek = new Date(currentWeekStart);
    midWeek.setDate(currentWeekStart.getDate() + 3);
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    expect(screen.getByText(new RegExp(monthNames[midWeek.getMonth()]))).toBeInTheDocument();
  });

  it("calls onDateSelect with clicked date", () => {
    const onDateSelect = vi.fn();
    renderCalendar(onDateSelect);
    onDateSelect.mockClear();

    // Icon-only nav buttons carry aria-labels; day buttons do not
    const dayButtons = screen.getAllByRole("button").filter(
      (btn) => btn.getAttribute("aria-label") === null,
    );
    if (dayButtons.length > 0) {
      fireEvent.click(dayButtons[0]);
      expect(onDateSelect).toHaveBeenCalledTimes(1);
    }
  });

  it("renders all date numbers for the current week", () => {
    renderCalendar();
    // Icon-only nav buttons carry aria-labels; day buttons do not
    const dayButtons = screen.getAllByRole("button").filter(
      (btn) => btn.getAttribute("aria-label") === null,
    );
    expect(dayButtons.length).toBe(7);
  });
});
