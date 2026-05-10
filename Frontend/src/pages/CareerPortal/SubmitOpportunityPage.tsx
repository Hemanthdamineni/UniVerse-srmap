// Submit opportunity: SkeletonBlock replaces submit spinner; submit handler unchanged.
import React, { useState } from "react";
import { submitOpportunity } from "../../lib/careerApi";
import { Button } from "../../components/button";
import { Input } from "../../components/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/card";
import { AlertCircle, CheckCircle2, PlusCircle, Globe } from "lucide-react";
import { SkeletonBlock } from "../../components/ui/SkeletonBlock";
import { PageContainer } from "../../components/layout/PageLayouts";
import { useNavigate } from 'react-router-dom';

const SubmitOpportunityPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    type: 'internship',
    company: '',
    organizer: '',
    applyUrl: '',
    deadline: '',
    description: '',
    location: '',
    mode: 'remote',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await submitOpportunity(formData);
      setSuccess(true);
      setTimeout(() => navigate('/career'), 2000);
    } catch (err: any) {
      console.error('Failed to submit', err);
      setError(err.message || 'Failed to submit opportunity. Please check your data.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="p-4 bg-[color-mix(in_srgb,var(--success)_10%,transparent)] rounded-full">
          <CheckCircle2 className="h-12 w-12 text-[var(--success)]" />
        </div>
        <h1 className="page-title">Successfully submitted</h1>
        <p className="body-text">Your opportunity has been received and will be reviewed soon.</p>
        <p className="text-sm text-[var(--comp-accent)] font-medium animate-pulse">Redirecting you to the portal...</p>
      </div>
    );
  }

  return (
    <PageContainer className="max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="page-title">Submit an Opportunity</h1>
        <p className="body-text">Share a job, internship, or competition with your fellow students.</p>
      </header>

      {error && (
        <div className="bg-[color-mix(in_srgb,var(--error)_10%,transparent)] border border-[color-mix(in_srgb,var(--error)_24%,transparent)] p-4 rounded-xl flex items-start gap-3 text-[var(--error)]">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Core Details</CardTitle>
            <CardDescription>Essential information about the opportunity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[var(--comp-text-primary)]">Opportunity Title *</label>
                <Input 
                  name="title"
                  placeholder="e.g. Software Engineering Intern" 
                  value={formData.title}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[var(--comp-text-primary)]">Type *</label>
                <select 
                  name="type"
                  className="flex h-10 w-full rounded-md border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 text-sm text-[var(--comp-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comp-accent)] focus-visible:ring-offset-2"
                  value={formData.type}
                  onChange={handleChange}
                  required
                >
                  <option value="internship">Internship</option>
                  <option value="job">Full-time Job</option>
                  <option value="hackathon">Hackathon</option>
                  <option value="competition">Competition</option>
                  <option value="fellowship">Fellowship</option>
                  <option value="workshop">Workshop</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[var(--comp-text-primary)]">Company / Organization</label>
                <Input 
                  name="company"
                  placeholder="e.g. Google, SRM University" 
                  value={formData.company}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[var(--comp-text-primary)]">Apply URL *</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--comp-text-muted)]" />
                  <Input 
                    name="applyUrl"
                    placeholder="https://..." 
                    className="pl-9"
                    value={formData.applyUrl}
                    onChange={handleChange}
                    type="url"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[var(--comp-text-primary)]">Deadline</label>
                <Input 
                  name="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-[var(--comp-text-primary)]">Mode</label>
                <select 
                  name="mode"
                  className="flex h-10 w-full rounded-md border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 text-sm text-[var(--comp-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comp-accent)] focus-visible:ring-offset-2"
                  value={formData.mode}
                  onChange={handleChange}
                >
                  <option value="remote">Remote</option>
                  <option value="onsite">On-site</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="online">Online Only</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-[var(--comp-text-primary)]">Description</label>
              <textarea 
                name="description"
                className="flex min-h-[120px] w-full rounded-md border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 py-2 text-sm text-[var(--comp-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comp-accent)] focus-visible:ring-offset-2"
                placeholder="Describe the opportunity, requirements, and benefits..."
                value={formData.description}
                onChange={handleChange}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button 
            type="submit" 
            className="flex-1 h-12 font-bold text-lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <SkeletonBlock width={20} height={20} circle className="mr-2 inline-block align-middle" />
                Submitting...
              </>
            ) : (
              <><PlusCircle className="mr-2 h-5 w-5" /> Submit Opportunity</>
            )}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            className="h-12 px-8"
            onClick={() => navigate('/career')}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </PageContainer>
  );
};

export default SubmitOpportunityPage;
