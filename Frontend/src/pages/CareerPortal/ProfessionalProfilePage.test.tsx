import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ProfessionalProfilePage from "./ProfessionalProfilePage";
import {
  getProfile,
  updateProfile,
  uploadResumeFile,
  mergeResumeToProfile,
  listResumeVersions,
} from "../../lib/career/careerApi";
import {
  getUnifiedProfile,
  getProfilePrivacy,
  getMyPublicCareerProfilePreview,
  listProfileAchievements,
  syncProfileAchievements,
  updateAchievementVisibility,
  updateProfilePrivacy,
} from "../../lib/career/profileApi";
import { downloadPublicCareerProfileMarkdown } from "../../lib/career/publicProfileExport";

vi.mock("../../lib/career/careerApi", () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(() => Promise.resolve({ updated: true })),
  uploadResumeFile: vi.fn(),
  mergeResumeToProfile: vi.fn(),
  listResumeVersions: vi.fn(() => Promise.resolve({ items: [] })),
}));

vi.mock("../../lib/career/profileApi", () => ({
  getUnifiedProfile: vi.fn(),
  getProfilePrivacy: vi.fn(),
  getMyPublicCareerProfilePreview: vi.fn(),
  listProfileAchievements: vi.fn(),
  syncProfileAchievements: vi.fn(() => Promise.resolve({ synced: [] })),
  updateAchievementVisibility: vi.fn(),
  updateProfilePrivacy: vi.fn(),
}));

vi.mock("../../lib/career/publicProfileExport", () => ({
  downloadPublicCareerProfileMarkdown: vi.fn(() => ({
    fileName: "student-one-career-profile.md",
    markdown: "# Student One",
  })),
}));

vi.mock("../../lib/core/analytics", () => ({ track: vi.fn() }));

vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ profile: { name: "Test User", regNo: "REG123" } }),
}));

const RESUME_VERSION = {
  id: "r1",
  userId: "u1",
  fileName: "cv.txt",
  filePath: "/uploads/cv.txt",
  mimeType: "text/plain",
  extractedText: "React TypeScript project",
  parsedJson: {
    name: "CV Owner",
    email: "cv@example.com",
    skills: ["React", "TypeScript"],
    links: [],
    quantifiedImpacts: ["300 students"],
    education: [{ degree: "B.Tech CSE", institution: "SRM University AP", year: "2026", gpa: "9.0" }],
    projects: [{ title: "React dashboard", bulletCount: 2 }],
    experience: [{ title: "Frontend Intern", org: "Acme", dateRange: "2025", bulletCount: 3 }],
    certifications: [],
    sections: ["education", "experience", "projects", "skills"],
    wordCount: 120,
    layoutWarning: "",
    hasGithub: false,
    hasLinkedin: false,
    hasPortfolio: false,
  },
  qualityScore: 74,
  createdAt: "2026-01-01",
  analysis: {
    score: 74,
    rubric: [],
    suggestions: [{ tip: "Add measurable outcomes.", priority: "high", category: "impact" }],
  },
};

const PUBLIC_PREVIEW = {
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
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfessionalProfilePage />
    </MemoryRouter>,
  );
}

