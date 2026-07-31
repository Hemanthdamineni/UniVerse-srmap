// Professional Profile — canonical placement data model.
// Resume upload, ATS analysis, profile completeness, and skill management
// all operate on this single shared profile.
import { useEffect, useState } from "react";
import { PageContainer } from "../../components/layout/PageLayouts";
import { SectionCard } from "../../components/ui/SectionCard";
import { EmptyState, InlineError } from "../../components/ui/Feedback";
import { ProgressBar } from "../../components/ui/Progress";
import { Button } from "../../components/button";
import { Input } from "../../components/input";
import { getProfile, updateProfile, createResumeVersion, mergeResumeToProfile, listResumeVersions, type CareerProfile, type ResumeVersion } from "../../lib/career/careerApi";
import { getUnifiedProfile, listProfileSkills, syncProfileAchievements, type UnifiedProfile, type UnifiedProfileSkill } from "../../lib/career/profileApi";
import { useSession } from "../../hooks/useSession";
import { Upload, FileText, Award, CheckCircle2, ChevronRight, Plus, X } from "lucide-react";
import { SkeletonCard } from "../../components/ui/Skeletons";

interface ResumeUpload {
  file: File | null;
  uploading: boolean;
  version: ResumeVersion | null;
  merged: boolean;
}

