// Career profile: PageHeader-level tokens, SkeletonBlock for button loading, SkeletonCard page load.
import React, { useEffect, useState } from "react";
import {
  createResumeVersion,
  getProfile,
  listResumeVersions,
  mergeResumeToProfile,
  updateProfile,
  type CareerProfile,
  type ResumeVersion,
} from '../../lib/career/careerApi';
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
} from '../../lib/career/profileApi';
import { Button } from '../../components/button';
import { Input } from '../../components/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/card';
import { Select } from "../../components/select";
import { User, Briefcase, MapPin, DollarSign, Award, Linkedin, Github, Globe, FileText, Upload, CheckCircle2, Plus, X, Sparkles, ArrowRight, Trophy, RefreshCw, ShieldCheck, Copy, ExternalLink, Eye, Download } from "lucide-react";
import { SkeletonBlock, SkeletonCard } from "../../components/ui/Skeletons";
import { PageContainer } from "../../components/layout/PageLayouts";
import { useSession } from '../../hooks/useSession';
import { track } from "../../lib/core/analytics";
import { downloadPublicCareerProfileMarkdown } from "../../lib/career/publicProfileExport";

const readResumeFileText = (file: File) => {
  if (typeof file.text === 'function') return file.text();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read resume file.'));
    reader.readAsText(file);
  });
};

const ACHIEVEMENT_VISIBILITY_OPTIONS: Array<{ value: ProfileVisibility; label: string }> = [
  { value: "private", label: "Private" },
  { value: "campus", label: "Campus" },
  { value: "employers", label: "Employers" },
  { value: "public", label: "Public" },
];

