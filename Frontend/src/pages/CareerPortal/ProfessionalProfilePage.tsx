// Professional Profile — the single canonical placement data model. Resume
// upload + ATS analysis, skill management, career preferences (which feed the
// opportunity fit scorer), the public-portfolio controls, and verified
// achievements all operate on this one profile.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageLayouts";
import { SectionCard } from "../../components/ui/SectionCard";
import { StatusBanner } from "../../components/erp/ErpPrimitives";
import { InlineError } from "../../components/ui/Feedback";
import { ProgressBar } from "../../components/ui/Progress";
import { Button } from "../../components/button";
import { Input } from "../../components/input";
import {
  getProfile,
  updateProfile,
  uploadResumeFile,
  deleteResumeVersion,
  mergeResumeToProfile,
  listResumeVersions,
  type CareerProfile,
  type ResumeVersion,
} from "../../lib/career/careerApi";
import { getUnifiedProfile, type UnifiedProfile } from "../../lib/career/profileApi";
import { readStoredProfileData } from "../../lib/core/session";
import { transformProfileData } from "../../lib/erp/profileTransformers";
import { track } from "../../lib/core/analytics";
import { Briefcase, ChevronRight, DollarSign, MapPin, Plus, X } from "lucide-react";
import { SkeletonCard } from "../../components/ui/Skeletons";
import ProfileSharingPanels from "./ProfileSharingPanels";
import ResumeProofPanel, { type ResumeUploadState } from "./ResumeProofPanel";

const PREFERRED_TYPES = ["Job", "Internship", "Hackathon", "Competition"];

