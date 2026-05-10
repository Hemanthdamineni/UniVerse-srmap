import { useEffect, useState } from "react";
import { ErpPageShell, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import { getCareerProfile, type ResumeCareerProfile, updateCareerProfile } from "../../lib/careerApi";

const LEVEL_COLORS: Record<string, string> = {
  Beginner: "border-[var(--comp-border)] bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)]",
  Intermediate: "border-[color-mix(in_srgb,var(--info)_30%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)] text-[var(--info)]",
  Advanced: "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]",
  Expert: "border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]",
};

const LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"] as const;

function toText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeSkill(skill: unknown) {
  if (typeof skill === "string") {
    return { name: skill.trim(), level: "Intermediate" };
  }
  if (skill && typeof skill === "object") {
    const item = skill as Partial<{ name: unknown; level: unknown }>;
    return {
      name: toText(item.name),
      level: LEVELS.includes(item.level as (typeof LEVELS)[number])
        ? String(item.level)
        : "Intermediate",
    };
  }
  return { name: "", level: "Intermediate" };
}

function normalizeProject(project: unknown, index: number) {
  if (!project || typeof project !== "object") {
    return null;
  }
  const item = project as Partial<Record<keyof ResumeCareerProfile["projects"][number], unknown>>;
  const title = toText(item.title);
  if (!title) return null;
  return {
    id: toText(item.id, `project-${index}`),
    title,
    description: toText(item.description),
    tech: toText(item.tech),
    link: toText(item.link),
  };
}

function calculateCompletion(profile: ResumeCareerProfile) {
  const checks = [
    profile.headline,
    profile.summary,
    profile.resumeUrl || profile.resumeFileName,
    profile.skills.length > 0,
    profile.projects.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function toResumeProfile(data: Partial<ResumeCareerProfile> & Record<string, unknown>): ResumeCareerProfile {
  const rawSkills = Array.isArray(data.skills) ? data.skills : [];
  const rawProjects = Array.isArray(data.projects) ? data.projects : [];
  const profile = {
    userId: toText(data.userId, "student"),
    name: toText(data.name, "Student"),
    email: toText(data.email, ""),
    department: toText(data.department, ""),
    headline: toText(data.headline, "Student developer"),
    summary: toText(data.summary, toText(data.bio)),
    skills: rawSkills.map(normalizeSkill).filter((skill) => skill.name),
    preferredTypes: Array.isArray(data.preferredTypes) ? data.preferredTypes.map(String) : [],
    preferredLocations: Array.isArray(data.preferredLocations) ? data.preferredLocations.map(String) : [],
    minStipend: toText(data.minStipend),
    cgpa: typeof data.cgpa === "number" ? data.cgpa : undefined,
    bio: toText(data.bio, toText(data.summary)),
    linkedinUrl: toText(data.linkedinUrl),
    githubUrl: toText(data.githubUrl),
    portfolioUrl: toText(data.portfolioUrl),
    resumeUrl: toText(data.resumeUrl),
    resumeFileName: toText(data.resumeFileName),
    projects: rawProjects
      .map((project, index) => normalizeProject(project, index))
      .filter((project): project is ResumeCareerProfile["projects"][number] => Boolean(project)),
    updatedAt: toText(data.updatedAt, new Date().toISOString()),
    completionPercent: 0,
  };
  return { ...profile, completionPercent: calculateCompletion(profile) };
}

function toCareerProfilePayload(profile: ResumeCareerProfile) {
  return {
    ...profile,
    bio: profile.summary,
    skills: profile.skills.map((skill) => skill.name),
  };
}

export default function ResumeProfile() {
  const [profile, setProfile] = useState<ResumeCareerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [newSkill, setNewSkill] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState<string>("Intermediate");
  const [projectDraft, setProjectDraft] = useState({
    title: "",
    description: "",
    tech: "",
    link: "",
  });

  useEffect(() => {
    let active = true;
    getCareerProfile()
      .then((response) => {
        if (!active) return;
        setProfile(toResumeProfile(response as Partial<ResumeCareerProfile> & Record<string, unknown>));
      })
      .catch((error) => {
        if (!active) return;
        setBanner({
          tone: "warning",
          text: error instanceof Error ? error.message : "Failed to load career profile.",
        });
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function persist(next: ResumeCareerProfile, successText: string) {
    try {
      const saved = await updateCareerProfile(
        toCareerProfilePayload(next) as unknown as Partial<ResumeCareerProfile>
      );
      setProfile(
        toResumeProfile({
          ...(saved as Partial<ResumeCareerProfile> & Record<string, unknown>),
          headline: next.headline,
          summary: next.summary,
          skills: next.skills,
          projects: next.projects,
        })
      );
      setBanner({ tone: "success", text: successText });
    } catch (error) {
      setBanner({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to save profile.",
      });
    }
  }

  if (!profile) {
    return (
      <ErpPageShell
        title="Resume & Profile"
        source="Internal API"
        isLoading={loading}
        loadingMessage="Loading career profile..."
      >
        {banner ? <StatusBanner message={{ id: "resume-banner", tone: banner.tone, text: banner.text }} /> : null}
      </ErpPageShell>
    );
  }

  return (
    <ErpPageShell
      title="Resume & Profile"
      source="Internal API"
      isLoading={loading}
      loadingMessage="Loading career profile..."
    >
      {banner ? <StatusBanner message={{ id: "resume-banner", tone: banner.tone, text: banner.text }} /> : null}

      <SectionCard title="Profile Completeness">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--comp-text-primary)]">Profile Strength</span>
            <span className="font-semibold text-[var(--comp-text-primary)]">{profile.completionPercent}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${
                profile.completionPercent === 100
                  ? "bg-[var(--success)]"
                  : profile.completionPercent >= 66
                    ? "bg-[var(--comp-accent)]"
                    : "bg-[var(--warning)]"
              }`}
              style={{ width: `${profile.completionPercent}%` }}
            />
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Keep this profile updated so the Career portal can reuse it for applications and interview prep.
          </p>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Profile Summary">
          <div className="space-y-3">
            <input
              value={profile.headline}
              onChange={(event) => setProfile((prev) => (prev ? { ...prev, headline: event.target.value } : prev))}
              onBlur={(event) =>
                void persist({ ...profile, headline: event.target.value }, "Headline updated.")
              }
              placeholder="e.g. Full-stack developer focused on ERP systems and ML"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
            <textarea
              value={profile.summary}
              onChange={(event) => setProfile((prev) => (prev ? { ...prev, summary: event.target.value } : prev))}
              onBlur={(event) =>
                void persist({ ...profile, summary: event.target.value }, "Summary updated.")
              }
              rows={5}
              placeholder="Write a short summary about your skills, interests, and preferred opportunities."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={profile.resumeFileName}
                onChange={(event) =>
                  setProfile((prev) => (prev ? { ...prev, resumeFileName: event.target.value } : prev))
                }
                onBlur={(event) =>
                  void persist({ ...profile, resumeFileName: event.target.value }, "Resume label updated.")
                }
                placeholder="Resume file name"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
              <input
                value={profile.resumeUrl}
                onChange={(event) =>
                  setProfile((prev) => (prev ? { ...prev, resumeUrl: event.target.value } : prev))
                }
                onBlur={(event) =>
                  void persist({ ...profile, resumeUrl: event.target.value }, "Resume link updated.")
                }
                placeholder="Resume URL"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Skills">
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <div
                key={`${skill.name}-${skill.level}`}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${LEVEL_COLORS[skill.level] || LEVEL_COLORS.Intermediate}`}
              >
                <span className="text-sm font-semibold">{skill.name}</span>
                <span className="text-xs opacity-75">{skill.level}</span>
                <button
                  type="button"
                  onClick={() =>
                    void persist(
                      {
                        ...profile,
                        skills: profile.skills.filter((item) => item.name !== skill.name),
                      },
                      `Removed ${skill.name} from skills.`
                    )
                  }
                  className="ml-0.5 text-xs opacity-50 hover:opacity-100"
                >
                  x
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={newSkill}
              onChange={(event) => setNewSkill(event.target.value)}
              placeholder="Add a skill..."
              className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
            <select
              value={newSkillLevel}
              onChange={(event) => setNewSkillLevel(event.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none"
            >
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!newSkill.trim()) return;
                void persist(
                  {
                    ...profile,
                    skills: [
                      ...profile.skills.filter((item) => item.name.toLowerCase() !== newSkill.trim().toLowerCase()),
                      { name: newSkill.trim(), level: newSkillLevel },
                    ],
                  },
                  `Added ${newSkill.trim()} to skills.`
                );
                setNewSkill("");
              }}
              className="rounded-full bg-[var(--comp-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]"
            >
              Add
            </button>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Projects">
        {profile.projects.length ? (
          <div className="mb-4 space-y-3">
            {profile.projects.map((project) => (
              <div key={project.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--comp-text-primary)]">{project.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{project.description}</p>
                    {project.tech ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {project.tech.split(",").map((item) => (
                          <span
                            key={item.trim()}
                            className="rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--comp-text-primary)]"
                          >
                            {item.trim()}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void persist(
                        {
                          ...profile,
                          projects: profile.projects.filter((item) => item.id !== project.id),
                        },
                        "Project removed."
                      )
                    }
                    className="text-xs text-[var(--text-secondary)] hover:text-rose-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--comp-surface-hover)] p-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="project-title" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Project Title
            </label>
            <input
              id="project-title"
              value={projectDraft.title}
              onChange={(event) => setProjectDraft((prev) => ({ ...prev, title: event.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="project-desc" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Description
            </label>
            <textarea
              id="project-desc"
              value={projectDraft.description}
              onChange={(event) => setProjectDraft((prev) => ({ ...prev, description: event.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
          </div>
          <div>
            <label htmlFor="project-tech" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Technologies
            </label>
            <input
              id="project-tech"
              value={projectDraft.tech}
              onChange={(event) => setProjectDraft((prev) => ({ ...prev, tech: event.target.value }))}
              placeholder="React, Node.js, SQLite"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
          </div>
          <div>
            <label htmlFor="project-link" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Link
            </label>
            <input
              id="project-link"
              value={projectDraft.link}
              onChange={(event) => setProjectDraft((prev) => ({ ...prev, link: event.target.value }))}
              placeholder="https://github.com/..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)]"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => {
                if (!projectDraft.title.trim()) return;
                void persist(
                  {
                    ...profile,
                    projects: [
                      ...profile.projects,
                      {
                        id: crypto.randomUUID(),
                        title: projectDraft.title.trim(),
                        description: projectDraft.description.trim(),
                        tech: projectDraft.tech.trim(),
                        link: projectDraft.link.trim(),
                      },
                    ],
                  },
                  "Project added."
                );
                setProjectDraft({ title: "", description: "", tech: "", link: "" });
              }}
              className="rounded-full bg-[var(--comp-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]"
            >
              Add Project
            </button>
          </div>
        </div>
      </SectionCard>
    </ErpPageShell>
  );
}
