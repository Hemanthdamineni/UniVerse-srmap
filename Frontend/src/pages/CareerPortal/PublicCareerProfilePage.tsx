import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Award, Briefcase, Download, Github, Globe, Linkedin, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { Button } from "../../components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/card";
import { getPublicCareerProfile, type PublicCareerProfile } from "../../lib/career/profileApi";
import { track } from "../../lib/core/analytics";
import { downloadPublicCareerProfileMarkdown } from "../../lib/career/publicProfileExport";

const formatDate = (value?: string) => {
  if (!value) return "Verified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Verified";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const ProfileLink = ({ href, icon, label }: { href?: string; icon: React.ReactNode; label: string }) => {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 text-sm font-medium text-[var(--comp-text-primary)] no-underline hover:bg-[var(--comp-surface-hover)]"
    >
      {icon}
      {label}
    </a>
  );
};

const PublicCareerProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicCareerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setError("Profile link is missing a student ID.");
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    getPublicCareerProfile(userId)
      .then((data) => {
        if (!active) return;
        setProfile(data);
        track("public_career_profile_viewed", {
          userId: data.user.userId,
          skillCount: data.stats.visibleSkillCount,
          achievementCount: data.stats.visibleAchievementCount,
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || "Public profile is unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
        <div className="h-48 animate-pulse rounded-lg bg-[var(--comp-surface-hover)]" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="h-40 animate-pulse rounded-lg bg-[var(--comp-surface-hover)]" />
          <div className="h-40 animate-pulse rounded-lg bg-[var(--comp-surface-hover)] md:col-span-2" />
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="mx-auto max-w-2xl p-6 sm:p-10">
        <Card>
          <CardHeader>
            <CardTitle>Profile unavailable</CardTitle>
            <CardDescription>{error || "This career profile could not be loaded."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/career">Open Career Portal</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const handleDownload = () => {
    const result = downloadPublicCareerProfileMarkdown(profile);
    track("public_career_profile_exported", {
      userId: profile.user.userId,
      audience: profile.audience,
      fileName: result.fileName,
    });
  };

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-4 sm:p-8">
      <section className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-6 sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--comp-accent)_12%,transparent)] text-[var(--comp-accent)]">
              <UserRound className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--comp-text-muted)]">University career profile</p>
              <h1 className="mt-1 text-3xl font-semibold text-[var(--comp-text-primary)]">{profile.user.name}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--comp-text-secondary)]">{profile.headline}</p>
              <p className="mt-2 text-sm text-[var(--comp-text-muted)]">
                {[profile.user.branch, profile.user.year ? `Year ${profile.user.year}` : "", profile.user.department]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ProfileLink href={profile.links.linkedinUrl} icon={<Linkedin className="h-4 w-4" />} label="LinkedIn" />
            <ProfileLink href={profile.links.githubUrl} icon={<Github className="h-4 w-4" />} label="GitHub" />
            <ProfileLink href={profile.links.portfolioUrl} icon={<Globe className="h-4 w-4" />} label="Portfolio" />
            <Button type="button" variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[var(--success)]" />
              Profile Signal
            </CardTitle>
            <CardDescription>Shared by student-controlled visibility settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-semibold text-[var(--comp-text-primary)]">
                {profile.stats.profileCompleteness}%
              </p>
              <p className="text-sm text-[var(--comp-text-muted)]">Profile completeness</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[var(--comp-border)] p-3">
                <p className="text-xl font-semibold text-[var(--comp-text-primary)]">{profile.stats.visibleSkillCount}</p>
                <p className="text-xs text-[var(--comp-text-muted)]">Skills</p>
              </div>
              <div className="rounded-lg border border-[var(--comp-border)] p-3">
                <p className="text-xl font-semibold text-[var(--comp-text-primary)]">{profile.stats.visibleAchievementCount}</p>
                <p className="text-xs text-[var(--comp-text-muted)]">Achievements</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-[var(--comp-accent)]" />
              Public Skills
            </CardTitle>
            <CardDescription>Skills explicitly marked public by the student</CardDescription>
          </CardHeader>
          <CardContent>
            {profile.skills.length ? (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span
                    key={`${skill.skill}-${skill.source}`}
                    className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-3 py-1 text-sm font-medium text-[var(--comp-accent)]"
                  >
                    {skill.skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--comp-text-muted)]">No public skills have been shared yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[var(--success)]" />
            Verified Achievements
          </CardTitle>
          <CardDescription>Event, competition, and career records the student chose to publish</CardDescription>
        </CardHeader>
        <CardContent>
          {profile.achievements.length ? (
            <div className="space-y-3">
              {profile.achievements.map((achievement) => (
                <div key={achievement.id} className="rounded-lg border border-[var(--comp-border)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-[var(--comp-text-primary)]">{achievement.title}</p>
                      <p className="mt-1 text-sm text-[var(--comp-text-muted)]">
                        {formatDate(achievement.achievedAt || achievement.createdAt)} · {achievement.sourceDomain}
                      </p>
                      {achievement.description ? (
                        <p className="mt-2 text-sm leading-6 text-[var(--comp-text-secondary)]">{achievement.description}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--success)_24%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--success)]">
                      <Award className="h-3.5 w-3.5" />
                      Verified
                    </div>
                  </div>
                  {achievement.skills.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {achievement.skills.map((skill) => (
                        <span key={skill} className="rounded-full border border-[var(--comp-border)] px-2 py-0.5 text-xs text-[var(--comp-text-secondary)]">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--comp-text-muted)]">No public achievements have been shared yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default PublicCareerProfilePage;