export default function ProfessionalProfilePage() {
  const { profile: erpProfile } = useSession();
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [unified, setUnified] = useState<UnifiedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [resume, setResume] = useState<ResumeUpload>({ file: null, uploading: false, version: null, merged: false });
  const [syncingAchievements, setSyncingAchievements] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    Promise.allSettled([
      getProfile(),
      getUnifiedProfile().catch(() => null),
      listResumeVersions().catch(() => ({ items: [] as ResumeVersion[] })),
    ]).then(([profileRes, unifiedRes, resumeRes]) => {
      if (profileRes.status === "fulfilled") setProfile(profileRes.value);
      if (unifiedRes.status === "fulfilled" && unifiedRes.value) setUnified(unifiedRes.value);
      if (resumeRes.status === "fulfilled" && resumeRes.value?.items?.[0]) {
        setResume((prev) => ({ ...prev, version: resumeRes.value.items[0] }));
      }
      if (profileRes.status === "rejected") setError("Could not load profile data.");
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateProfile({
        bio: profile.bio,
        linkedinUrl: profile.linkedinUrl,
        githubUrl: profile.githubUrl,
        portfolioUrl: profile.portfolioUrl,
        skills: profile.skills,
      });
    } catch {
      setMessage({ type: "error", text: "Failed to save profile." });
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s || !profile) return;
    if (profile.skills.includes(s)) return;
    setProfile({ ...profile, skills: [...profile.skills, s] });
    setNewSkill("");
  };

  const removeSkill = (skill: string) => {
    if (!profile) return;
    setProfile({ ...profile, skills: profile.skills.filter((s) => s !== skill) });
  };

  const handleResumeUpload = async (file: File) => {
    setResume((prev) => ({ ...prev, uploading: true }));
    try {
      const text = await file.text();
      const result = await createResumeVersion({
        fileName: file.name,
        extractedText: text,
      });
      setResume((prev) => ({ ...prev, file, uploading: false, version: result, merged: false }));
      setMessage({ type: "success", text: "Resume parsed successfully." });
    } catch {
      setResume((prev) => ({ ...prev, uploading: false }));
      setMessage({ type: "error", text: "Failed to parse resume." });
    }
  };

  const handleMergeResume = async () => {
    if (!resume.version) return;
    try {
      await mergeResumeToProfile(resume.version.id);
      setResume((prev) => ({ ...prev, merged: true }));
      setMessage({ type: "success", text: "Resume data merged into profile." });
      const refreshedProfile = await getProfile();
      setProfile(refreshedProfile);
    } catch {
      setMessage({ type: "error", text: "Failed to merge resume data." });
    }
  };

  const handleSyncAchievements = async () => {
    setSyncingAchievements(true);
    try {
      await syncProfileAchievements();
      const refreshed = await getUnifiedProfile();
      setUnified(refreshed);
      setMessage({ type: "success", text: "Achievements synchronized." });
    } catch {
      setMessage({ type: "error", text: "Failed to sync achievements." });
    } finally {
      setSyncingAchievements(false);
    }
  };

  if (loading) return (
    <PageContainer>
      <div className="space-y-4 p-6">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    </PageContainer>
  );

  if (error) return (
    <PageContainer>
      <InlineError message={error} />
    </PageContainer>
  );

  const completeness = profile ? computeCompleteness(profile) : 0;

  return (
    <PageContainer>
      <div className="space-y-6 py-6">
        {message && (
          <div className={`rounded-xl border p-4 text-sm ${
            message.type === "success"
              ? "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)] text-[var(--success)]"
              : "border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_8%,transparent)] text-[var(--error)]"
          }`}>
            {message.text}
          </div>
        )}

        {/* Identity Panel */}
        <SectionCard title="Identity" description="Auto-populated from your academic profile and editable as needed.">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>Name</label>
              <p className="mt-1 text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                {erpProfile?.name || profile?.name || "—"}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>Register No</label>
              <p className="mt-1 text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                {erpProfile?.regNo || profile?.name || "—"}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>Email</label>
              <p className="mt-1 text-sm" style={{ color: "var(--comp-text-primary)" }}>{profile?.email || "—"}</p>
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>Department</label>
              <p className="mt-1 text-sm" style={{ color: "var(--comp-text-primary)" }}>{unified?.user?.department || "—"}</p>
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>Branch</label>
              <p className="mt-1 text-sm" style={{ color: "var(--comp-text-primary)" }}>{unified?.user?.branch || "—"}</p>
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>Year</label>
              <p className="mt-1 text-sm" style={{ color: "var(--comp-text-primary)" }}>{unified?.user?.year ? `Year ${unified.user.year}` : "—"}</p>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>Bio</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-2.5 text-sm outline-none focus:border-[var(--comp-accent)]"
                rows={2}
                value={profile?.bio || ""}
                onChange={(e) => setProfile(profile ? { ...profile, bio: e.target.value } : null)}
                placeholder="Tell employers about yourself in 2-3 sentences."
              />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>LinkedIn URL</label>
              <Input value={profile?.linkedinUrl || ""} onChange={(e) => setProfile(profile ? { ...profile, linkedinUrl: e.target.value } : null)} placeholder="https://linkedin.com/in/..." />
            </div>
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>GitHub URL</label>
              <Input value={profile?.githubUrl || ""} onChange={(e) => setProfile(profile ? { ...profile, githubUrl: e.target.value } : null)} placeholder="https://github.com/..." />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>Portfolio URL</label>
              <Input value={profile?.portfolioUrl || ""} onChange={(e) => setProfile(profile ? { ...profile, portfolioUrl: e.target.value } : null)} placeholder="https://portfolio.dev/..." />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </SectionCard>

        {/* Competencies Panel */}
        <SectionCard title="Competencies" description="Skills from your profile, resume, courses, and events.">
          <div className="flex flex-wrap gap-2">
            {profile?.skills?.map((skill) => (
              <span key={skill} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--comp-border)] bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-3 py-1.5 text-xs font-medium">
                {skill}
                <button onClick={() => removeSkill(skill)} className="hover:text-[var(--error)]" title={`Remove ${skill}`} aria-label={`Remove ${skill}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <div className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--comp-border)] px-3 py-1.5">
              <input
                className="w-24 bg-transparent text-xs outline-none"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addSkill(); }}
                placeholder="Add skill"
              />
              <button onClick={addSkill} className="text-[var(--comp-text-muted)] hover:text-[var(--comp-accent)]" title="Add skill" aria-label="Add skill">
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
          {unified?.skills && unified.skills.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium" style={{ color: "var(--comp-text-muted)" }}>
                Unified skills (aggregated from courses, events, and resume):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unified.skills.map((s, i) => (
                  <span key={`${s.skill}-${i}`} className="rounded bg-[color-mix(in_srgb,var(--info)_10%,transparent)] px-2 py-0.5 text-xs" style={{ color: "var(--comp-text-secondary)" }}>
                    {s.skill}
                    <span className="ml-1 opacity-60">({s.source})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Proof Panel (Resume) */}
        <SectionCard title="Proof" description="Upload a resume to parse and merge structured data into your profile.">
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-xl border-2 border-dashed border-[var(--comp-border)] p-6">
              <Upload className="h-8 w-8 text-[var(--comp-text-muted)]" />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--comp-text-primary)" }}>Upload Resume</p>
                <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>PDF, DOCX, or TXT up to 5MB</p>
              </div>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                id="resume-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleResumeUpload(file);
                }}
              />
              <Button disabled={resume.uploading} onClick={() => document.getElementById("resume-upload")?.click()}>
                {resume.uploading ? "Uploading..." : "Browse"}
              </Button>
            </div>

            {resume.version && (
              <div className="rounded-xl border border-[var(--comp-border)] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-[var(--comp-text-muted)]" />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--comp-text-primary)" }}>
                        {resume.version.fileName}
                      </p>
                      <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
                        Quality score: {Math.round((resume.version.qualityScore || 0) * 100)}%
                      </p>
                    </div>
                  </div>
                  <Button size="sm" disabled={resume.merged} onClick={handleMergeResume}>
                    {resume.merged ? "Merged" : "Merge to Profile"}
                  </Button>
                </div>

                {resume.version.parsedJson && (
                  <div className="mt-3 grid grid-cols-3 gap-4 text-center">
                    <div className="rounded-lg bg-[var(--comp-surface-hover)] p-2">
                      <p className="text-lg font-bold" style={{ color: "var(--comp-text-primary)" }}>
                        {resume.version.parsedJson.projects?.length || 0}
                      </p>
                      <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>Projects</p>
                    </div>
                    <div className="rounded-lg bg-[var(--comp-surface-hover)] p-2">
                      <p className="text-lg font-bold" style={{ color: "var(--comp-text-primary)" }}>
                        {resume.version.parsedJson.experience?.length || 0}
                      </p>
                      <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>Experience</p>
                    </div>
                    <div className="rounded-lg bg-[var(--comp-surface-hover)] p-2">
                      <p className="text-lg font-bold" style={{ color: "var(--comp-text-primary)" }}>
                        {resume.version.parsedJson.certifications?.length || 0}
                      </p>
                      <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>Certs</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        {/* Readiness Scorecard */}
        <SectionCard title="Readiness Scorecard" description="Your career profile completeness and placement readiness.">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium" style={{ color: "var(--comp-text-primary)" }}>Profile Completeness</span>
                <span className="text-sm font-medium" style={{ color: completeness >= 80 ? "var(--success)" : completeness >= 50 ? "var(--warning)" : "var(--error)" }}>
                  {completeness}%
                </span>
              </div>
              <ProgressBar value={completeness} max={100} />
            </div>

            {unified?.career?.skillGaps && unified.career.skillGaps.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium" style={{ color: "var(--comp-text-primary)" }}>Skill Gaps ({unified.career.skillGaps.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {unified.career.skillGaps.slice(0, 8).map((g, i) => (
                    <span key={i} className="rounded-full border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] px-2.5 py-1 text-xs bg-[color-mix(in_srgb,var(--warning)_8%,transparent)]" style={{ color: "var(--warning)" }}>
                      {g.skill} <span className="opacity-60">({g.opportunityCount})</span>
                    </span>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-2">View Full Analysis</Button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={syncingAchievements} onClick={handleSyncAchievements}>
                <Award className="mr-1.5 h-4 w-4" />
                {syncingAchievements ? "Syncing..." : "Sync Achievements"}
              </Button>
              <Button variant="ghost" size="sm" disabled>
                <ChevronRight className="mr-1.5 h-4 w-4" />
                Placement Recommendations
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}

function computeCompleteness(p: CareerProfile): number {
  let score = 0;
  let max = 100;
  if (p.bio && p.bio.trim().length > 20) score += 20;
  if (p.linkedinUrl) score += 15;
  if (p.githubUrl) score += 15;
  if (p.portfolioUrl) score += 10;
  if (p.skills && p.skills.length >= 3) score += 20;
  else if (p.skills && p.skills.length > 0) score += 10;
  if (p.email) score += 10;
  if (p.resumeUrl) score += 10;
  return Math.min(Math.round((score / max) * 100), 100);
}