describe("ProfessionalProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    (getProfile as any).mockResolvedValue({
      userId: "u1",
      bio: "Software developer",
      linkedinUrl: "",
      githubUrl: "",
      portfolioUrl: "",
      skills: ["React", "TypeScript"],
      preferredTypes: [],
      preferredLocations: ["Remote"],
      minStipend: "",
      email: "test@example.com",
      updatedAt: "2026-01-01",
    });
    (listResumeVersions as any).mockResolvedValue({ items: [] });
    (uploadResumeFile as any).mockResolvedValue(RESUME_VERSION);
    (mergeResumeToProfile as any).mockResolvedValue({
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
    });

    (getUnifiedProfile as any).mockResolvedValue({
      user: {
        userId: "REG123",
        name: "Test User",
        email: "test@example.com",
        department: "School of Engineering and Sciences",
        branch: "Computer Science and Engineering",
        programme: "B.Tech",
        specialization: "Artificial Intelligence and Machine Learning",
        section: "J",
        year: 3,
      },
      career: { skillGaps: [] },
      skills: [{ skill: "JavaScript", source: "From courses" }],
    });
    (getProfilePrivacy as any).mockResolvedValue({ inferredSkills: "private", achievements: "private" });
    (getMyPublicCareerProfilePreview as any).mockResolvedValue(PUBLIC_PREVIEW);
    (listProfileAchievements as any).mockResolvedValue({ items: [] });
    (syncProfileAchievements as any).mockResolvedValue({ synced: [] });
    (updateProfilePrivacy as any).mockResolvedValue({ inferredSkills: "public", achievements: "private" });
    (updateAchievementVisibility as any).mockImplementation((id: string, visibility: string) =>
      Promise.resolve({
        id,
        userId: "u1",
        type: "competition_submission",
        title: "Finalist in Campus Hackathon",
        sourceDomain: "events",
        verificationState: "verified",
        skills: ["React", "Teamwork"],
        visibility,
        achievedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-02-01T00:00:00.000Z",
      }),
    );
  });

  it("renders identity, skills, and every panel", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("REG123")).toBeInTheDocument();
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
      expect(screen.getByText("Computer Science and Engineering")).toBeInTheDocument();
    });

    expect(screen.getByText("Artificial Intelligence and Machine Learning")).toBeInTheDocument();
    expect(screen.getByText("Year 3")).toBeInTheDocument();

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();

    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(screen.getByText("Competencies")).toBeInTheDocument();
    expect(screen.getByText("Career Preferences")).toBeInTheDocument();
    expect(screen.getByText("Proof")).toBeInTheDocument();
    expect(screen.getByText("Public Portfolio")).toBeInTheDocument();
    expect(screen.getByText("Verified Achievements")).toBeInTheDocument();
  });

  it("saves career preferences alongside identity fields", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("test@example.com")).toBeInTheDocument());

    await user.type(screen.getByLabelText("LinkedIn URL"), "https://linkedin.com/in/me");
    await user.click(screen.getByRole("button", { name: "Hackathon" }));
    await user.click(screen.getByRole("button", { name: /Save preferences/i }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect((updateProfile as any).mock.calls[0][0]).toMatchObject({
      preferredTypes: ["Hackathon"],
      preferredLocations: ["Remote"],
    });
  });

  it("adds a skill via the input and plus button", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("test@example.com")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/Add skill/i), "Go");
    await user.click(screen.getByRole("button", { name: "Add skill" }));

    await waitFor(() => expect(screen.getByText("Go")).toBeInTheDocument());
  });

  it("analyzes a resume and merges its skills into the profile", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Proof")).toBeInTheDocument());

    const input = screen.getByLabelText(/Upload résumé/i) as HTMLInputElement;
    const file = new File(["React TypeScript project"], "cv.pdf", { type: "application/pdf" });
    await user.upload(input, file);

    await waitFor(() => expect(uploadResumeFile).toHaveBeenCalledTimes(1));
    expect((uploadResumeFile as any).mock.calls[0][0]).toBeInstanceOf(File);
    expect((uploadResumeFile as any).mock.calls[0][0].name).toBe("cv.pdf");
    expect(await screen.findByText("Score: 74/100")).toBeInTheDocument();
    expect(await screen.findByText(/Add measurable outcomes/)).toBeInTheDocument();
    expect(screen.getByText(/B\.Tech CSE, SRM University AP/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Merge to Profile/i }));
    await waitFor(() => expect(mergeResumeToProfile).toHaveBeenCalledWith("r1"));
    await waitFor(() => expect(screen.getAllByText("TypeScript").length).toBeGreaterThan(0));
  });

  it("shows verified achievements and updates their visibility", async () => {
    const user = userEvent.setup();
    (listProfileAchievements as any).mockResolvedValue({
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

    renderPage();

    expect(await screen.findByText("Finalist in Campus Hackathon")).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("Visibility for Finalist in Campus Hackathon"),
      "employers",
    );

    await waitFor(() => expect(updateAchievementVisibility).toHaveBeenCalledWith("ach-1", "employers"));
    await waitFor(() => expect(screen.getByText("Achievement visibility updated.")).toBeInTheDocument());
  });

  it("syncs achievements from events", async () => {
    const user = userEvent.setup();
    (listProfileAchievements as any)
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

    renderPage();

    await waitFor(() => expect(screen.getByText("No verified achievements yet")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^Sync$/i }));

    await waitFor(() => expect(syncProfileAchievements).toHaveBeenCalled());
    expect(await screen.findByText("Selected for Robotics Finals")).toBeInTheDocument();
  });

  it("updates the public portfolio skill audience", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Public Portfolio")).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText("Public profile skills audience"), "public");

    await waitFor(() => expect(updateProfilePrivacy).toHaveBeenCalledWith({ inferredSkills: "public" }));
    await waitFor(() =>
      expect(screen.getByText("Public profile skill visibility updated.")).toBeInTheDocument(),
    );
  });

  it("downloads the public portfolio markdown", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Public Portfolio")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Download/i }));

    await waitFor(() =>
      expect(downloadPublicCareerProfileMarkdown).toHaveBeenCalledWith(
        expect.objectContaining({ contractVersion: "career-public-profile-v1" }),
      ),
    );
    expect(screen.getByText("Public profile Markdown downloaded.")).toBeInTheDocument();
  });
});
