import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CareerProfilePage from "./CareerProfilePage";
import type { UnifiedProfileAchievement } from "../../lib/career/profileApi";

const getProfile = vi.fn();
const updateProfile = vi.fn(() => Promise.resolve({ updated: true }));
const listResumeVersions = vi.fn(() => Promise.resolve({ items: [] }));
const createResumeVersion = vi.fn(() =>
  Promise.resolve({
    id: "r1",
    userId: "u1",
    fileName: "cv.txt",
    filePath: "/uploads/cv.txt",
    mimeType: "text/plain",
    extractedText: "React TypeScript project",
    parsedJson: {
      skills: ["React", "TypeScript"],
      links: [],
      quantifiedImpacts: ["300 students"],
      projects: ["React dashboard"],
      experience: [],
      certifications: [],
      wordCount: 120,
      hasGithub: false,
      hasLinkedin: false,
      hasPortfolio: false,
    },
    qualityScore: 74,
    createdAt: "2026-01-01",
    analysis: {
      score: 74,
      rubric: [],
      suggestions: ["Add measurable outcomes."],
    },
  })
);
const mergeResumeToProfile = vi.fn(() =>
  Promise.resolve({
    updated: true,
    profile: {
      userId: "u1",
      skills: ["Rust", "React", "TypeScript"],
      preferredTypes: [],
      preferredLocations: ["Remote"],
      minStipend: "",
      linkedinUrl: "",
      githubUrl: "",
      portfolioUrl: "",
      updatedAt: "2026-01-01",
    },
    mergedSkills: ["React", "TypeScript"],
  })
);
const listProfileAchievements = vi.fn(() => Promise.resolve({ items: [] as UnifiedProfileAchievement[] }));
const syncProfileAchievements = vi.fn(() => Promise.resolve({ synced: [] }));
const getProfilePrivacy = vi.fn(() => Promise.resolve({ inferredSkills: "private", achievements: "private" }));
const getMyPublicCareerProfilePreview = vi.fn(() =>
  Promise.resolve({
    contractVersion: "career-public-profile-v1",
    audience: "public",
    user: { userId: "u1", name: "Student One" },
    headline: "Frontend student",
    bio: "Frontend student",
    links: {},
    skills: [],
    achievements: [],
    stats: { visibleSkillCount: 0, visibleAchievementCount: 0, profileCompleteness: 65 },
    updatedAt: "2026-01-01",
  })
);
const updateProfilePrivacy = vi.fn(() => Promise.resolve({ inferredSkills: "public", achievements: "private" }));
const updateAchievementVisibility = vi.fn((achievementId: string, visibility: string) =>
  Promise.resolve({
    id: achievementId,
    userId: "u1",
    type: "competition_submission",
    title: "Finalist in Campus Hackathon",
    sourceDomain: "events",
    verificationState: "verified",
    skills: ["React", "Teamwork"],
    visibility,
    achievedAt: "2026-02-01T00:00:00.000Z",
    createdAt: "2026-02-01T00:00:00.000Z",
  })
);
const downloadPublicCareerProfileMarkdown = vi.fn(() => ({
  fileName: "student-one-career-profile.md",
  markdown: "# Student One",
}));

vi.mock("../../lib/career/careerApi", () => ({
  get getProfile() {
    return getProfile;
  },
  get updateProfile() {
    return updateProfile;
  },
  get listResumeVersions() {
    return listResumeVersions;
  },
  get createResumeVersion() {
    return createResumeVersion;
  },
  get mergeResumeToProfile() {
    return mergeResumeToProfile;
  },
}));

vi.mock("../../lib/career/profileApi", () => ({
  get getProfilePrivacy() {
    return getProfilePrivacy;
  },
  get getMyPublicCareerProfilePreview() {
    return getMyPublicCareerProfilePreview;
  },
  get listProfileAchievements() {
    return listProfileAchievements;
  },
  get syncProfileAchievements() {
    return syncProfileAchievements;
  },
  get updateProfilePrivacy() {
    return updateProfilePrivacy;
  },
  get updateAchievementVisibility() {
    return updateAchievementVisibility;
  },
}));

vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ profile: null, loading: false }),
}));

vi.mock("../../lib/career/publicProfileExport", () => ({
  get downloadPublicCareerProfileMarkdown() {
    return downloadPublicCareerProfileMarkdown;
  },
}));

