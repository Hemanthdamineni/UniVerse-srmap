// Competition submissions list: Breadcrumb + InlineError; fetch getCompetitionSubmissions unchanged.
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SectionCard } from "../../components/erp/ErpPrimitives";
import { CompetitionPageShell } from "../../components/competition/CompetitionChrome";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { InlineError } from "../../components/ui/Feedback";
import { getCompetitionSubmissions } from "../../lib/campus/campusApi";

export default function SubmissionListPage() {
  const { eventId = "", roundId = "" } = useParams();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getCompetitionSubmissions(eventId, roundId);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load submissions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId, roundId]);

  const summary = useMemo(() => {
    const total = rows.length;
    const evaluated = rows.filter((row) => typeof row.totalScore === "number").length;
    const pending = total - evaluated;
    const flagged = rows.filter((row) => row.flagged).length;
    const teamRows = rows.filter((row) => row.teamId).length;
    return { total, evaluated, pending, flagged, teamRows };
  }, [rows]);

  return (
    <CompetitionPageShell
      eyebrow="Submissions"
      title="Submission Review Queue"
      subtitle="Review active submissions and route entries into evaluation."
      variant="wide"
    >
      <Breadcrumb
        className="mb-4"
        items={[
          { label: "Manage", href: `/events/${encodeURIComponent(eventId)}/manage` },
          { label: "Submissions" },
        ]}
      />
      {error ? (
        <InlineError
          message={error}
          onRetry={() => {
            setLoading(true);
            setError("");
            void getCompetitionSubmissions(eventId, roundId)
              .then(setRows)
              .catch((err) => setError(err instanceof Error ? err.message : "Failed to load submissions."))
              .finally(() => setLoading(false));
          }}
        />
      ) : null}
      <SectionCard title="Summary">
        <p className="text-sm">
          {summary.total} submissions total | {summary.evaluated} evaluated | {summary.pending} pending | {summary.flagged} flagged
          {summary.teamRows > 0 ? ` | ${summary.teamRows} team entries` : ""}
        </p>
      </SectionCard>
      <SectionCard title="Submission List">
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between rounded-xl border border-[var(--border)] p-3 text-sm">
              <div>
                <p className="font-semibold">{row.teamName || row.submittedBy}</p>
                {row.teamId ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Leader: {row.teamLeaderId || "N/A"} | Members: {Array.isArray(row.teamMembers) ? row.teamMembers.length : row.memberCount || 0}
                  </p>
                ) : null}
                <p className="text-[var(--text-secondary)]">{new Date(row.submittedAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span>{row.type}</span>
                <span>{typeof row.totalScore === "number" ? `Score ${row.totalScore}` : "Pending"}</span>
                <Link
                  to={`/events/${encodeURIComponent(eventId)}/manage/rounds/${encodeURIComponent(roundId)}/submissions/${encodeURIComponent(row.id)}/evaluate`}
                  className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_20%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--comp-text-primary)]"
                >
                  Evaluate
                </Link>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </CompetitionPageShell>
  );
}
