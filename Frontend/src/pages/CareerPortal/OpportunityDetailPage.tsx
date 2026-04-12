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

  if (loading) return <div className="p-12 text-center text-gray-500 animate-pulse">Loading opportunity details...</div>;
  if (error || !opp) return (
    <div className="p-12 text-center">
      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <p className="text-gray-900 font-bold text-xl mb-4">{error || 'Opportunity not found'}</p>
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

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
      <Button 
        variant="ghost" 
        onClick={() => navigate(-1)} 
        className="text-gray-600 hover:text-gray-900 mb-2"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Header Info */}
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <TypeBadge type={opp.type} className="text-sm px-3 py-1" />
              <ModeChip mode={opp.mode} className="text-sm px-3 py-1" />
              <DeadlineCountdown deadline={opp.deadline} className="text-sm px-3 py-1" />
            </div>
            
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{opp.title}</h1>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-gray-600">
              <div className="flex items-center gap-1.5 font-medium">
                <Briefcase className="h-5 w-5" />
                {opp.company || opp.organizer || 'University Opportunity'}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-5 w-5" />
                {opp.location || (opp.isPanIndia ? 'Pan India' : 'Remote / Online')}
              </div>
            </div>
          </header>

          <div className="flex flex-wrap gap-4">
            <Button 
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 h-12 px-8 text-lg"
              onClick={handleApply}
            >
              Apply Now <ExternalLink className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              className={applied ? "flex-1 sm:flex-none h-12 text-emerald-600 border-emerald-200 bg-emerald-50" : "flex-1 sm:flex-none h-12"}
              onClick={handleAddToTracker}
              disabled={applied}
            >
              {applied ? <CheckCircle2 className="mr-2 h-5 w-5" /> : null}
              {applied ? 'Added to Tracker' : 'Add to Tracker'}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className={bookmarked ? "h-12 w-12 text-amber-500 fill-amber-500" : "h-12 w-12 text-gray-400"}
              onClick={handleBookmark}
            >
              <Bookmark className="h-6 w-6" />
            </Button>
          </div>

          {/* Description */}
          <section className="prose max-w-none text-gray-700">
            <h2 className="text-xl font-bold border-b pb-2 mb-4">Description</h2>
            <div className="whitespace-pre-wrap leading-relaxed">
              {opp.description || 'No detailed description provided.'}
            </div>
          </section>

          {/* Requirements */}
          {opp.requirements && (
            <section>
              <h2 className="text-xl font-bold border-b pb-2 mb-4">Requirements</h2>
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                {opp.requirements}
              </div>
            </section>
          )}

          {/* Skills & Tags */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2 mb-2">
              <h2 className="text-xl font-bold">Required Skills</h2>
              {opp.skillMatch && (
                <span className="text-sm font-medium text-gray-500">
                  {opp.skillMatch.percent}% Match
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {opp.skills.map(skill => {
                const isMatched = opp.skillMatch?.matched.some(s => s.toLowerCase() === skill.toLowerCase());
                return (
                  <span 
                    key={skill} 
                    className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center gap-1.5 ${
                      isMatched 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {isMatched && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {skill}
                  </span>
                );
              })}
            </div>
            {opp.skillMatch && opp.skillMatch.missing.length > 0 && (
              <p className="text-xs text-gray-400 italic">
                Missing skills: {opp.skillMatch.missing.join(', ')}
              </p>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Key Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b">
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar className="h-4 w-4" /> Posted on
                </div>
                <div className="font-medium text-gray-900">
                  {opp.postedAt ? new Date(opp.postedAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <div className="flex items-center gap-2 text-gray-500">
                  <DollarSign className="h-4 w-4" /> Compensation
                </div>
                <div className="font-medium text-gray-900">
                  <StipendChip stipend={opp.stipend} prize={opp.prize} isFree={opp.isFree} />
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <div className="flex items-center gap-2 text-gray-500">
                  <GraduationCap className="h-4 w-4" /> Degree
                </div>
                <div className="font-medium text-gray-900">B.Tech / Undergraduate</div>
              </div>
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-2 text-gray-500">
                  <Award className="h-4 w-4" /> Experience
                </div>
                <div className="font-medium text-gray-900">Fresher / Student</div>
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
            <Button variant="ghost" className="w-full justify-start text-gray-500 hover:text-blue-600">
              <Share2 className="mr-2 h-4 w-4" /> Share Opportunity
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-gray-500 hover:text-red-600"
              onClick={handleFlag}
            >
              <Flag className="mr-2 h-4 w-4" /> Flag for moderation
            </Button>
          </div>
        </div>
      </div>

      {opp.similar && opp.similar.length > 0 ? (
        <section className="mt-12 space-y-4 border-t border-gray-100 pt-10">
          <h2 className="text-xl font-bold text-gray-900">Similar opportunities</h2>
          <p className="text-sm text-gray-500">Same type as this listing — explore related openings.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {opp.similar.map((s) => (
              <OpportunityCard key={s.id} opportunity={s} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default OpportunityDetailPage;
