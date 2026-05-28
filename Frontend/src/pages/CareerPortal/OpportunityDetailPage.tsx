import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getOpportunity, trackView, trackApply, bookmarkOpportunity, createApplication, flagOpportunity, type CareerOpportunity } from '../../lib/careerApi';
import { parseCareerBranchFromProfile, parseCareerYearFromProfile } from '../../lib/erpProfileCareer';
import OpportunityCard from '../../components/career/OpportunityCard';
import { Button } from '../../components/button';
import { ArrowLeft, Bookmark, ExternalLink, Calendar, MapPin, Briefcase, GraduationCap, DollarSign, Award, CheckCircle2, AlertCircle, Share2, Flag } from 'lucide-react';
import TypeBadge from '../../components/career/TypeBadge';
import DeadlineCountdown from '../../components/career/DeadlineCountdown';
import ModeChip from '../../components/career/ModeChip';
import StipendChip from '../../components/career/StipendChip';
import EligibilityBadge from '../../components/career/EligibilityBadge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/card';
import { useSession } from '../../hooks/useSession';
import { PageContainer } from '../../components/layout/PageLayouts';
import { cn } from '../../lib/utils';

const AdaptiveTextRenderer = ({ text }: { text: string }) => {
  if (!text) return <span className="text-[var(--comp-text-muted)] italic">No content provided.</span>;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      const useGrid = currentList.length > 6;
      elements.push(
        <ul className={cn("list-disc pl-5 my-4 space-y-2", useGrid ? "sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-2 sm:space-y-0" : "")} key={`list-${elements.length}`}>
          {currentList.map((item, i) => (
            <li key={i} className="text-[var(--comp-text-secondary)] leading-relaxed">{item.replace(/^[\*\-\•]\s*/, '')}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      elements.push(<div key={`space-${index}`} className="h-2" />);
      return;
    }

    // Detect common section headers
    const isHeader = 
      /^(key responsibilities|responsibilities|requirements|what you'll do|what you'll learn|benefits|skills|about the role|about company|tech stack|functional .* qa|performance .* testing)/i.test(trimmed) && trimmed.length < 60;
    
    const isBullet = /^[\*\-\•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed);

    if (isHeader) {
      flushList();
      elements.push(
        <h3 key={`h-${index}`} className="text-lg font-semibold text-[var(--comp-text-primary)] mt-8 mb-4 border-b border-[var(--comp-border)] pb-2">
          {trimmed.replace(/:$/, '').replace(/\\&/g, '&')}
        </h3>
      );
    } else if (isBullet) {
      currentList.push(trimmed.replace(/\\&/g, '&'));
    } else {
      flushList();
      elements.push(
        <p key={`p-${index}`} className="my-3 leading-relaxed text-[var(--comp-text-secondary)]">
          {trimmed.replace(/\\&/g, '&')}
        </p>
      );
    }
  });

  flushList();

  return <div className="adaptive-content">{elements}</div>;
};

const OpportunityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useSession();
  const [opp, setOpp] = useState<CareerOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const data = await getOpportunity(id);
        setOpp(data);
        setBookmarked(data.isBookmarked || false);
        setApplied(data.hasApplied || false);
        await trackView(id);
      } catch (err) {
        console.error('Failed to fetch opportunity', err);
        setError('Opportunity not found or an error occurred.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleBookmark = async () => {
    if (!id) return;
    try {
      const result = await bookmarkOpportunity(id);
      setBookmarked(result.bookmarked);
    } catch (err) {
      console.error('Failed to bookmark', err);
    }
  };

  const handleSimilarBookmarkToggle = async (similarId: string) => {
    if (!opp || !opp.similar) return;
    
    // Optimistic update
    setOpp({
      ...opp,
      similar: opp.similar.map(s => s.id === similarId ? { ...s, isBookmarked: !s.isBookmarked } : s)
    });
    
    try {
      const result = await bookmarkOpportunity(similarId);
      setOpp(prev => {
        if (!prev || !prev.similar) return prev;
        return {
          ...prev,
          similar: prev.similar.map(s => s.id === similarId ? { ...s, isBookmarked: result.bookmarked } : s)
        };
      });
    } catch (err) {
      console.error(err);
      // Revert optimism on failure
      setOpp(prev => {
        if (!prev || !prev.similar) return prev;
        return {
          ...prev,
          similar: prev.similar.map(s => s.id === similarId ? { ...s, isBookmarked: !s.isBookmarked } : s)
        };
      });
    }
  };

  const handleApply = async () => {
    if (!id || !opp) return;
    try {
      await trackApply(id);
      window.open(opp.applyUrl, '_blank');
    } catch (err) {
      console.error('Failed to track apply', err);
    }
  };

  const handleAddToTracker = async () => {
    if (!id) return;
    try {
      await createApplication(id, undefined);
      setApplied(true);
    } catch (err) {
      console.error('Failed to add to tracker', err);
    }
  };

  const handleFlag = async () => {
    if (!id) return;
    const reason = window.prompt('Brief reason for flagging (optional):');
    if (reason === null) return;
    try {
      await flagOpportunity(id, reason.trim() || 'No reason provided');
      window.alert('Thanks — this listing was flagged for review.');
    } catch (err) {
      console.error('Failed to flag', err);
    }
  };

  if (loading) return <div className="body-text p-12 text-center animate-pulse">Loading opportunity details...</div>;
  if (error || !opp) return (
    <div className="p-12 text-center">
      <AlertCircle className="h-12 w-12 text-[var(--error)] mx-auto mb-4" />
      <p className="text-[var(--comp-text-primary)] font-bold text-xl mb-4">{error || 'Opportunity not found'}</p>
      <Button onClick={() => navigate('/career/opportunities')}>Back to Listings</Button>
    </div>
  );

  const studentBranch = parseCareerBranchFromProfile(profile ?? undefined);
  const studentYear = parseCareerYearFromProfile(profile ?? undefined);
  const norm = (s: string) => s.trim().toLowerCase();
  const isBranchEligible =
    opp.eligibleBranches.length === 0 ||
    opp.eligibleBranches.some((b) => ['all', 'any'].includes(norm(b))) ||
    (studentBranch !== '' &&
      opp.eligibleBranches.some((b) => norm(b) === norm(studentBranch)));
  const isYearEligible =
    opp.eligibleYears.length === 0 ||
    (studentYear !== null && opp.eligibleYears.includes(studentYear));

  // Determine layout density
  const contentDensity = 
    (opp.description?.length || 0) + 
    (opp.requirements?.length || 0) + 
    (opp.skills.length * 50);
  const isSparse = contentDensity < 1200;
  const containerMaxWidth = isSparse ? "max-w-5xl" : "";

  return (
    <PageContainer className={`space-y-8 ${containerMaxWidth}`}>
      <Button 
        variant="ghost" 
        onClick={() => navigate(-1)} 
        className="mb-2"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      {/* Hero Section - Full Width */}
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[var(--comp-border)]">
        <div className="space-y-6 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <TypeBadge type={opp.type} className="text-sm px-3 py-1" />
            <ModeChip mode={opp.mode} className="text-sm px-3 py-1" />
            <DeadlineCountdown deadline={opp.deadline} className="text-sm px-3 py-1" />
          </div>
          
          <h1 className="page-title">{opp.title}</h1>
          
          <div className="body-text flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-1.5 font-medium">
              <Briefcase className="h-5 w-5" />
              {opp.company || opp.organizer || 'University Opportunity'}
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-5 w-5" />
              {opp.location || (opp.isPanIndia ? 'Pan India' : 'Remote / Online')}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            <Button 
              className="flex-1 sm:flex-none h-12 px-8 text-lg"
              onClick={handleApply}
            >
              Apply Now <ExternalLink className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              className={applied ? "flex-1 sm:flex-none h-12 text-emerald-600 border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)]" : "flex-1 sm:flex-none h-12"}
              onClick={handleAddToTracker}
              disabled={applied}
            >
              {applied ? <CheckCircle2 className="mr-2 h-5 w-5" /> : null}
              {applied ? 'Added to Tracker' : 'Add to Tracker'}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className={bookmarked ? "h-12 w-12 text-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] border border-[color-mix(in_srgb,var(--warning)_20%,transparent)]" : "h-12 w-12 text-[var(--comp-text-muted)]"}
              onClick={handleBookmark}
            >
              <Bookmark className={bookmarked ? "h-6 w-6 fill-current" : "h-6 w-6"} />
            </Button>
          </div>
        </div>
        
        {/* Right side Image / Icon */}
        <div className="hidden md:flex flex-shrink-0 items-center justify-center w-40 h-40 lg:w-48 lg:h-48 rounded-3xl bg-[var(--comp-surface-hover)] border border-[var(--comp-border)] overflow-hidden shadow-sm mr-4 lg:mr-12">
          {opp.logoUrl || opp.imageUrl ? (
            <img src={opp.logoUrl || opp.imageUrl} alt={opp.company || "Company Logo"} className="w-full h-full object-contain p-4" />
          ) : (
            <Briefcase className="w-16 h-16 lg:w-20 lg:h-20 text-[var(--comp-text-muted)] opacity-50" />
          )}
        </div>
      </header>

      {/* Structured Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader className="border-b border-[var(--comp-border)] pb-4">
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <AdaptiveTextRenderer text={opp.description || ''} />
            </CardContent>
          </Card>

          {/* Requirements */}
          {opp.requirements && (
            <Card>
              <CardHeader className="border-b border-[var(--comp-border)] pb-4">
                <CardTitle className="text-lg">Requirements</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <AdaptiveTextRenderer text={opp.requirements} />
              </CardContent>
            </Card>
          )}

          {/* Skills & Tags */}
          <Card>
            <CardHeader className="border-b border-[var(--comp-border)] pb-4 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Required Skills</CardTitle>
              {opp.skillMatch && (
                <span className="text-sm font-medium text-[var(--comp-text-muted)]">
                  {opp.skillMatch.percent}% Match
                </span>
              )}
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {opp.skills.map(skill => {
                  const isMatched = opp.skillMatch?.matched.some(s => s.toLowerCase() === skill.toLowerCase());
                  return (
                    <span 
                      key={skill} 
                      className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center gap-1.5 ${
                        isMatched 
                          ? 'bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_24%,transparent)]' 
                          : 'bg-[var(--comp-surface-hover)] text-[var(--comp-text-secondary)] border-[var(--comp-border)]'
                      }`}
                    >
                      {isMatched && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {skill}
                    </span>
                  );
                })}
              </div>
              {opp.skillMatch && opp.skillMatch.missing.length > 0 && (
                <p className="text-xs text-[var(--comp-text-muted)] italic">
                  Missing skills: {opp.skillMatch.missing.join(', ')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Key Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b">
                <div className="flex items-center gap-2 text-[var(--comp-text-muted)]">
                  <Calendar className="h-4 w-4" /> Posted on
                </div>
                <div className="font-medium text-[var(--comp-text-primary)]">
                  {opp.postedAt ? new Date(opp.postedAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <div className="flex items-center gap-2 text-[var(--comp-text-muted)]">
                  <DollarSign className="h-4 w-4" /> Compensation
                </div>
                <div className="font-medium text-[var(--comp-text-primary)]">
                  <StipendChip stipend={opp.stipend} prize={opp.prize} isFree={opp.isFree} />
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <div className="flex items-center gap-2 text-[var(--comp-text-muted)]">
                  <GraduationCap className="h-4 w-4" /> Degree
                </div>
                <div className="font-medium text-[var(--comp-text-primary)]">B.Tech / Undergraduate</div>
              </div>
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-2 text-[var(--comp-text-muted)]">
                  <Award className="h-4 w-4" /> Experience
                </div>
                <div className="font-medium text-[var(--comp-text-primary)]">Fresher / Student</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Eligibility Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <EligibilityBadge 
                eligible={isBranchEligible} 
                label={opp.eligibleBranches.length === 0 ? "All Branches" : opp.eligibleBranches.join(', ')} 
              />
              <EligibilityBadge 
                eligible={isYearEligible} 
                label={opp.eligibleYears.length === 0 ? "All Years" : opp.eligibleYears.map(y => `${y}${y===1?'st':y===2?'nd':y===3?'rd':'th'} Year`).join(', ')} 
              />
              {opp.minCGPA && (
                <EligibilityBadge 
                  eligible={true} // CGPA data might not be in profile yet
                  label={`Minimum ${opp.minCGPA} CGPA`} 
                />
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button variant="ghost" className="w-full justify-start">
              <Share2 className="mr-2 h-4 w-4" /> Share Opportunity
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start hover:text-[var(--error)]"
              onClick={handleFlag}
            >
              <Flag className="mr-2 h-4 w-4" /> Flag for moderation
            </Button>
          </div>
        </div>
      </div>

      {opp.similar && opp.similar.length > 0 ? (
        <section className="mt-12 space-y-4 border-t border-[var(--comp-border)] pt-10">
          <h2 className="section-title">Similar opportunities</h2>
          <p className="body-text">Same type as this listing, explore related openings.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {opp.similar.map((s) => (
              <OpportunityCard key={s.id} opportunity={s} onBookmarkToggle={handleSimilarBookmarkToggle} />
            ))}
          </div>
        </section>
      ) : null}
    </PageContainer>
  );
};

export default OpportunityDetailPage;