describe("CareerProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listResumeVersions.mockResolvedValue({ items: [] });
    listProfileAchievements.mockResolvedValue({ items: [] });
    syncProfileAchievements.mockResolvedValue({ synced: [] });
    getProfilePrivacy.mockResolvedValue({ inferredSkills: "private", achievements: "private" });
    getMyPublicCareerProfilePreview.mockResolvedValue({
      contractVersion: "career-public-profile-v1",
      audience: "public",
      user: { userId: "u1", name: "Student One" },
      headline: "Frontend student",
      bio: "Frontend student",
      links: {},
      skills: [],
      achievements: [],
      stats: { visibleSkillCount: 0, visibleAchievementCount: 0, profileCompleteness: 65 },
      updatedAt: "2026-01-01",
    });
    updateProfilePrivacy.mockResolvedValue({ inferredSkills: "public", achievements: "private" });
    downloadPublicCareerProfileMarkdown.mockReturnValue({
      fileName: "student-one-career-profile.md",
      markdown: "# Student One",
    });
    updateAchievementVisibility.mockImplementation((achievementId: string, visibility: string) =>
      Promise.resolve({
        id: achievementId,
        userId: "u1",
        type: "competition_submission",
        title: "Finalist in Campus Hackathon",
        sourceDomain: "events",
        verificationState: "verified",
        skills: ["React", "Teamwork"],
        visibility,
        achievedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-02-01T00:00:00.000Z",
      })
    );
    getProfile.mockResolvedValue({
      userId: "u1",
      skills: ["Rust"],
      preferredTypes: [],
      preferredLocations: ["Remote"],
      minStipend: "",
      linkedinUrl: "",
      githubUrl: "",
      portfolioUrl: "",
      updatedAt: "2026-01-01",
    });
  });

  it("loads profile and saves changes", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CareerProfilePage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Rust")).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText("LinkedIn URL"), "https://linkedin.com/in/me");
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
  });

  it("adds a skill via input and plus button", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CareerProfilePage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Rust")).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/Python, React/i), "Go");
    const plusButtons = screen.getAllByRole("button").filter((b) => b.querySelector("svg.lucide-plus"));
    await user.click(plusButtons[0]);
    await waitFor(() => expect(screen.getByText("Go")).toBeInTheDocument());
  });

  it("analyzes resume when file selected and can merge skills", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CareerProfilePage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Career Profile" })).toBeInTheDocument());
    const input = document.getElementById("resume-upload") as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File(["React TypeScript project"], "cv.txt", { type: "text/plain" });
    await user.upload(input, file);
    await waitFor(() =>
      expect(createResumeVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: "cv.txt",
          mimeType: "text/plain",
          extractedText: "React TypeScript project",
        })
      )
    );
    expect(await screen.findByText("74/100")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Sync skills to profile/i }));
    await waitFor(() => expect(mergeResumeToProfile).toHaveBeenCalledWith("r1"));
    await waitFor(() => expect(screen.getAllByText("TypeScript").length).toBeGreaterThan(0));
  });

  it("shows verified achievements and updates their visibility", async () => {
    const user = userEvent.setup();
    listProfileAchievements.mockResolvedValue({
      items: [
        {
          id: "ach-1",
          userId: "u1",
          type: "competition_submission",
          title: "Finalist in Campus Hackathon",
          sourceDomain: "events",
          verificationState: "verified",
          skills: ["React", "Teamwork"],
          visibility: "private",
          achievedAt: "2026-02-01T00:00:00.000Z",
          createdAt: "2026-02-01T00:00:00.000Z",
        },
      ],
    });

    render(
      <MemoryRouter>
        <CareerProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Finalist in Campus Hackathon")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Visibility for Finalist in Campus Hackathon"), "employers");

    await waitFor(() => expect(updateAchievementVisibility).toHaveBeenCalledWith("ach-1", "employers"));
    await waitFor(() => expect(screen.getByText("Achievement visibility updated.")).toBeInTheDocument());
  });

  it("syncs achievements from events", async () => {
    const user = userEvent.setup();
    listProfileAchievements
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        items: [
          {
            id: "ach-2",
            userId: "u1",
            type: "competition_shortlist",
            title: "Selected for Robotics Finals",
            sourceDomain: "events",
            verificationState: "verified",
            skills: ["Robotics"],
            visibility: "private",
            achievedAt: "2026-03-01T00:00:00.000Z",
            createdAt: "2026-03-01T00:00:00.000Z",
          },
        ],
      });

    render(
      <MemoryRouter>
        <CareerProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("No verified achievements yet")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Sync/i }));

    await waitFor(() => expect(syncProfileAchievements).toHaveBeenCalled());
    expect(await screen.findByText("Selected for Robotics Finals")).toBeInTheDocument();
  });

  it("updates public portfolio skill audience", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CareerProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Public Portfolio")).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText("Public profile skills audience"), "public");

    await waitFor(() => expect(updateProfilePrivacy).toHaveBeenCalledWith({ inferredSkills: "public" }));
    await waitFor(() => expect(screen.getByText("Public profile skill visibility updated.")).toBeInTheDocument());
  });

  it("downloads public portfolio markdown from owner profile", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CareerProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Public Portfolio")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Download/i }));

    await waitFor(() => expect(downloadPublicCareerProfileMarkdown).toHaveBeenCalledWith(expect.objectContaining({
      contractVersion: "career-public-profile-v1",
    })));
    expect(screen.getByText("Public profile Markdown downloaded.")).toBeInTheDocument();
  });
});
