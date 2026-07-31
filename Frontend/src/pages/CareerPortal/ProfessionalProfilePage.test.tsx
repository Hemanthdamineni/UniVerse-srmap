import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ProfessionalProfilePage from "./ProfessionalProfilePage";
import { getProfile, listResumeVersions } from "../../lib/career/careerApi";
import { getUnifiedProfile } from "../../lib/career/profileApi";

vi.mock("../../lib/career/careerApi", () => ({
  getProfile: vi.fn(),
  listResumeVersions: vi.fn(),
  updateProfile: vi.fn(),
  createResumeVersion: vi.fn(),
  mergeResumeToProfile: vi.fn(),
}));

vi.mock("../../lib/career/profileApi", () => ({
  getUnifiedProfile: vi.fn(),
  listProfileSkills: vi.fn(),
  syncProfileAchievements: vi.fn(),
}));

vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ profile: { name: "Test User", regNo: "REG123" } }),
}));

describe("ProfessionalProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    (getProfile as any).mockResolvedValue({
      bio: "Software developer",
      linkedinUrl: "https://linkedin.com",
      githubUrl: "",
      portfolioUrl: "",
      skills: ["React", "TypeScript"],
      email: "test@example.com"
    });

    (listResumeVersions as any).mockResolvedValue({ items: [] });

    (getUnifiedProfile as any).mockResolvedValue({
      user: {
        department: "Computer Science",
        branch: "B.Tech CSE",
        year: 3,
      },
      career: { skillGaps: [] },
      skills: [
        { skill: "JavaScript", source: "From courses" }
      ]
    });
  });

  it("renders the professional profile and identity info", async () => {
    render(
      <MemoryRouter>
        <ProfessionalProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("REG123")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
      expect(screen.getByText("Computer Science")).toBeInTheDocument();
    });

    // Check skills
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();

    // Check panels rendering
    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(screen.getByText("Competencies")).toBeInTheDocument();
    expect(screen.getByText("Proof")).toBeInTheDocument();
    expect(screen.getByText("Readiness Scorecard")).toBeInTheDocument();
  });
});
