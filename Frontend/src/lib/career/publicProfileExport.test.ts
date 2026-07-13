import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildPublicCareerProfileMarkdown,
  downloadPublicCareerProfileMarkdown,
} from "./publicProfileExport";
import type { PublicCareerProfile } from "./profileApi";

const profile: PublicCareerProfile = {
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
};

describe("publicProfileExport", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:career-profile"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a portable markdown export", () => {
    const markdown = buildPublicCareerProfileMarkdown(profile);

    expect(markdown).toContain("# Student One");
    expect(markdown).toContain("Frontend student building campus products");
    expect(markdown).toContain("- React");
    expect(markdown).toContain("Shortlisted in Campus Hackathon");
    expect(markdown).not.toContain("resume");
  });

  it("downloads markdown with a stable filename", () => {
    const appendChild = vi.spyOn(document.body, "appendChild");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const result = downloadPublicCareerProfileMarkdown(profile);

    expect(result.fileName).toBe("student-one-career-profile.md");
    expect(result.markdown).toContain("# Student One");
    expect(click).toHaveBeenCalled();
    expect(appendChild).toHaveBeenCalled();
  });
});
