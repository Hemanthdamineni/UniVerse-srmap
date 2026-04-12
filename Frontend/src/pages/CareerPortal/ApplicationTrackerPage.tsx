import React, { useEffect, useState } from 'react';
import { listApplications, updateApplication, deleteApplication, type CareerApplication } from '../../lib/careerApi';
import { Button } from '../../components/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/card';
import { Trash2, ExternalLink, Calendar, CheckCircle2, Clock, XCircle, AlertCircle, Briefcase, GraduationCap, Code, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

const ApplicationTrackerPage: React.FC = () => {
  const [applications, setApplications] = useState<CareerApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      const data = await listApplications();
      setApplications(data.items);
    } catch (err) {
      console.error('Failed to fetch applications', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateApplication(id, newStatus);
      fetchApps();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this application from your tracker?')) return;
    try {
      await deleteApplication(id);
      fetchApps();
    } catch (err) {
      console.error('Failed to delete application', err);
    }
  };

  const statusOptions = [
    { value: 'applied', label: 'Applied', color: 'bg-blue-100 text-blue-800' },
    { value: 'under_review', label: 'Under Review', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'shortlisted', label: 'Shortlisted', color: 'bg-emerald-100 text-emerald-800' },
    { value: 'interviewed', label: 'Interviewed', color: 'bg-purple-100 text-purple-800' },
    { value: 'offered', label: 'Offered', color: 'bg-green-100 text-green-800 font-bold' },
    { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' },
    { value: 'withdrawn', label: 'Withdrawn', color: 'bg-gray-100 text-gray-800' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Application Tracker</h1>
          <p className="text-gray-500">Manage your active job hunt</p>
        </div>
        <Link to="/career/opportunities">
          <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
            Find More
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-24 text-gray-400">Loading applications...</div>
      ) : applications.length > 0 ? (
        <div className="space-y-4">
          {applications.map(app => (
            <Card key={app.id} className="overflow-hidden border-l-4" style={{ borderLeftColor: 'currentColor' }}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-2 bg-gray-50 rounded-lg hidden sm:block">
                    {app.type === 'job' && <Briefcase className="h-5 w-5 text-blue-600" />}
                    {app.type === 'internship' && <GraduationCap className="h-5 w-5 text-green-600" />}
                    {app.type === 'hackathon' && <Code className="h-5 w-5 text-purple-600" />}
                    {app.type === 'competition' && <Trophy className="h-5 w-5 text-orange-600" />}
                  </div>
                  <div>
                    <Link to={`/career/opportunities/${app.opportunityId}`} className="text-lg font-bold hover:text-blue-600 transition-colors">
                      {app.opportunityTitle}
                    </Link>
                    <p className="text-sm text-gray-500">{app.company || 'University Opportunity'}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Applied {new Date(app.appliedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                  <select 
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 cursor-pointer ${
                      statusOptions.find(o => o.value === app.status)?.color || 'bg-gray-100'
                    }`}
                    value={app.status}
                    onChange={(e) => handleStatusChange(app.id, e.target.value)}
                  >
                    {statusOptions.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-white text-gray-900">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-600" onClick={() => handleDelete(app.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No applications tracked yet.</p>
          <p className="text-gray-400 text-sm mb-6">Found an opportunity you like? Click "Add to Tracker" to manage it here.</p>
          <Link to="/career/opportunities">
            <Button>Explore Opportunities</Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default ApplicationTrackerPage;
