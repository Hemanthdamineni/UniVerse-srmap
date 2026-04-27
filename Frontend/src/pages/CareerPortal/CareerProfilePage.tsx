// Career profile: PageHeader-level tokens, SkeletonBlock for button loading, SkeletonCard page load; API unchanged.
import React, { useEffect, useState } from "react";
import { getProfile, updateProfile, uploadResume, type CareerProfile } from '../../lib/careerApi';
import { Button } from '../../components/button';
import { Input } from '../../components/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/card';
import { User, Briefcase, MapPin, DollarSign, Award, Linkedin, Github, Globe, FileText, Upload, CheckCircle2, Plus, X } from "lucide-react";
import { SkeletonBlock } from "../../components/ui/SkeletonBlock";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { useSession } from '../../hooks/useSession';

const CareerProfilePage: React.FC = () => {
  const { profile: erpProfile } = useSession();
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await getProfile();
      setProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile(profile);
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
      const result = await uploadResume(file);
      setProfile(prev => prev ? { ...prev, resumeUrl: result.url, resumeFileName: result.fileName } : null);
      setMessage({ type: 'success', text: 'Resume uploaded successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to upload resume.' });
    } finally {
      setUploading(false);
    }
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
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-8">
        <SkeletonCard className="h-16" />
        <SkeletonCard className="h-96" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Career Profile</h1>
          <p className="text-gray-500">Personalize your opportunity matching and feed</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
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
        <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border-emerald-100 text-[var(--success)]' : 'bg-[color-mix(in_srgb,var(--error)_10%,transparent)] border-red-100 text-[var(--error)]'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: ERP Sync & Resume */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500">ERP Sync</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-full"><User className="h-4 w-4 text-gray-600" /></div>
                <div>
                  <p className="text-xs text-gray-400">Name</p>
                  <p className="text-sm font-medium">{erpProfile?.Name || 'Syncing...'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-full"><Award className="h-4 w-4 text-gray-600" /></div>
                <div>
                  <p className="text-xs text-gray-400">Branch & Year</p>
                  <p className="text-sm font-medium">
                    {erpProfile?.TableContent?.["Program / Section"]?.split(' ')[1] || 'CSE'} - {erpProfile?.TableContent?.["Academic Year"]?.split(' ')[0] || 'III'} Year
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-500">Resume</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile?.resumeUrl ? (
                <div className="p-3 border rounded-lg bg-[color-mix(in_srgb,var(--info)_10%,transparent)] border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                    <span className="text-sm font-medium text-[var(--info)] truncate">{profile.resumeFileName}</span>
                  </div>
                  <a href={profile.resumeUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">View</a>
                </div>
              ) : (
                <div className="p-8 border-2 border-dashed rounded-lg text-center">
                  <p className="text-xs text-gray-400 mb-2">No resume uploaded</p>
                </div>
              )}
              
              <div className="relative">
                <input 
                  type="file" 
                  id="resume-upload" 
                  className="hidden" 
                  accept=".pdf" 
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
                      {profile?.resumeUrl ? 'Update Resume' : 'Upload Resume (PDF)'}
                    </span>
                  </Button>
                </label>
              </div>
              <p className="text-[10px] text-gray-400 text-center">Max 5MB. PDF only.</p>
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
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                />
                <Button onClick={addSkill} size="icon" variant="secondary"><Plus className="h-4 w-4" /></Button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {profile?.skills.map(skill => (
                  <span key={skill} className="px-3 py-1 bg-blue-100 text-[var(--info)] rounded-full text-sm font-medium flex items-center gap-1 border border-[color-mix(in_srgb,var(--info)_30%,transparent)]">
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="hover:text-blue-900"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {profile?.skills.length === 0 && <p className="text-sm text-gray-400 italic">No skills added yet.</p>}
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
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[color-mix(in_srgb,var(--info)_30%,transparent)]'
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
                  <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    className="pl-9" 
                    placeholder="LinkedIn URL" 
                    value={profile?.linkedinUrl}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, linkedinUrl: e.target.value } : null)}
                  />
                </div>
                <div className="relative">
                  <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    className="pl-9" 
                    placeholder="GitHub URL" 
                    value={profile?.githubUrl}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, githubUrl: e.target.value } : null)}
                  />
                </div>
              </div>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  className="pl-9" 
                  placeholder="Portfolio / Website URL" 
                  value={profile?.portfolioUrl}
                  onChange={(e) => setProfile(prev => prev ? { ...prev, portfolioUrl: e.target.value } : null)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CareerProfilePage;
