import React, { useEffect, useState } from 'react';
import { listOpportunities, getPersonalizedFeed, type CareerOpportunity } from '../../lib/careerApi';
import OpportunityCard from '../../components/career/OpportunityCard';
import { Button } from '../../components/button';
import { PlusCircle, Search, Clock, Briefcase, GraduationCap, Code, Trophy, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const CareerHomePage: React.FC = () => {
  const [latestOpps, setLatestOpps] = useState<CareerOpportunity[]>([]);
  const [personalizedOpps, setPersonalizedOpps] = useState<CareerOpportunity[]>([]);
  const [expiringOpps, setExpiringOpps] = useState<CareerOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [latest, expiring, personalized] = await Promise.all([
          listOpportunities({ limit: '6', sort: 'recent' }),
          listOpportunities({ limit: '8', sort: 'deadline', expiringWithinDays: '3' }),
          getPersonalizedFeed()
        ]);
        setLatestOpps(latest.items);
        setExpiringOpps(expiring.items);
        setPersonalizedOpps(personalized.items.slice(0, 3));
      } catch (err) {
        console.error('Failed to fetch career opportunities', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const typeFilters = [
    { label: 'All', icon: <Search className="w-4 h-4" />, type: '' },
    { label: 'Jobs', icon: <Briefcase className="w-4 h-4" />, type: 'job' },
    { label: 'Internships', icon: <GraduationCap className="w-4 h-4" />, type: 'internship' },
    { label: 'Hackathons', icon: <Code className="w-4 h-4" />, type: 'hackathon' },
    { label: 'Competitions', icon: <Trophy className="w-4 h-4" />, type: 'competition' },
  ];

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Career Portal</h1>
          <p className="text-gray-500">Autonomous opportunity discovery and tracker</p>
        </div>
        <Link to="/career/submit">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <PlusCircle className="mr-2 h-4 w-4" /> Submit Opportunity
          </Button>
        </Link>
      </header>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        {typeFilters.map((f) => (
          <Link 
            key={f.label} 
            to={f.type ? `/career/opportunities?type=${f.type}` : '/career/opportunities'}
          >
            <Button variant="outline" className="rounded-full flex items-center gap-2">
              {f.icon} {f.label}
            </Button>
          </Link>
        ))}
      </div>

      {/* Personalized for You (Phase 4) */}
      {personalizedOpps.length > 0 && (
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-3xl border border-blue-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-blue-900">Personalized for You</h2>
            </div>
            <Link to="/career/me/profile" className="text-sm font-medium text-blue-600 hover:underline">
              Update Profile
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {personalizedOpps.map(opp => (
              <OpportunityCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        </section>
      )}

      {/* Expiring Soon */}
      {expiringOpps.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-semibold">Expiring Soon</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {expiringOpps.map(opp => (
              <OpportunityCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        </section>
      )}

      {/* Latest Opportunities */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Latest Opportunities</h2>
          <Link to="/career/opportunities" className="text-blue-600 hover:underline text-sm font-medium">
            View All
          </Link>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : latestOpps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {latestOpps.map(opp => (
              <OpportunityCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-gray-500">No opportunities found. Be the first to submit one!</p>
          </div>
        )}
      </section>

      {/* Tracker Shortcut */}
      <section className="bg-[color-mix(in_srgb,var(--info)_10%,transparent)] p-6 rounded-2xl border border-blue-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-blue-900">Application Tracker</h3>
          <p className="text-[var(--info)]">Manage your applications and track their status in one place.</p>
        </div>
        <Link to="/career/me/tracker">
          <Button variant="outline" className="border-[color-mix(in_srgb,var(--info)_30%,transparent)] hover:bg-blue-100 text-[var(--info)]">
            Open Tracker
          </Button>
        </Link>
      </section>
    </div>
  );
};

export default CareerHomePage;
