import { useEffect, useState, useMemo } from "react";
import { ErpPageShell, SectionCard, KpiGrid, StatusBanner } from "../../components/erp/ErpPrimitives";
import { InlineError, EmptyState } from "../../components/ui/Feedback";
import { getEndSemesterFeedbackStatus, type FeedbackStatusResponse } from "../../lib/campus/studentToolsApi";
import { getMyCampusFeedback, type CampusFeedbackEntry } from "../../lib/campus/campusApi";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertCircle, FileText, Bus, Shield, ClipboardList } from "lucide-react";

export default function FeedbackDashboard() {
  const [erpStatus, setErpStatus] = useState<FeedbackStatusResponse | null>(null);
  const [campusItems, setCampusItems] = useState<CampusFeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      getEndSemesterFeedbackStatus(),
      getMyCampusFeedback("events").catch(() => ({ items: [] })),
      getMyCampusFeedback("hostel_mess").catch(() => ({ items: [] })),
      getMyCampusFeedback("transport").catch(() => ({ items: [] })),
    ])
      .then((results) => {
        if (!active) return;
        const [erpRes, eventsRes, hostelRes, transportRes] = results;

        if (erpRes.status === "fulfilled") {
          setErpStatus(erpRes.value);
        }

        const items: CampusFeedbackEntry[] = [];
        if (eventsRes.status === "fulfilled" && eventsRes.value) {
          items.push(...eventsRes.value.items);
        }
        if (hostelRes.status === "fulfilled" && hostelRes.value) {
          items.push(...hostelRes.value.items);
        }
        if (transportRes.status === "fulfilled" && transportRes.value) {
          items.push(...transportRes.value.items);
        }

        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCampusItems(items);
        setLoading(false);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load feedback dashboard");
          setLoading(false);
        }
      });

    return () => { active = false; };
  }, [refreshTrigger]);

  const kpis = useMemo(() => {
    const totalPendingErp = erpStatus?.totalPending ?? 0;
    const campusCount = campusItems.length;
    const approvedCount = campusItems.filter(item => item.status === "approved").length;
    const pendingCount = campusItems.filter(item => item.status === "pending").length;

    return [
      { label: "ERP Feedback Pending", value: String(totalPendingErp) },
      { label: "Campus Feedbacks", value: String(campusCount) },
      { label: "Approved Submissions", value: String(approvedCount) },
      { label: "Pending Moderation", value: String(pendingCount) },
    ];
  }, [erpStatus, campusItems]);

  return (
    <ErpPageShell
      title="Feedback Dashboard"
      source="Internal API"
      isLoading={loading}
      onRefresh={() => setRefreshTrigger(prev => prev + 1)}
    >
      {error && <InlineError message={error} onRetry={() => setRefreshTrigger(prev => prev + 1)} />}

      {!loading && !error && (
        <div className="space-y-6">
          <KpiGrid items={kpis} />

          <SectionCard title="Official ERP Course Feedback">
            {erpStatus?.enabled ? (
              <div className="space-y-4">
                <StatusBanner
                  message={{
                    id: "official-pending",
                    tone: (erpStatus.totalPending || 0) > 0 ? "warning" : "success",
                    text: (erpStatus.totalPending || 0) > 0
                      ? `You have ${erpStatus.totalPending} pending course feedback submissions for this semester cycle.`
                      : "Awesome! All course feedback forms for this cycle have been completed.",
                  }}
                />
                {erpStatus.totalPending > 0 ? (
                  <div className="flex justify-between items-center rounded-xl border border-[var(--comp-border)] p-4">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--comp-text-primary)" }}>Feedback Assistant</p>
                      <p className="text-xs text-[var(--comp-text-muted)]">Submit comment templates in bulk for your pending subjects.</p>
                    </div>
                    <Link to="/feedback/course-feedback">
                      <button className="comp-btn-primary">Open Assistant</button>
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="ERP feedback cycle closed"
                description="End-semester student course feedback is not currently active."
              />
            )}
          </SectionCard>

          <SectionCard title="Common Campus Feedback">
            <div className="grid gap-4 sm:grid-cols-3">
              <Link to="/feedback/events-feedback" className="flex flex-col items-center justify-center p-4 rounded-xl border border-[var(--comp-border)] hover:bg-[var(--comp-surface-hover)] transition group">
                <FileText className="h-8 w-8 text-[var(--comp-text-muted)] group-hover:text-[var(--comp-accent)] mb-2" />
                <span className="font-medium text-sm text-[var(--comp-text-primary)]">Events Feedback</span>
              </Link>
              <Link to="/feedback/hostel-mess-feedback" className="flex flex-col items-center justify-center p-4 rounded-xl border border-[var(--comp-border)] hover:bg-[var(--comp-surface-hover)] transition group">
                <ClipboardList className="h-8 w-8 text-[var(--comp-text-muted)] group-hover:text-[var(--comp-accent)] mb-2" />
                <span className="font-medium text-sm text-[var(--comp-text-primary)]">Hostel & Mess</span>
              </Link>
              <Link to="/feedback/transport-feedback" className="flex flex-col items-center justify-center p-4 rounded-xl border border-[var(--comp-border)] hover:bg-[var(--comp-surface-hover)] transition group">
                <Bus className="h-8 w-8 text-[var(--comp-text-muted)] group-hover:text-[var(--comp-accent)] mb-2" />
                <span className="font-medium text-sm text-[var(--comp-text-primary)]">Transport Feedback</span>
              </Link>
            </div>
          </SectionCard>

          <SectionCard title="My Submissions Status">
            {campusItems.length === 0 ? (
              <EmptyState
                title="No campus feedback submitted yet"
                description="Go to any campus feedback module and share your views. Your submissions and moderation details will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-[var(--comp-border)]">
                      <th className="pb-2 font-medium text-[var(--comp-text-muted)]">Type</th>
                      <th className="pb-2 font-medium text-[var(--comp-text-muted)]">Target</th>
                      <th className="pb-2 font-medium text-[var(--comp-text-muted)]">Comment</th>
                      <th className="pb-2 font-medium text-[var(--comp-text-muted)]">Status</th>
                      <th className="pb-2 font-medium text-[var(--comp-text-muted)]">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campusItems.map((item) => (
                      <tr key={item.id} className="border-b border-[var(--comp-border)]">
                        <td className="py-3 font-semibold">{item.typeLabel}</td>
                        <td className="py-3">{item.targetLabel}</td>
                        <td className="py-3 max-w-xs truncate" title={item.comment}>{item.comment || "—"}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.status === "approved"
                              ? "bg-green-100 text-green-700"
                              : item.status === "rejected"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 text-[var(--comp-text-muted)]">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </ErpPageShell>
  );
}
