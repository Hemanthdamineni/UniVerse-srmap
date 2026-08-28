import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import WelcomeCard from "./WelcomeCard";

vi.mock("../../lib/core/identity", () => ({
  getCurrentProfileName: vi.fn(),
}));

import { getCurrentProfileName } from "../../lib/core/identity";

// Pin the wall clock so time-of-day greetings are deterministic.
function atTime(hour: number) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 24, hour, 0)); // Monday, 24 August 2026
}

afterEach(() => {
  vi.useRealTimers();
});

describe("WelcomeCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    atTime(9);
  });

  it("greets by the properly cased first name in the morning", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("DAMINENI HEMANTH SATYA VEER");
    render(<WelcomeCard profileData={{}} />);
    expect(screen.getByRole("heading", { name: "Good morning, Damineni!" })).toBeInTheDocument();
  });

  it("switches greeting with time of day", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("Alice Smith");

    atTime(13);
    const { rerender } = render(<WelcomeCard profileData={{}} />);
    expect(screen.getByRole("heading", { name: "Good afternoon, Alice!" })).toBeInTheDocument();

    atTime(20);
    rerender(<WelcomeCard profileData={{}} />);
    expect(screen.getByRole("heading", { name: "Good evening, Alice!" })).toBeInTheDocument();
  });

  it("shows today's date below the greeting", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("Alice Smith");
    render(<WelcomeCard profileData={{}} />);
    expect(screen.getByText("Monday, 24 August")).toBeInTheDocument();
  });

  it("renders a two-letter monogram from the name", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("DAMINENI HEMANTH SATYA VEER");
    render(<WelcomeCard profileData={{}} />);
    const avatar = document.querySelector(".welcome-avatar");
    expect(avatar).toHaveTextContent("DH");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
  });

  it("leaves genuinely mixed-case names untouched", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("McDonald Alice");
    render(<WelcomeCard profileData={{}} />);
    expect(screen.getByRole("heading", { name: "Good morning, McDonald!" })).toBeInTheDocument();
  });

  it("omits the name and monogram for the generic Student fallback", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("Student");
    render(<WelcomeCard profileData={{}} />);
    expect(screen.getByRole("heading", { name: "Good morning!" })).toBeInTheDocument();
    expect(document.querySelector(".welcome-avatar")).not.toBeInTheDocument();
  });

  it("falls back to a nameless greeting when no name is available", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("");
    render(<WelcomeCard profileData={null} />);
    expect(screen.getByRole("heading", { name: "Good morning!" })).toBeInTheDocument();
    expect(document.querySelector(".welcome-avatar")).not.toBeInTheDocument();
  });

  it("renders no interactive controls (decorative bell was removed)", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("Dana Lane");
    render(<WelcomeCard profileData={{}} />);
    // The bell button was removed: it had no handler and its permanently
    // lit red dot implied false notifications.
    expect(document.querySelector("button")).not.toBeInTheDocument();
  });
});
