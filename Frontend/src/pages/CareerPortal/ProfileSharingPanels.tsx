/**
 * ProfileSharingPanels.tsx — the "what do I publish" half of the career
 * profile: the public-portfolio controls and the verified-achievements list
 * with per-item visibility.
 *
 * Merged in from the old `CareerProfilePage` (deleted). Self-contained: it owns
 * its own fetches and state so the parent page stays readable.
 */
import { useEffect, useState } from "react";
import { Copy, Download, ExternalLink, Eye, RefreshCw, ShieldCheck, Trophy } from "lucide-react";
import { SectionCard } from "../../components/ui/SectionCard";
import { Button } from "../../components/button";
import { Select } from "../../components/select";
import { SkeletonCard } from "../../components/ui/Skeletons";
import {
  getMyPublicCareerProfilePreview,
  getProfilePrivacy,
  listProfileAchievements,
  syncProfileAchievements,
  updateAchievementVisibility,
  updateProfilePrivacy,
  type ProfileVisibility,
  type PublicCareerProfile,
  type UnifiedProfileAchievement,
} from "../../lib/career/profileApi";
import { downloadPublicCareerProfileMarkdown } from "../../lib/career/publicProfileExport";
import { track } from "../../lib/core/analytics";

const ACHIEVEMENT_VISIBILITY_OPTIONS: Array<{ value: ProfileVisibility; label: string }> = [
  { value: "private", label: "Private" },
  { value: "campus", label: "Campus" },
  { value: "employers", label: "Employers" },
  { value: "public", label: "Public" },
];

