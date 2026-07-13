import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PublicCareerProfilePage from "./PublicCareerProfilePage";

const getPublicCareerProfile = vi.fn();
const downloadPublicCareerProfileMarkdown = vi.fn(() => ({
  fileName: "student-one-career-profile.md",
  markdown: "# Student One",
}));

vi.mock("../../lib/career/profileApi", () => ({
  get getPublicCareerProfile() {
    return getPublicCareerProfile;
  },
}));

vi.mock("../../lib/core/analytics", () => ({
  track: vi.fn(),
}));

vi.mock("../../lib/career/publicProfileExport", () => ({
  get downloadPublicCareerProfileMarkdown() {
    return downloadPublicCareerProfileMarkdown;
  },
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/career/public/:userId" element={<PublicCareerProfilePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PublicCareerProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublicCareerProfile.mockResolvedValue({
      contractVersion: "career-public-profile-v1",
      audience: "public",
      user: {
        userId: "AP23110010001",
        name: "Student One",
        branch: "Computer Science",
        year: 3,
        department: "CSE",
      },
      headline: "Frontend student building campus products",
      bio: "Frontend student building campus products",
      links: {
        linkedinUrl: "https://linkedin.example/student",
        githubUrl: "https://github.example/student",
      },
      skills: [
        {
          userId: "AP23110010001",
          skill: "React",
          source: "career_profile",
          confidence: 0.8,
          evidenceRefs: ["career_profile"],
          visibility: "public",
          updatedAt: "2026-01-01",
        },
      ],
      achievements: [
        {
          id: "ach-1",
          userId: "AP23110010001",
          type: "competition_shortlist",
          title: "Shortlisted in Campus Hackathon",
          sourceDomain: "events",
          verificationState: "verified",
          skills: ["React"],
          visibility: "public",
          achievedAt: "2026-07-03T00:00:00.000Z",
          createdAt: "2026-07-03T00:00:00.000Z",
        },
      ],
      stats: {
        visibleSkillCount: 1,
        visibleAchievementCount: 1,
        profileCompleteness: 75,
      },
      updatedAt: "2026-07-03T00:00:00.000Z",
    });
  });

  it("renders the public portfolio payload", async () => {
    renderAt("/career/public/AP23110010001");

    await waitFor(() => expect(getPublicCareerProfile).toHaveBeenCalledWith("AP23110010001"));
    expect(await screen.findByText("Student One")).toBeInTheDocument();
    expect(screen.getByText("Frontend student building campus products")).toBeInTheDocument();
    expect(screen.getAllByText("React").length).toBeGreaterThan(0);
    expect(screen.getByText("Shortlisted in Campus Hackathon")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /LinkedIn/i })).toHaveAttribute("href", "https://linkedin.example/student");
  });

  it("downloads the public profile markdown export", async () => {
    const user = userEvent.setup();
    renderAt("/career/public/AP23110010001");

    expect(await screen.findByText("Student One")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Download/i }));

    expect(downloadPublicCareerProfileMarkdown).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ userId: "AP23110010001" }),
    }));
  });

  it("shows unavailable state when public profile fails", async () => {
    getPublicCareerProfile.mockRejectedValue(new Error("not found"));
    renderAt("/career/public/missing");

    expect(await screen.findByText("Profile unavailable")).toBeInTheDocument();
    expect(screen.getByText("not found")).toBeInTheDocument();
  });
});