const formatAchievementDate = (value?: string) => {
  if (!value) return "Verified record";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Verified record";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const CareerProfilePage: React.FC = () => {
  const { profile: erpProfile } = useSession();
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mergingResume, setMergingResume] = useState(false);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [syncingAchievements, setSyncingAchievements] = useState(false);
  const [updatingAchievementId, setUpdatingAchievementId] = useState<string | null>(null);
  const [updatingPortfolio, setUpdatingPortfolio] = useState(false);
  const [resumeVersion, setResumeVersion] = useState<ResumeVersion | null>(null);
  const [achievements, setAchievements] = useState<UnifiedProfileAchievement[]>([]);
  const [publicPreview, setPublicPreview] = useState<PublicCareerProfile | null>(null);
  const [profilePrivacy, setProfilePrivacy] = useState<Record<string, ProfileVisibility>>({});
  const [newSkill, setNewSkill] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await getProfile();
      setProfile(data);
      try {
        const versions = await listResumeVersions();
        setResumeVersion(versions.items[0] ?? null);
      } catch (resumeErr) {
        console.warn('Failed to fetch resume intelligence', resumeErr);
      }
      fetchAchievements();
      fetchPublicPortfolioPreview();
    } catch (err) {
      console.error('Failed to fetch profile', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPublicPortfolioPreview = async () => {
    try {
      const [privacy, preview] = await Promise.all([
        getProfilePrivacy(),
        getMyPublicCareerProfilePreview("public"),
      ]);
      setProfilePrivacy(privacy);
      setPublicPreview(preview);
    } catch (err) {
      console.warn('Failed to fetch public portfolio preview', err);
    }
  };

  const fetchAchievements = async () => {
    setLoadingAchievements(true);
    try {
      const result = await listProfileAchievements();
      setAchievements(result.items);
    } catch (err) {
      console.warn('Failed to fetch verified achievements', err);
    } finally {
      setLoadingAchievements(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile(profile);
      fetchPublicPortfolioPreview();
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    setMessage(null);
    try {
      const extractedText = await readResumeFileText(file);
      const result = await createResumeVersion({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        extractedText,
      });
      setResumeVersion(result);
      setProfile(prev => prev ? { ...prev, resumeUrl: result.filePath, resumeFileName: result.fileName } : null);
      track('resume_analyzed', {
        qualityScore: result.qualityScore,
        skillCount: result.parsedJson.skills?.length || 0,
        mimeType: result.mimeType,
      });
      setMessage({ type: 'success', text: `Resume analyzed. Quality score: ${result.qualityScore}/100.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to analyze resume.' });
    } finally {
      setUploading(false);
    }
  };

  const handleMergeResume = async () => {
    if (!resumeVersion) return;
    setMergingResume(true);
    setMessage(null);
    try {
      const result = await mergeResumeToProfile(resumeVersion.id);
      setProfile(result.profile);
      track('resume_skills_synced', {
        resumeVersionId: resumeVersion.id,
        mergedSkillCount: result.mergedSkills.length,
      });
      setMessage({
        type: 'success',
        text: result.mergedSkills.length > 0
          ? `Added ${result.mergedSkills.length} resume skill${result.mergedSkills.length === 1 ? '' : 's'} to your profile.`
          : 'Profile is already aligned with this resume.',
      });
      fetchPublicPortfolioPreview();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to merge resume signals.' });
    } finally {
      setMergingResume(false);
    }
  };

  const handleSyncAchievements = async () => {
    setSyncingAchievements(true);
    setMessage(null);
    try {
      await syncProfileAchievements();
      const result = await listProfileAchievements();
      setAchievements(result.items);
      fetchPublicPortfolioPreview();
      track('career_achievements_synced', {
        achievementCount: result.items.length,
        visibleCount: result.items.filter((achievement) => achievement.visibility !== 'private').length,
      });
      setMessage({
        type: 'success',
        text: result.items.length > 0
          ? 'Verified achievements refreshed from events and competitions.'
          : 'No verified achievements found yet. Participate in events or competitions to build this record.',
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to refresh achievements.' });
    } finally {
      setSyncingAchievements(false);
    }
  };

  const handleAchievementVisibility = async (achievementId: string, visibility: ProfileVisibility) => {
    setUpdatingAchievementId(achievementId);
    setMessage(null);
    try {
      const updated = await updateAchievementVisibility(achievementId, visibility);
      if (updated) {
        setAchievements((current) =>
          current.map((achievement) => achievement.id === achievementId ? updated : achievement)
        );
      }
      track('career_achievement_visibility_changed', {
        achievementId,
        visibility,
      });
      fetchPublicPortfolioPreview();
      setMessage({ type: 'success', text: 'Achievement visibility updated.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update achievement visibility.' });
    } finally {
      setUpdatingAchievementId(null);
    }
  };

  const publicProfileUrl = profile?.userId
    ? `${window.location.origin}/career/public/${encodeURIComponent(profile.userId)}`
    : "";

  const handleCopyPublicProfile = async () => {
    if (!publicProfileUrl) return;
    try {
      await navigator.clipboard?.writeText(publicProfileUrl);
      track('public_career_profile_link_copied', { userId: profile?.userId });
      setMessage({ type: 'success', text: 'Public profile link copied.' });
    } catch {
      setMessage({ type: 'error', text: 'Could not copy the public profile link.' });
    }
  };

  const handleSkillsAudienceChange = async (visibility: ProfileVisibility) => {
    setUpdatingPortfolio(true);
    setMessage(null);
    try {
      const privacy = await updateProfilePrivacy({ inferredSkills: visibility });
      setProfilePrivacy(privacy);
      await fetchPublicPortfolioPreview();
      setMessage({ type: 'success', text: 'Public profile skill visibility updated.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update skill visibility.' });
    } finally {
      setUpdatingPortfolio(false);
    }
  };

  const handleDownloadPublicProfile = () => {
    if (!publicPreview) return;
    const result = downloadPublicCareerProfileMarkdown(publicPreview);
    track('public_career_profile_exported', {
      userId: publicPreview.user.userId,
      audience: publicPreview.audience,
      fileName: result.fileName,
      surface: 'career_profile',
    });
    setMessage({ type: 'success', text: 'Public profile Markdown downloaded.' });
  };

  const addSkill = () => {
    if (!newSkill.trim() || !profile) return;
    if (profile.skills.includes(newSkill.trim())) return;
    setProfile({ ...profile, skills: [...profile.skills, newSkill.trim()] });
    setNewSkill('');
  };

  const removeSkill = (skill: string) => {
    if (!profile) return;
    setProfile({ ...profile, skills: profile.skills.filter(s => s !== skill) });
  };

  if (loading) {
    return (
      <PageContainer surface="flat" className="max-w-4xl space-y-6">
        <SkeletonCard className="h-16" />
        <SkeletonCard className="h-96" />
      </PageContainer>
    );
  }

  return (
    <PageContainer surface="flat" className="max-w-4xl space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="page-title">Career Profile</h1>
          <p className="body-text mt-1">Personalize your opportunity matching and feed</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
        >
          {saving ? (
            <SkeletonBlock width={16} height={16} circle className="mr-2 inline-block align-middle" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </header>

      {message && (
        <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border-[color-mix(in_srgb,var(--success)_24%,transparent)] text-[var(--success)]' : 'bg-[color-mix(in_srgb,var(--error)_10%,transparent)] border-[color-mix(in_srgb,var(--error)_24%,transparent)] text-[var(--error)]'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: ERP Sync & Resume */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="label-text">ERP Sync</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--comp-surface-hover)] rounded-full"><User className="h-4 w-4 text-[var(--comp-text-secondary)]" /></div>
                <div>
                  <p className="text-xs text-[var(--comp-text-muted)]">Name</p>
                  <p className="text-sm font-medium">{erpProfile?.Name || 'Syncing...'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--comp-surface-hover)] rounded-full"><Award className="h-4 w-4 text-[var(--comp-text-secondary)]" /></div>
                <div>
                  <p className="text-xs text-[var(--comp-text-muted)]">Branch & Year</p>
                  <p className="text-sm font-medium">
                    {erpProfile?.TableContent?.["Program / Section"]?.split(' ')[1] || 'CSE'} - {erpProfile?.TableContent?.["Academic Year"]?.split(' ')[0] || 'III'} Year
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="label-text">Resume</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile?.resumeUrl ? (
                <div className="p-3 border rounded-lg bg-[color-mix(in_srgb,var(--info)_10%,transparent)] border-[color-mix(in_srgb,var(--info)_24%,transparent)] flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="h-5 w-5 text-[var(--info)] shrink-0" />
                    <span className="text-sm font-medium text-[var(--info)] truncate">{profile.resumeFileName}</span>
                  </div>
                  <a href={profile.resumeUrl} target="_blank" rel="noreferrer" className="text-xs text-[var(--comp-accent)] hover:underline shrink-0">View</a>
                </div>
              ) : (
                <div className="p-8 border-2 border-dashed rounded-lg text-center">
                  <p className="text-xs text-[var(--comp-text-muted)] mb-2">No resume uploaded</p>
                </div>
              )}
              
              <div className="relative">
                <input 
                  type="file" 
                  id="resume-upload" 
                  className="hidden" 
                accept=".pdf,.txt,.md" 
                  onChange={handleResumeUpload}
                  disabled={uploading}
                />
                <label htmlFor="resume-upload">
                  <Button variant="outline" className="w-full" asChild disabled={uploading}>
                    <span>
                      {uploading ? (
                        <SkeletonBlock width={16} height={16} circle className="mr-2 inline-block align-middle" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {profile?.resumeUrl ? 'Update Resume' : 'Upload Resume'}
                    </span>
                  </Button>
                </label>
              </div>
              <p className="text-xs text-[var(--comp-text-muted)] text-center">PDF or text resume. Max 5MB.</p>

              {resumeVersion ? (
                <div className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface-hover)] p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--comp-text-muted)]">Resume intelligence</p>
                      <p className="mt-1 text-2xl font-semibold text-[var(--comp-text-primary)]">{resumeVersion.qualityScore}/100</p>
                    </div>
                    <Sparkles className="h-5 w-5 text-[var(--comp-accent)]" />
                  </div>

                  {resumeVersion.parsedJson.skills && resumeVersion.parsedJson.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {resumeVersion.parsedJson.skills.slice(0, 6).map((skill) => (
                        <span key={skill} className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--comp-accent)]">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {resumeVersion.analysis?.suggestions?.length ? (
                    <ul className="space-y-2">
                      {resumeVersion.analysis.suggestions.slice(0, 2).map((suggestion) => (
                        <li key={suggestion} className="text-xs leading-relaxed text-[var(--comp-text-secondary)]">
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-between"
                    onClick={handleMergeResume}
                    disabled={mergingResume}
                  >
                    <span>{mergingResume ? 'Syncing skills' : 'Sync skills to profile'}</span>
                    {mergingResume ? (
                      <SkeletonBlock width={16} height={16} circle />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Middle/Right Column: Skills & Preferences */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Technical Skills</CardTitle>
              <CardDescription>Add skills to unlock better matches and see skill gaps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="e.g. Python, React, AWS"
                  aria-label="Skills"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                />
                <Button onClick={addSkill} size="icon" variant="secondary"><Plus className="h-4 w-4" /></Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {profile?.skills.map(skill => (
                  <span key={skill} className="px-3 py-1 bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] text-[var(--comp-accent)] rounded-full text-sm font-medium flex items-center gap-1 border border-[color-mix(in_srgb,var(--comp-accent)_24%,transparent)]">
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="hover:text-[var(--text-primary)]"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {profile?.skills.length === 0 && <p className="text-sm text-[var(--comp-text-muted)] italic">No skills added yet.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Career Preferences</CardTitle>
              <CardDescription>Help us filter the noise</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4" /> Preferred Types</label>
                  <div className="flex flex-wrap gap-2">
                    {['Job', 'Internship', 'Hackathon', 'Competition'].map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          const current = profile?.preferredTypes || [];
                          const next = current.includes(type) ? current.filter(t => t !== type) : [...current, type];
                          setProfile(prev => prev ? { ...prev, preferredTypes: next } : null);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          profile?.preferredTypes.includes(type) 
                            ? 'bg-[var(--comp-accent)] text-white border-[var(--comp-accent)]' 
                            : 'bg-[var(--comp-surface)] text-[var(--comp-text-secondary)] border-[var(--comp-border)] hover:border-[var(--comp-accent)]'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" /> Preferred Locations</label>
                  <Input 
                    placeholder="e.g. Remote, Bangalore, Mumbai"
                    aria-label="Preferred Locations"
                    value={profile?.preferredLocations.join(', ')}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, preferredLocations: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : null)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Min Stipend / Salary</label>
                  <Input 
                    placeholder="e.g. ₹20,000/mo"
                    aria-label="Minimum Stipend"
                    value={profile?.minStipend}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, minStipend: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2">CGPA</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="e.g. 8.5"
                    aria-label="CGPA"
                    value={profile?.cgpa || ''}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, cgpa: parseFloat(e.target.value) } : null)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Professional Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--comp-text-muted)]" />
                  <Input 
                    className="pl-9" 
                    placeholder="LinkedIn URL"
                    aria-label="LinkedIn URL"
                    value={profile?.linkedinUrl}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, linkedinUrl: e.target.value } : null)}
                  />
                </div>
                <div className="relative">
                  <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--comp-text-muted)]" />
                  <Input 
                    className="pl-9" 
                    placeholder="GitHub URL"
                    aria-label="GitHub URL"
                    value={profile?.githubUrl}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, githubUrl: e.target.value } : null)}
                  />
                </div>
              </div>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--comp-text-muted)]" />
                <Input 
                  className="pl-9" 
                  placeholder="Portfolio / Website URL"
                  aria-label="Portfolio URL"
                  value={profile?.portfolioUrl}
                  onChange={(e) => setProfile(prev => prev ? { ...prev, portfolioUrl: e.target.value } : null)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Public Portfolio</CardTitle>
                <CardDescription>Share only the profile signals you choose to publish</CardDescription>
              </div>
              <Eye className="h-5 w-5 text-[var(--comp-accent)]" />
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-[var(--comp-border)] p-3">
                  <p className="text-xl font-semibold text-[var(--comp-text-primary)]">
                    {publicPreview?.stats.profileCompleteness ?? 0}%
                  </p>
                  <p className="text-xs text-[var(--comp-text-muted)]">Completeness</p>
                </div>
                <div className="rounded-lg border border-[var(--comp-border)] p-3">
                  <p className="text-xl font-semibold text-[var(--comp-text-primary)]">
                    {publicPreview?.stats.visibleSkillCount ?? 0}
                  </p>
                  <p className="text-xs text-[var(--comp-text-muted)]">Public skills</p>
                </div>
                <div className="rounded-lg border border-[var(--comp-border)] p-3">
                  <p className="text-xl font-semibold text-[var(--comp-text-primary)]">
                    {publicPreview?.stats.visibleAchievementCount ?? 0}
                  </p>
                  <p className="text-xs text-[var(--comp-text-muted)]">Public achievements</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Skills audience</label>
                  <Select
                    aria-label="Public profile skills audience"
                    value={profilePrivacy.inferredSkills || "private"}
                    disabled={updatingPortfolio}
                    onChange={(event) => handleSkillsAudienceChange(event.target.value as ProfileVisibility)}
                  >
                    <option value="private">Private</option>
                    <option value="employers">Employers</option>
                    <option value="public">Public</option>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyPublicProfile}
                  disabled={!publicProfileUrl}
                >
                  <Copy className="h-4 w-4" />
                  Copy Link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadPublicProfile}
                  disabled={!publicPreview}
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button type="button" variant="secondary" asChild disabled={!publicProfileUrl}>
                  <a href={publicProfileUrl || "#"} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Preview
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Verified Achievements</CardTitle>
                <CardDescription>Use event and competition records in your career profile</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSyncAchievements}
                disabled={syncingAchievements}
              >
                {syncingAchievements ? (
                  <SkeletonBlock width={14} height={14} circle />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingAchievements ? (
                <div className="space-y-3">
                  <SkeletonCard className="h-20" />
                  <SkeletonCard className="h-20" />
                </div>
              ) : achievements.length > 0 ? (
                achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-md bg-[color-mix(in_srgb,var(--success)_10%,transparent)] p-2 text-[var(--success)]">
                            <Trophy className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--comp-text-primary)]">
                              {achievement.title}
                            </p>
                            <p className="text-xs text-[var(--comp-text-muted)]">
                              {formatAchievementDate(achievement.achievedAt || achievement.createdAt)} · {achievement.sourceDomain}
                            </p>
                          </div>
                        </div>
                        {achievement.skills.length > 0 ? (
                          <div className="flex flex-wrap gap-2 pl-11">
                            {achievement.skills.slice(0, 4).map((skill) => (
                              <span
                                key={skill}
                                className="rounded-full border border-[var(--comp-border)] px-2 py-0.5 text-xs text-[var(--comp-text-secondary)]"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 sm:w-44">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--success)]" />
                        <Select
                          aria-label={`Visibility for ${achievement.title}`}
                          value={achievement.visibility}
                          disabled={updatingAchievementId === achievement.id}
                          onChange={(event) =>
                            handleAchievementVisibility(achievement.id, event.target.value as ProfileVisibility)
                          }
                        >
                          {ACHIEVEMENT_VISIBILITY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--comp-border)] p-6 text-center">
                  <Trophy className="mx-auto h-6 w-6 text-[var(--comp-text-muted)]" />
                  <p className="mt-3 text-sm font-medium text-[var(--comp-text-primary)]">No verified achievements yet</p>
                  <p className="mt-1 text-xs text-[var(--comp-text-muted)]">
                    Sync after event participation, volunteering, or competition results are published.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
};

export default CareerProfilePage;