function formatAchievementDate(value?: string) {
  if (!value) return "Verified record";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Verified record";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ProfileSharingPanels({
  userId,
  onMessage,
}: {
  userId?: string;
  onMessage: (m: { type: "success" | "error"; text: string }) => void;
}) {
  const [privacy, setPrivacy] = useState<Record<string, ProfileVisibility>>({});
  const [preview, setPreview] = useState<PublicCareerProfile | null>(null);
  const [achievements, setAchievements] = useState<UnifiedProfileAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingAudience, setUpdatingAudience] = useState(false);

  const refreshPreview = () => {
    void Promise.allSettled([getProfilePrivacy(), getMyPublicCareerProfilePreview("public")]).then(
      ([p, pv]) => {
        if (p.status === "fulfilled") setPrivacy(p.value);
        if (pv.status === "fulfilled") setPreview(pv.value);
      },
    );
  };

  useEffect(() => {
    void Promise.allSettled([
      getProfilePrivacy(),
      getMyPublicCareerProfilePreview("public"),
      listProfileAchievements(),
    ]).then(([p, pv, a]) => {
      if (p.status === "fulfilled") setPrivacy(p.value);
      if (pv.status === "fulfilled") setPreview(pv.value);
      if (a.status === "fulfilled") setAchievements(a.value.items);
      setLoading(false);
    });
  }, []);

  const publicProfileUrl = userId
    ? `${window.location.origin}/career/public/${encodeURIComponent(userId)}`
    : "";

  const handleCopy = async () => {
    if (!publicProfileUrl) return;
    try {
      await navigator.clipboard?.writeText(publicProfileUrl);
      track("public_career_profile_link_copied", { userId });
      onMessage({ type: "success", text: "Public profile link copied." });
    } catch {
      onMessage({ type: "error", text: "Could not copy the public profile link." });
    }
  };

  const handleDownload = () => {
    if (!preview) return;
    const result = downloadPublicCareerProfileMarkdown(preview);
    track("public_career_profile_exported", {
      userId: preview.user.userId,
      audience: preview.audience,
      fileName: result.fileName,
      surface: "career_profile",
    });
    onMessage({ type: "success", text: "Public profile Markdown downloaded." });
  };

  const handleAudienceChange = async (visibility: ProfileVisibility) => {
    setUpdatingAudience(true);
    try {
      const next = await updateProfilePrivacy({ inferredSkills: visibility });
      setPrivacy(next);
      refreshPreview();
      onMessage({ type: "success", text: "Public profile skill visibility updated." });
    } catch {
      onMessage({ type: "error", text: "Failed to update skill visibility." });
    } finally {
      setUpdatingAudience(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncProfileAchievements();
      const result = await listProfileAchievements();
      setAchievements(result.items);
      refreshPreview();
      track("career_achievements_synced", {
        achievementCount: result.items.length,
        visibleCount: result.items.filter((x) => x.visibility !== "private").length,
      });
      onMessage({
        type: "success",
        text:
          result.items.length > 0
            ? "Verified achievements refreshed from events and competitions."
            : "No verified achievements found yet. Participate in events or competitions to build this record.",
      });
    } catch {
      onMessage({ type: "error", text: "Failed to refresh achievements." });
    } finally {
      setSyncing(false);
    }
  };

  const handleVisibility = async (achievementId: string, visibility: ProfileVisibility) => {
    setUpdatingId(achievementId);
    try {
      const updated = await updateAchievementVisibility(achievementId, visibility);
      if (updated) {
        setAchievements((cur) => cur.map((x) => (x.id === achievementId ? updated : x)));
      }
      track("career_achievement_visibility_changed", { achievementId, visibility });
      refreshPreview();
      onMessage({ type: "success", text: "Achievement visibility updated." });
    } catch {
      onMessage({ type: "error", text: "Failed to update achievement visibility." });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <SectionCard title="Public Portfolio" description="Share only the profile signals you choose to publish.">
        <div className="mb-4 flex items-center gap-2 text-xs text-[var(--comp-text-muted)]">
          <Eye className="h-3.5 w-3.5" /> Nothing here is public until you set it.
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Completeness", value: `${preview?.stats.profileCompleteness ?? 0}%` },
            { label: "Public skills", value: preview?.stats.visibleSkillCount ?? 0 },
            { label: "Public achievements", value: preview?.stats.visibleAchievementCount ?? 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-[var(--comp-border)] p-3">
              <p className="text-xl font-semibold text-[var(--comp-text-primary)]">{s.value}</p>
              <p className="text-xs text-[var(--comp-text-muted)]">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div className="space-y-2">
            <label htmlFor="skills-audience" className="text-sm font-semibold text-[var(--comp-text-primary)]">
              Skills audience
            </label>
            <Select
              id="skills-audience"
              aria-label="Public profile skills audience"
              value={privacy.inferredSkills || "private"}
              disabled={updatingAudience}
              onChange={(e) => handleAudienceChange(e.target.value as ProfileVisibility)}
            >
              <option value="private">Private</option>
              <option value="employers">Employers</option>
              <option value="public">Public</option>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={handleCopy} disabled={!publicProfileUrl}>
            <Copy className="h-4 w-4" /> Copy Link
          </Button>
          <Button type="button" variant="outline" onClick={handleDownload} disabled={!preview}>
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button type="button" variant="secondary" asChild disabled={!publicProfileUrl}>
            <a href={publicProfileUrl || "#"} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Preview
            </a>
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Verified Achievements"
        description="Event and competition records you can put in front of employers."
      >
        <div className="mb-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing…" : "Sync"}
          </Button>
        </div>
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard className="h-20" />
            <SkeletonCard className="h-20" />
          </div>
        ) : achievements.length > 0 ? (
          <div className="space-y-3">
            {achievements.map((a) => (
              <div key={a.id} className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-md bg-[color-mix(in_srgb,var(--success)_10%,transparent)] p-2 text-[var(--success)]">
                        <Trophy className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--comp-text-primary)]">{a.title}</p>
                        <p className="text-xs text-[var(--comp-text-muted)]">
                          {formatAchievementDate(a.achievedAt || a.createdAt)} · {a.sourceDomain}
                        </p>
                      </div>
                    </div>
                    {a.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2 pl-11">
                        {a.skills.slice(0, 4).map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full border border-[var(--comp-border)] px-2 py-0.5 text-xs text-[var(--comp-text-secondary)]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:w-44">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--success)]" />
                    <Select
                      aria-label={`Visibility for ${a.title}`}
                      value={a.visibility}
                      disabled={updatingId === a.id}
                      onChange={(e) => handleVisibility(a.id, e.target.value as ProfileVisibility)}
                    >
                      {ACHIEVEMENT_VISIBILITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--comp-border)] p-6 text-center">
            <Trophy className="mx-auto h-6 w-6 text-[var(--comp-text-muted)]" />
            <p className="mt-3 text-sm font-medium text-[var(--comp-text-primary)]">No verified achievements yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--comp-text-muted)]">
              These are built automatically from your own event participation and published
              competition results — nothing here is placeholder. Register for an event, then sync.
            </p>
            <Button type="button" size="sm" className="mt-3" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
          </div>
        )}
      </SectionCard>
    </>
  );
}
