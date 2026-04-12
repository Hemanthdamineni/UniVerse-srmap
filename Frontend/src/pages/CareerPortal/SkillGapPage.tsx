import React, { useEffect, useState } from 'react';
import { listSkillGaps, type SkillGap } from '../../lib/careerApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/card';
import { Award, Zap, TrendingUp, BookOpen, ChevronRight, Loader2, Search } from 'lucide-react';
import { Button } from '../../components/button';
import { Link } from 'react-router-dom';

const SkillGapPage: React.FC = () => {
  const [gaps, setGaps] = useState<SkillGap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGaps();
  }, []);

  const fetchGaps = async () => {
    try {
      const data = await listSkillGaps();
      setGaps(data.items);
    } catch (err) {
      console.error('Failed to fetch skill gaps', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-gray-500 animate-pulse">Analyzing skill gaps...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Skill Gap Analysis</h1>
        <p className="text-gray-500">Identify technical skills that unlock the most opportunities for you</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
              High Impact Skills
            </CardTitle>
            <CardDescription>Skills you're missing that appear in the most active listings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {gaps.length > 0 ? (
              <div className="divide-y">
                {gaps.map((gap) => (
                  <div key={gap.skill} className="py-4 flex items-center justify-between group">
                    <div className="space-y-1">
                      <p className="text-lg font-bold capitalize text-gray-900">{gap.skill}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Search className="h-3 w-3" /> Required in {gap.opportunityCount} active opportunities
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link to={`/career/opportunities?query=${gap.skill}`}>
                        <Button variant="ghost" size="sm" className="text-xs">View Jobs</Button>
                      </Link>
                      <Link to="/resources/learning-materials">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                          <BookOpen className="mr-2 h-3 w-3" /> Learn
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500 italic">
                No major skill gaps identified. You're well-matched for current opportunities!
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-blue-600 text-white border-none">
            <CardHeader>
              <CardTitle className="text-lg">Career Growth</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-blue-100 text-sm">
                Adding just the top 3 skills from this list could unlock up to 
                <span className="font-bold text-white mx-1">
                  {gaps.slice(0, 3).reduce((acc, curr) => acc + curr.opportunityCount, 0)}
                </span> 
                more opportunities.
              </p>
              <Link to="/career/me/profile">
                <Button variant="secondary" className="w-full bg-white text-blue-600 hover:bg-blue-50">
                  Update Profile
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase text-gray-500">LMS Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                Found a skill you want to master? Check our curated learning materials in the Resources section.
              </p>
              <Link to="/resources/learning-materials" className="flex items-center text-sm font-medium text-blue-600 hover:underline">
                Browse Resources <ChevronRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SkillGapPage;