export default function ProfessionalProfilePage() {
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [unified, setUnified] = useState<UnifiedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [resume, setResume] = useState<ResumeUploadState>({ file: null, uploading: false, version: null, merged: false });
  const [removingResume, setRemovingResume] = useState(false);
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

  const patch = (updates: Partial<CareerProfile>) => setProfile((p) => (p ? { ...p, ...updates } : p));

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
        preferredTypes: profile.preferredTypes,
        preferredLocations: profile.preferredLocations,
        minStipend: profile.minStipend,
        cgpa: profile.cgpa,
      });
      setMessage({ type: "success", text: "Profile saved." });
    } catch {
      setMessage({ type: "error", text: "Couldn't save your profile. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s || !profile || profile.skills.includes(s)) return;
    patch({ skills: [...profile.skills, s] });
    setNewSkill("");
  };

  const removeSkill = (skill: string) => {
    if (!profile) return;
    patch({ skills: profile.skills.filter((s) => s !== skill) });
  };

  const toggleType = (type: string) => {
    if (!profile) return;
    const cur = profile.preferredTypes || [];
    patch({ preferredTypes: cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type] });
  };

  const handleResumeUpload = async (file: File) => {
    setResume((prev) => ({ ...prev, uploading: true }));
    try {
      const result = await uploadResumeFile(file);
      setResume((prev) => ({ ...prev, file, uploading: false, version: result, merged: false }));
      track("resume_analyzed", {
        qualityScore: result.qualityScore,
        skillCount: result.parsedJson.skills?.length || 0,
        mimeType: result.mimeType,
      });
      setMessage({ type: "success", text: `Resume analysed. Quality score: ${result.qualityScore}/100.` });
    } catch (err) {
      setResume((prev) => ({ ...prev, uploading: false }));
      const serverMessage = err instanceof Error ? err.message : "";
      setMessage({
        type: "error",
        text: serverMessage || `Couldn't read "${file.name}". Try a different resume file.`,
      });
    }
  };

  const handleRemoveResume = async () => {
    if (!resume.version || removingResume) return;
    setRemovingResume(true);
    try {
      const res = await deleteResumeVersion(resume.version.id);
      setResume({ file: null, uploading: false, version: res.latest ?? null, merged: false });
      setMessage({
        type: "success",
        text: res.latest ? "Resume removed. Showing your previous version." : "Resume removed.",
      });
    } catch {
      setMessage({ type: "error", text: "Couldn't remove the resume. Please try again." });
    } finally {
      setRemovingResume(false);
    }
  };

  const handleMergeResume = async () => {
    if (!resume.version) return;
    try {
      const result = await mergeResumeToProfile(resume.version.id);
      setResume((prev) => ({ ...prev, merged: true }));
      setProfile(result.profile);
      track("resume_skills_synced", {
        resumeVersionId: resume.version.id,
        mergedSkillCount: result.mergedSkills.length,
      });
      setMessage({
        type: "success",
        text:
          result.mergedSkills.length > 0
            ? `Added ${result.mergedSkills.length} resume skill${result.mergedSkills.length === 1 ? "" : "s"} to your profile.`
            : "Profile is already aligned with this resume.",
      });
    } catch {
      setMessage({ type: "error", text: "Couldn't merge your resume into the profile. Please try again." });
    }
  };

  if (loading)
    return (
      <PageContainer>
        <div className="space-y-4 p-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </PageContainer>
    );

  if (error)
    return (
      <PageContainer>
        <InlineError message={error} />
      </PageContainer>
    );

  const completeness = profile ? computeCompleteness(profile) : 0;
  const identity = resolveIdentity(unified);

  return (
    <PageContainer>
      <div className="space-y-6 py-6">
        {message && (
          <StatusBanner
            message={{
              id: "profile-message",
              tone: message.type === "success" ? "success" : "error",
              text: message.text,
            }}
          />
        )}

        {/* Identity */}
        <SectionCard title="Identity" description="Pulled from your university academic record. The links and bio below are yours to edit.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" value={identity.name} />
            <Field label="Register No" value={identity.registerNo} />
            <Field label="Email" value={identity.email} />
            <Field label="Programme" value={identity.programme} />
            <Field label="Branch" value={identity.branch} />
            <Field label="Specialization" value={identity.specialization} />
            <Field label="Year" value={identity.year} />
            <Field label="Section" value={identity.section} />
            <div className="md:col-span-2">
              <label htmlFor="pp-bio" className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>
                Bio
              </label>
              <textarea
                id="pp-bio"
                className="mt-1 w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-2.5 text-sm outline-none focus:border-[var(--comp-accent)]"
                rows={2}
                value={profile?.bio || ""}
                onChange={(e) => patch({ bio: e.target.value })}
                placeholder="Tell employers about yourself in 2-3 sentences."
              />
            </div>
            <LabeledInput label="LinkedIn URL" value={profile?.linkedinUrl || ""} onChange={(v) => patch({ linkedinUrl: v })} placeholder="https://linkedin.com/in/..." />
            <LabeledInput label="GitHub URL" value={profile?.githubUrl || ""} onChange={(v) => patch({ githubUrl: v })} placeholder="https://github.com/..." />
            <div className="md:col-span-2">
              <LabeledInput label="Portfolio URL" value={profile?.portfolioUrl || ""} onChange={(v) => patch({ portfolioUrl: v })} placeholder="https://portfolio.dev/..." />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full max-w-xs">
              <div className="mb-1 flex justify-between text-xs font-medium">
                <span style={{ color: "var(--comp-text-secondary)" }}>Profile completeness</span>
                <span
                  style={{
                    color:
                      completeness >= 80
                        ? "var(--success)"
                        : completeness >= 50
                          ? "var(--warning)"
                          : "var(--error)",
                  }}
                >
                  {completeness}%
                </span>
              </div>
              <ProgressBar value={completeness} max={100} />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </SectionCard>

        {/* Competencies */}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") addSkill();
                }}
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
          <div className="mt-4">
            <Link
              to="/career/me/skill-gap"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--comp-accent)] no-underline hover:underline"
            >
              See which skills unlock the most opportunities
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </SectionCard>

        {/* Career Preferences — feeds the opportunity fit scorer */}
        <SectionCard title="Career Preferences" description="Used to rank opportunities and events for you.">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-[var(--comp-text-primary)]">
                <Briefcase className="h-4 w-4" /> Preferred types
              </span>
              <div className="flex flex-wrap gap-2">
                {PREFERRED_TYPES.map((type) => {
                  const active = profile?.preferredTypes?.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      aria-pressed={active}
                      className={`min-h-11 rounded-lg border px-3 py-1 text-xs font-medium transition-colors sm:min-h-9 ${
                        active
                          ? "border-[var(--comp-accent)] bg-[var(--comp-accent)] text-white"
                          : "border-[var(--comp-border)] bg-[var(--comp-surface)] text-[var(--comp-text-secondary)] hover:border-[var(--comp-accent)]"
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="pp-locations" className="flex items-center gap-2 text-sm font-semibold text-[var(--comp-text-primary)]">
                <MapPin className="h-4 w-4" /> Preferred locations
              </label>
              <Input
                id="pp-locations"
                placeholder="e.g. Remote, Bangalore, Hyderabad"
                value={(profile?.preferredLocations || []).join(", ")}
                onChange={(e) =>
                  patch({ preferredLocations: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                }
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="pp-stipend" className="flex items-center gap-2 text-sm font-semibold text-[var(--comp-text-primary)]">
                <DollarSign className="h-4 w-4" /> Minimum stipend / salary
              </label>
              <Input
                id="pp-stipend"
                placeholder="e.g. ₹20,000/mo"
                value={profile?.minStipend || ""}
                onChange={(e) => patch({ minStipend: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="pp-cgpa" className="text-sm font-semibold text-[var(--comp-text-primary)]">
                CGPA
              </label>
              <Input
                id="pp-cgpa"
                type="number"
                step="0.01"
                placeholder="e.g. 8.5"
                value={profile?.cgpa ?? ""}
                onChange={(e) => patch({ cgpa: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} disabled={saving} variant="outline" size="sm">
              {saving ? "Saving..." : "Save preferences"}
            </Button>
          </div>
        </SectionCard>

        {/* Proof (Resume) */}
        <ResumeProofPanel
          resume={resume}
          onUpload={handleResumeUpload}
          onMerge={handleMergeResume}
          onRemove={handleRemoveResume}
          removing={removingResume}
        />

        {/* Sharing: public portfolio + verified achievements (merged from CareerProfilePage) */}
        <ProfileSharingPanels userId={profile?.userId} onMessage={setMessage} />
      </div>
    </PageContainer>
  );
}

const DASH = "—";

/**
 * The Identity card is read-only academic-record data. The unified profile
 * (server-parsed from the ERP) is the source of truth; when it isn't available
 * (offline / first paint) fall back to the locally stored ERP profile blob so
 * the card still shows the student's own name rather than a row of dashes.
 */
function resolveIdentity(unified: UnifiedProfile | null) {
  const u = unified?.user;
  if (u && (u.name || u.email)) {
    return {
      name: u.name || DASH,
      registerNo: u.userId || DASH,
      email: u.email || DASH,
      programme: u.programme || DASH,
      branch: u.branch || DASH,
      specialization: u.specialization || DASH,
      year: u.year ? `Year ${u.year}` : DASH,
      section: u.section || DASH,
    };
  }

  const stored = readStoredProfileData() as { TableContent?: Record<string, unknown> } | null;
  if (!stored?.TableContent) {
    return {
      name: DASH,
      registerNo: DASH,
      email: DASH,
      programme: DASH,
      branch: DASH,
      specialization: DASH,
      year: DASH,
      section: DASH,
    };
  }
  const s = transformProfileData(stored.TableContent);
  const sem = parseInt(String(s.currentSemester).replace(/[^0-9]/g, ""), 10);
  return {
    name: s.studentName !== "N/A" ? s.studentName : DASH,
    registerNo: s.registerNo !== "N/A" ? s.registerNo : DASH,
    email: s.email !== "N/A" ? s.email : DASH,
    programme: s.program !== "N/A" ? s.program : DASH,
    branch: s.specialization !== "N/A" ? s.specialization : DASH,
    specialization: s.specialization !== "N/A" ? s.specialization : DASH,
    year: Number.isFinite(sem) && sem > 0 ? `Year ${Math.ceil(sem / 2)}` : DASH,
    section: s.section !== "N/A" ? s.section : DASH,
  };
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>
        {label}
      </span>
      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--comp-text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = `pp-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium" style={{ color: "var(--comp-text-secondary)" }}>
        {label}
      </label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function computeCompleteness(p: CareerProfile): number {
  let score = 0;
  if (p.bio && p.bio.trim().length > 20) score += 20;
  if (p.linkedinUrl) score += 15;
  if (p.githubUrl) score += 15;
  if (p.portfolioUrl) score += 10;
  if (p.skills && p.skills.length >= 3) score += 20;
  else if (p.skills && p.skills.length > 0) score += 10;
  if (p.email) score += 10;
  if (p.resumeUrl) score += 10;
  return Math.min(Math.round(score), 100);
}
