import React, { useEffect, useState, useMemo } from "react";
import { listApplications, updateApplication, deleteApplication, type CareerApplication } from "../../lib/career/careerApi";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/Layouts";
import { SkeletonCard } from "../../components/ui/Skeletons";
import { EmptyState } from "../../components/ui/Feedback";
import { Trash2, Calendar, Building2, GripVertical, Clock, CheckCircle2, XCircle } from "lucide-react";
import { StatusBadge } from "../../components/ui/Badges";

const COLUMNS: { id: CareerApplication["status"]; label: string }[] = [
  { id: "interested", label: "Interested" },
  { id: "applied", label: "Applied" },
  { id: "under_review", label: "Under Review" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "interviewed", label: "Interviewing" },
  { id: "offered", label: "Offered" },
  { id: "rejected", label: "Rejected" },
];

const ApplicationTrackerPage: React.FC = () => {
  const [applications, setApplications] = useState<CareerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);

  useEffect(() => {
    void fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      const data = await listApplications();
      setApplications(data.items);
    } catch (err) {
      console.error("Failed to fetch applications", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedAppId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("applicationId", id);
    // Subtle visual cue for dragging
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = "0.5";
      }
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedAppId(null);
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = "1";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, newStatus: CareerApplication["status"]) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData("applicationId");
    
    if (!appId) return;

    const appToMove = applications.find(a => a.id === appId);
    if (!appToMove || appToMove.status === newStatus) return;

    // Optimistic UI Update
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));

    try {
      await updateApplication(appId, newStatus);
    } catch (err) {
      console.error("Failed to update status", err);
      // Revert on failure
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: appToMove.status } : a));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this application from your tracker?")) return;
    
    // Optimistic delete
    const previousApps = [...applications];
    setApplications(prev => prev.filter(a => a.id !== id));
    
    try {
      await deleteApplication(id);
    } catch (err) {
      console.error("Failed to delete application", err);
      setApplications(previousApps);
    }
  };

  // Analytics computed
  const analytics = useMemo(() => {
    const total = applications.length;
    const interviewing = applications.filter(a => a.status === 'interviewed').length;
    const offers = applications.filter(a => a.status === 'offered').length;
    const rejected = applications.filter(a => a.status === 'rejected').length;
    const responseRate = total > 0 ? Math.round(((interviewing + offers + rejected) / total) * 100) : 0;
    
    return { total, interviewing, offers, responseRate };
  }, [applications]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-4 p-4 sm:p-6">
        <SkeletonCard className="h-24" />
        <div className="flex gap-4 overflow-x-auto">
          {[1,2,3,4].map(i => <SkeletonCard key={i} className="h-96 min-w-[280px] flex-1" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 h-[calc(100vh-80px)] flex flex-col">
      <PageHeader
        title="Application Tracker"
        subtitle="Manage your active job hunt"
        actions={
          <Link to="/career/opportunities" className="btn-secondary rounded-lg px-4 py-2 text-sm no-underline">
            Find more
          </Link>
        }
      />

      {applications.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[var(--surface)] p-4 rounded-xl border border-[color-mix(in_srgb,var(--border)_95%,transparent)]">
          <div className="flex flex-col">
            <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Total Active</span>
            <span className="text-2xl font-bold text-[var(--text-primary)]">{analytics.total}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold flex items-center gap-1"><Clock className="w-3 h-3"/> Interviews</span>
            <span className="text-2xl font-bold text-[var(--comp-accent)]">{analytics.interviewing}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Offers</span>
            <span className="text-2xl font-bold text-[var(--success)]">{analytics.offers}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Response Rate</span>
            <span className="text-2xl font-bold text-[var(--text-primary)]">{analytics.responseRate}%</span>
          </div>
        </div>
      )}

      {applications.length === 0 ? (
        <EmptyState
          title="No applications tracked yet"
          description='Found an opportunity you like? Use "Add to Tracker" on the listing to manage it here.'
          action={
            <Link to="/career/opportunities" className="btn-primary rounded-lg px-4 py-2 text-sm no-underline">
              Explore opportunities
            </Link>
          }
        />
      ) : (
        <div className="flex-1 overflow-auto pr-2 pb-6">
          <div className="flex min-w-[700px] md:min-w-[1200px] lg:grid lg:min-w-0 lg:grid-cols-4 gap-6">
            {COLUMNS.map((column) => {
              const columnApps = applications.filter((a) => a.status === column.id);

              return (
                <div
                  key={column.id}
                  className="w-72 shrink-0 lg:w-auto h-[400px] lg:h-[450px] flex flex-col rounded-xl bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] border border-[color-mix(in_srgb,var(--border)_50%,transparent)] overflow-hidden shadow-sm"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.id)}
                >
                  <div className="flex items-center justify-between p-3 border-b border-[color-mix(in_srgb,var(--border)_50%,transparent)]">
                    <h3 className="font-semibold text-sm text-[var(--text-primary)]">{column.label}</h3>
                    <span className="text-xs font-medium bg-[var(--background)] px-2 py-0.5 rounded-full text-[var(--text-secondary)]">
                      {columnApps.length}
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {columnApps.map(app => (
                      <div 
                        key={app.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, app.id)}
                        onDragEnd={handleDragEnd}
                        className="group relative flex flex-col gap-2 rounded-lg bg-[var(--background)] p-3 border border-[color-mix(in_srgb,var(--border)_95%,transparent)] shadow-sm hover:border-[var(--comp-accent)] hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link 
                            to={`/career/opportunities/${app.opportunityId}`}
                            className="text-sm font-semibold text-[var(--text-primary)] leading-tight no-underline hover:text-[var(--comp-accent)] line-clamp-2"
                          >
                            {app.opportunityTitle}
                          </Link>
                          <button 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(app.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-[var(--error)]"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                          <Building2 className="w-3.5 h-3.5" />
                          <span className="truncate">{app.company || "University Opportunity"}</span>
                        </div>
                        
                        {app.status !== 'interested' && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Applied {new Date(app.appliedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          </div>
                        )}
                        
                        {/* Drag handle hint for mobile */}
                        <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-[var(--surface)] border border-[color-mix(in_srgb,var(--border)_95%,transparent)] rounded-full px-2 shadow-sm text-[var(--text-muted)]">
                            <GripVertical className="w-3 h-3 rotate-90" />
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {columnApps.length === 0 && (
                      <div className="h-24 border-2 border-dashed border-[color-mix(in_srgb,var(--border)_30%,transparent)] rounded-lg flex items-center justify-center">
                        <span className="text-xs text-[var(--text-muted)]">Drop here</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationTrackerPage;
