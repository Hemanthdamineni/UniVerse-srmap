import type { PublicCareerProfile } from "./profileApi";

function formatDate(value?: string) {
  if (!value) return "Verified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Verified";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function clean(value?: string | number | null) {
  return String(value ?? "").trim();
}

function safeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "career-profile";
}

export function buildPublicCareerProfileMarkdown(profile: PublicCareerProfile) {
  const lines: string[] = [];
  const name = clean(profile.user.name || profile.user.userId);
  const context = [profile.user.branch, profile.user.year ? `Year ${profile.user.year}` : "", profile.user.department]
    .map(clean)
    .filter(Boolean)
    .join(" | ");

  lines.push(`# ${name}`);
  if (profile.headline) lines.push("", profile.headline);
  if (context) lines.push("", context);

  const links = [
    ["LinkedIn", profile.links.linkedinUrl],
    ["GitHub", profile.links.githubUrl],
    ["Portfolio", profile.links.portfolioUrl],
  ].filter(([, href]) => clean(href));

  if (links.length) {
    lines.push("", "## Links");
    for (const [label, href] of links) {
      lines.push(`- ${label}: ${href}`);
    }
  }

  lines.push("", "## Profile Signal");
  lines.push(`- Profile completeness: ${profile.stats.profileCompleteness}%`);
  lines.push(`- Public skills: ${profile.stats.visibleSkillCount}`);
  lines.push(`- Public achievements: ${profile.stats.visibleAchievementCount}`);

  lines.push("", "## Skills");
  if (profile.skills.length) {
    for (const skill of profile.skills) lines.push(`- ${skill.skill}`);
  } else {
    lines.push("- No public skills shared.");
  }

  lines.push("", "## Verified Achievements");
  if (profile.achievements.length) {
    for (const achievement of profile.achievements) {
      const meta = [formatDate(achievement.achievedAt || achievement.createdAt), achievement.sourceDomain]
        .filter(Boolean)
        .join(", ");
      lines.push(`- ${achievement.title}${meta ? ` (${meta})` : ""}`);
      if (achievement.description) lines.push(`  - ${achievement.description}`);
      if (achievement.skills.length) lines.push(`  - Skills: ${achievement.skills.join(", ")}`);
    }
  } else {
    lines.push("- No public achievements shared.");
  }

  lines.push("", `Exported from University ERP Companion Platform on ${new Date().toISOString()}.`);
  return lines.join("\n");
}

export function downloadPublicCareerProfileMarkdown(profile: PublicCareerProfile) {
  const markdown = buildPublicCareerProfileMarkdown(profile);
  const fileName = `${safeFilePart(profile.user.name || profile.user.userId)}-career-profile.md`;
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { fileName, markdown };
}
