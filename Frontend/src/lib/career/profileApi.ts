import { requestData } from "../core/apiClient";
import { isStaticPrototype } from "../core/prototype";

export type ProfileVisibility =
  | "private"
  | "platform_personalization"
  | "campus"
  | "organizers"
  | "mentors"
  | "employers"
  | "public";

export type UnifiedProfileSkill = {
  userId: string;
  skill: string;
  source: string;
  confidence: number;
  evidenceRefs: string[];
  visibility: ProfileVisibility;
  updatedAt: string;
};

export type UnifiedProfileAchievement = {
  id: string;
  userId: string;
  type: string;
  title: string;
  description?: string;
  sourceDomain: string;
  sourceRefId?: string;
  verificationState: string;
  skills: string[];
  visibility: ProfileVisibility;
  achievedAt?: string;
  createdAt: string;
};

export type UnifiedProfileSignal = {
  id: string;
  userId: string;
  domain: string;
  signalType: string;
  signalRefId?: string;
  strength: number;
  visibility: ProfileVisibility;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

export type UnifiedProfile = {
  contractVersion: "unified-profile-v1";
  user: {
    userId: string;
    name?: string;
    email?: string;
    role?: string;
    department?: string;
    branch?: string;
    year?: number | null;
  };
  privacy: Record<string, ProfileVisibility>;
  career: {
    available: boolean;
    completeness?: number;
    skillGaps?: Array<{ skill: string; opportunityCount: number; gapLevel?: string }>;
    profile?: Record<string, unknown>;
    error?: string;
  };
  lms: {
    available: boolean;
    progress?: Record<string, unknown> | null;
    contributions?: { resources: number; guides: number; roadmaps: number } | null;
    mastery?: unknown[];
    error?: string;
  };
  events: {
    available: boolean;
    registeredCount?: number;
    organizedCount?: number;
    registrations?: unknown[];
    organized?: Array<{ id: string; title: string; startAt?: string }>;
    error?: string;
  };
  skills: UnifiedProfileSkill[];
  achievements: UnifiedProfileAchievement[];
  signals: UnifiedProfileSignal[];
  computedAt: string;
};

export type PlatformRecommendation = {
  impressionId: string;
  domain: "lms" | "career" | "events" | string;
  itemType: string;
  itemId: string;
  title: string;
  score: number;
  label: string;
  reasons: string[];
  risks: string[];
  missing: string[];
  href?: string;
  shownAt: string;
};

export type PlatformRecommendationResponse = {
  contractVersion: "recommendations-v1";
  domain: string;
  items: PlatformRecommendation[];
  generatedAt: string;
};

export type PublicCareerProfile = {
  contractVersion: "career-public-profile-v1";
  audience: "public" | "employers";
  user: {
    userId: string;
    name: string;
    department?: string;
    branch?: string;
    year?: number | null;
  };
  headline: string;
  bio: string;
  links: {
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
  };
  skills: UnifiedProfileSkill[];
  achievements: UnifiedProfileAchievement[];
  stats: {
    visibleSkillCount: number;
    visibleAchievementCount: number;
    profileCompleteness: number;
  };
  updatedAt: string;
};

const STATIC_PROFILE: UnifiedProfile = {
  contractVersion: "unified-profile-v1",
  user: {
    userId: "AP23110010001",
    name: "Static Student",
    role: "student",
    department: "CSE",
    branch: "Computer Science",
    year: 3,
  },
  privacy: {
    inferredSkills: "platform_personalization",
    achievements: "private",
    careerReadiness: "private",
    lmsActivity: "private",
    resume: "private",
    eventParticipation: "private",
  },
  career: {
    available: true,
    completeness: 65,
    skillGaps: [{ skill: "Node.js", opportunityCount: 4, gapLevel: "missing" }],
  },
  lms: {
    available: true,
    progress: { started: 4, completed: 2, completionRate: 50 },
    contributions: { resources: 2, guides: 1, roadmaps: 0 },
    mastery: [],
  },
  events: {
    available: true,
    registeredCount: 2,
    organizedCount: 1,
    registrations: [],
    organized: [{ id: "event-static", title: "Campus Hackathon", startAt: "2030-07-01T09:00:00.000Z" }],
  },
  skills: [
    {
      userId: "AP23110010001",
      skill: "React",
      source: "career_profile",
      confidence: 0.8,
      evidenceRefs: ["career_profile"],
      visibility: "private",
      updatedAt: "2030-01-01T00:00:00.000Z",
    },
  ],
  achievements: [
    {
      id: "achievement-static",
      userId: "AP23110010001",
      type: "event_participation",
      title: "Participated in Campus Hackathon",
      sourceDomain: "events",
      verificationState: "verified",
      skills: ["React"],
      visibility: "private",
      achievedAt: "2030-07-01T09:00:00.000Z",
      createdAt: "2030-07-01T09:00:00.000Z",
    },
  ],
  signals: [],
  computedAt: "2030-01-01T00:00:00.000Z",
};

const STATIC_RECOMMENDATIONS: PlatformRecommendationResponse = {
  contractVersion: "recommendations-v1",
  domain: "home",
  generatedAt: "2030-01-01T00:00:00.000Z",
  items: [
    {
      impressionId: "impression-static-lms",
      domain: "lms",
      itemType: "resource",
      itemId: "res-static",
      title: "React Revision Notes",
      score: 0.84,
      label: "Recommended resource",
      reasons: ["Matches your learning context", "Ranked by LMS quality and engagement"],
      risks: [],
      missing: [],
      href: "/resources/res-static",
      shownAt: "2030-01-01T00:00:00.000Z",
    },
    {
      impressionId: "impression-static-career",
      domain: "career",
      itemType: "opportunity",
      itemId: "opp-static",
      title: "Frontend Platform Internship",
      score: 0.78,
      label: "Strong opportunity match",
      reasons: ["Matches 1 listed skill", "Deadline: 2030-06-30"],
      risks: [],
      missing: ["Node.js"],
      href: "/career/opportunities/opp-static",
      shownAt: "2030-01-01T00:00:00.000Z",
    },
  ],
};

const STATIC_PUBLIC_PROFILE: PublicCareerProfile = {
  contractVersion: "career-public-profile-v1",
  audience: "public",
  user: {
    userId: STATIC_PROFILE.user.userId,
    name: STATIC_PROFILE.user.name || "Static Student",
    department: STATIC_PROFILE.user.department,
    branch: STATIC_PROFILE.user.branch,
    year: STATIC_PROFILE.user.year,
  },
  headline: "Frontend student building campus products",
  bio: "Frontend student building campus products",
  links: {
    githubUrl: "https://github.com/static-student",
    linkedinUrl: "https://linkedin.com/in/static-student",
  },
  skills: STATIC_PROFILE.skills.map((skill) => ({ ...skill, visibility: "public" })),
  achievements: STATIC_PROFILE.achievements.map((achievement) => ({ ...achievement, visibility: "public" })),
  stats: {
    visibleSkillCount: STATIC_PROFILE.skills.length,
    visibleAchievementCount: STATIC_PROFILE.achievements.length,
    profileCompleteness: 65,
  },
  updatedAt: "2030-01-01T00:00:00.000Z",
};

export async function getUnifiedProfile(options?: { recompute?: boolean }) {
  if (isStaticPrototype()) return STATIC_PROFILE;
  const params = new URLSearchParams();
  if (options?.recompute === false) params.set("recompute", "false");
  const query = params.toString() ? `?${params.toString()}` : "";
  return requestData<UnifiedProfile>(`/api/profile/unified${query}`);
}

export async function getPublicCareerProfile(userId: string) {
  if (isStaticPrototype()) return STATIC_PUBLIC_PROFILE;
  return requestData<PublicCareerProfile>(`/api/profile/public/${encodeURIComponent(userId)}`);
}

export async function getMyPublicCareerProfilePreview(audience: "public" | "employers" = "public") {
  if (isStaticPrototype()) return { ...STATIC_PUBLIC_PROFILE, audience };
  const params = new URLSearchParams({ audience });
  return requestData<PublicCareerProfile>(`/api/profile/public-preview?${params.toString()}`);
}

export async function listProfileAchievements() {
  if (isStaticPrototype()) return { items: STATIC_PROFILE.achievements };
  return requestData<{ items: UnifiedProfileAchievement[] }>("/api/profile/achievements");
}

export async function syncProfileAchievements() {
  if (isStaticPrototype()) return { synced: STATIC_PROFILE.achievements };
  return requestData<{ synced: UnifiedProfileAchievement[] }>("/api/profile/achievements/sync", {
    method: "POST",
  });
}

export async function updateAchievementVisibility(achievementId: string, visibility: ProfileVisibility) {
  if (isStaticPrototype()) {
    const item = STATIC_PROFILE.achievements.find((achievement) => achievement.id === achievementId);
    return item ? { ...item, visibility } : null;
  }
  return requestData<UnifiedProfileAchievement>(`/api/profile/achievements/${achievementId}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ visibility }),
  });
}

export async function listProfileSkills() {
  if (isStaticPrototype()) return { items: STATIC_PROFILE.skills };
  return requestData<{ items: UnifiedProfileSkill[] }>("/api/profile/skills");
}

export async function updateSkillVisibility(skill: string, visibility: ProfileVisibility) {
  if (isStaticPrototype()) {
    return { items: STATIC_PROFILE.skills.filter((item) => item.skill === skill).map((item) => ({ ...item, visibility })) };
  }
  return requestData<{ items: UnifiedProfileSkill[] }>(`/api/profile/skills/${encodeURIComponent(skill)}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ visibility }),
  });
}

export async function getProfilePrivacy() {
  if (isStaticPrototype()) return STATIC_PROFILE.privacy;
  return requestData<Record<string, ProfileVisibility>>("/api/profile/privacy");
}

export async function updateProfilePrivacy(updates: Record<string, ProfileVisibility>) {
  if (isStaticPrototype()) return { ...STATIC_PROFILE.privacy, ...updates };
  return requestData<Record<string, ProfileVisibility>>("/api/profile/privacy", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function getPlatformRecommendations(domain: "home" | "lms" | "career" | "events" = "home") {
  if (isStaticPrototype()) return { ...STATIC_RECOMMENDATIONS, domain };
  return requestData<PlatformRecommendationResponse>(`/api/recommendations/${domain}`);
}

export async function recordPlatformRecommendationFeedback(payload: {
  impressionId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  if (isStaticPrototype()) return { recorded: true, id: "feedback-static" };
  return requestData<{ recorded: boolean; id: string }>("/api/recommendations/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
