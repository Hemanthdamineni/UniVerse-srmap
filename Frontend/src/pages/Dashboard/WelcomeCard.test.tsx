import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import WelcomeCard from "./WelcomeCard";

vi.mock("../../lib/core/identity", () => ({
  getCurrentProfileName: vi.fn(),
  getCurrentRegNo: vi.fn(),
}));

import { getCurrentProfileName, getCurrentRegNo } from "../../lib/core/identity";

const ONBOARDING_SEEN_KEY = "erp.onboarding.seenVersion";

function renderCard(profileData?: Record<string, unknown> | null) {
  return render(<WelcomeCard profileData={profileData} />);
}

describe("WelcomeCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to returning-user behavior; first-run tests opt out below.
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
  });

  it("renders welcome message", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("John Doe");
    vi.mocked(getCurrentRegNo).mockReturnValue("AP23110010419");
    renderCard({});
    expect(screen.getByText("Welcome back!")).toBeInTheDocument();
  });

  it("displays student name from profile", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("Alice Smith");
    vi.mocked(getCurrentRegNo).mockReturnValue("AP23110010419");
    renderCard({});
    expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
  });

  it("displays register number when available", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("Bob");
    vi.mocked(getCurrentRegNo).mockReturnValue("AP23110010500");
    renderCard({});
    expect(screen.getByText(/Register No\. AP23110010500/)).toBeInTheDocument();
  });

  it("omits register number portion when regNo is empty", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("Charlie");
    vi.mocked(getCurrentRegNo).mockReturnValue("");
    renderCard({});
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.queryByText(/Register No\./)).not.toBeInTheDocument();
  });

  it("renders with null profileData", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("Student");
    vi.mocked(getCurrentRegNo).mockReturnValue("");
    renderCard(null);
    expect(screen.getByText("Welcome back!")).toBeInTheDocument();
  });

  it("renders no interactive controls (decorative bell was removed)", () => {
    vi.mocked(getCurrentProfileName).mockReturnValue("Dana");
    vi.mocked(getCurrentRegNo).mockReturnValue("");
    renderCard({});
    // The bell button was removed: it had no handler and its permanently
    // lit red dot implied false notifications.
    expect(document.querySelector("button")).not.toBeInTheDocument();
  });

  // --- First-login variant ---

  it("greets first-time users by first name", () => {
    window.localStorage.removeItem(ONBOARDING_SEEN_KEY);
    vi.mocked(getCurrentProfileName).mockReturnValue("Alice Johnson");
    vi.mocked(getCurrentRegNo).mockReturnValue("AP23110010419");

    renderCard({});

    expect(screen.getByText("Welcome, Alice!")).toBeInTheDocument();
    expect(screen.queryByText("Welcome back!")).not.toBeInTheDocument();
    expect(screen.getByText(/Register No\. AP23110010419/)).toBeInTheDocument();
  });

  it("falls back to a generic greeting when no name is available", () => {
    window.localStorage.removeItem(ONBOARDING_SEEN_KEY);
    vi.mocked(getCurrentProfileName).mockReturnValue("");

    renderCard(null);

    expect(screen.getByText("Welcome!")).toBeInTheDocument();
  });
});
