// Application tracker: PageHeader, DataTable, StatusBadge, SkeletonCard loading; API calls unchanged.
import React, { useEffect, useState } from "react";
import { listApplications, updateApplication, deleteApplication, type CareerApplication } from "../../lib/careerApi";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { DataTable } from "../../components/ui/DataTable";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { SkeletonCard } from "../../components/ui/SkeletonCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { Trash2, Calendar } from "lucide-react";
import { Select } from "../../components/select";
import { RowActionButton } from "../../components/data/RowActionButton";

const ApplicationTrackerPage: React.FC = () => {
  const [applications, setApplications] = useState<CareerApplication[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateApplication(id, newStatus);
      void fetchApps();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this application from your tracker?")) return;
    try {
      await deleteApplication(id);
      void fetchApps();
    } catch (err) {
      console.error("Failed to delete application", err);
    }
  };

  const statusOptions = [
    { value: "applied", label: "Applied" },
    { value: "under_review", label: "Under Review" },
    { value: "shortlisted", label: "Shortlisted" },
    { value: "interviewed", label: "Interviewed" },
    { value: "offered", label: "Offered" },
    { value: "rejected", label: "Rejected" },
    { value: "withdrawn", label: "Withdrawn" },
  ];

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Application Tracker"
        subtitle="Manage your active job hunt"
        actions={
          <Link to="/career/opportunities" className="btn-secondary rounded-lg px-4 py-2 text-sm no-underline">
            Find more
          </Link>
        }
      />

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
        <DataTable
          data={applications}
          keyExtractor={(row) => row.id}
          columns={[
            {
              header: "Opportunity",
              accessor: (app) => (
                <Link
                  to={`/career/opportunities/${app.opportunityId}`}
                  className="card-title font-semibold text-[var(--comp-accent)] no-underline hover:underline"
                >
                  {app.opportunityTitle}
                </Link>
              ),
            },
            {
              header: "Company",
              accessor: (app) => (
                <span className="body-text">{app.company || "University Opportunity"}</span>
              ),
            },
            {
              header: "Applied",
              accessor: (app) => (
                <span className="body-text flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {new Date(app.appliedAt).toLocaleDateString()}
                </span>
              ),
            },
            {
              header: "Status",
              accessor: (app) => (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <StatusBadge
                    status={app.status}
                    label={statusOptions.find((o) => o.value === app.status)?.label ?? app.status}
                  />
                  <Select
                    className="h-9 max-w-full py-1 text-xs"
                    value={app.status}
                    aria-label="Update status"
                    onChange={(e) => void handleStatusChange(app.id, e.target.value)}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
              ),
            },
            {
              header: "",
              className: "w-14",
              accessor: (app) => (
                <RowActionButton
                  aria-label="Remove from tracker"
                  onClick={() => void handleDelete(app.id)}
                  className="text-[var(--error)]"
                >
                  <Trash2 className="mx-auto h-4 w-4" />
                </RowActionButton>
              ),
            },
          ]}
        />
      )}
    </div>
  );
};

export default ApplicationTrackerPage;
