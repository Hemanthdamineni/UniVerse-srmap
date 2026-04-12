import React, { useEffect, useState, useCallback } from 'react';
import { listOpportunities, type CareerOpportunity } from '../../lib/careerApi';
import OpportunityCard from '../../components/career/OpportunityCard';
import { Input } from '../../components/input';
import { Search, Filter, Loader2, ArrowDownAZ, Calendar, Zap, TrendingUp } from 'lucide-react';
import { Button } from '../../components/button';
import { useSearchParams } from 'react-router-dom';

interface OpportunitiesPageProps {
  initialType?: string;
}

const OpportunitiesPage: React.FC<OpportunitiesPageProps> = ({ initialType }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [opportunities, setOpportunities] = useState<CareerOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('query') || '');
  const [type, setType] = useState(initialType || searchParams.get('type') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'relevance');

  const fetchOpps = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (searchTerm) filters.query = searchTerm;
      if (type) filters.type = type;
      if (sort) filters.sort = sort;
      
      const data = await listOpportunities(filters);
      setOpportunities(data.items);
    } catch (err) {
      console.error('Failed to fetch opportunities', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, type, sort]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOpps();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchOpps]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setSearchParams(prev => {
      if (e.target.value) prev.set('query', e.target.value);
      else prev.delete('query');
      return prev;
    });
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    setSearchParams(prev => {
      if (newType) prev.set('type', newType);
      else prev.delete('type');
      return prev;
    });
  };

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    setSearchParams(prev => {
      prev.set('sort', newSort);
      return prev;
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
          <p className="text-gray-500">Find your next step</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Search jobs, skills, company..." 
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center text-sm border-b pb-4">
        <span className="text-gray-500 mr-2">Filter:</span>
        {['all', 'job', 'internship', 'hackathon', 'competition', 'fellowship', 'workshop'].map(t => (
          <Button
            key={t}
            variant={type === (t === 'all' ? '' : t) ? 'default' : 'ghost'}
            size="sm"
            className="rounded-full capitalize h-8"
            onClick={() => handleTypeChange(t === 'all' ? '' : t)}
          >
            {t}
          </Button>
        ))}
        
        <div className="ml-auto flex items-center gap-2">
          <span className="text-gray-500 hidden sm:inline">Sort:</span>
          <select 
            className="bg-transparent font-medium focus:outline-none text-gray-700 text-sm cursor-pointer"
            value={sort}
            onChange={(e) => handleSortChange(e.target.value)}
          >
            <option value="relevance">Relevance</option>
            <option value="recent">Newest</option>
            <option value="deadline">Deadline</option>
            <option value="popular">Popular</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p>Searching opportunities...</p>
        </div>
      ) : opportunities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {opportunities.map(opp => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <p className="text-gray-500 mb-2">No opportunities match your search.</p>
          <Button variant="link" onClick={() => {
            setSearchTerm('');
            setType('');
            setSearchParams({});
          }}>
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  );
};

export default OpportunitiesPage;
