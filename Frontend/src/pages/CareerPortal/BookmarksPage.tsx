import React, { useEffect, useState } from 'react';
import { listOpportunities, type CareerOpportunity } from '../../lib/careerApi';
import OpportunityCard from '../../components/career/OpportunityCard';
import { Bookmark, Loader2 } from 'lucide-react';

const BookmarksPage: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<CareerOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        // In a real implementation, we might have a specific endpoint for bookmarks
        // For Phase 1, we filter all opportunities that are bookmarked
        const data = await listOpportunities();
        setBookmarks(data.items.filter(opp => opp.isBookmarked));
      } catch (err) {
        console.error('Failed to fetch bookmarks', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookmarks();
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-100 rounded-lg">
          <Bookmark className="h-6 w-6 text-amber-600 fill-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Bookmarks</h1>
          <p className="text-gray-500">Opportunities you've saved for later</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          <p>Loading your bookmarks...</p>
        </div>
      ) : bookmarks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bookmarks.map(opp => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Bookmark className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No bookmarks yet.</p>
          <p className="text-gray-400 text-sm">Save opportunities you're interested in to see them here.</p>
        </div>
      )}
    </div>
  );
};

export default BookmarksPage;
