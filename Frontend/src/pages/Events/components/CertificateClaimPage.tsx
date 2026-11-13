import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ErrorMessage } from "../../../components/competition/ErrorMessage";
import { EmptyState } from "../../../components/competition/CompetitionEmptyState";
import { SkeletonCard } from "../../../components/ui/Skeletons";
import {
  downloadMyCertificate,
  getCertificateTemplate,
  type CertificateTemplate,
} from "../../../lib/events/competitionsApi";
import { track } from "../../../lib/core/analytics";
import { getCurrentRegNo } from "../../../lib/core/identity";
import { useEvent } from "../../../contexts/EventContext";
import { PageStack, runStep } from "./PageStack";

export function CertificateClaimPage() {
  const { roundId = "" } = useParams();
  const { event, config } = useEvent();
  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const currentRegNo = getCurrentRegNo();
  const round = config?.rounds.find((item) => item.roundId === roundId);

  useEffect(() => {
    if (!event) return;
    setLoading(true);
    getCertificateTemplate(event.id, roundId)
      .then(setTemplate)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load certificate."))
      .finally(() => setLoading(false));
  }, [event, roundId]);

  async function onDownload() {
    if (!event) return;
    await runStep(setProcessing, setError, async () => {
      const blob = await downloadMyCertificate(event.id, roundId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${event.title ?? "certificate"}-${roundId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      track("certificate_downloaded", { eventId: event.id, roundId });
    }, "Certificate download failed.");
  }

  return (
    <PageStack>
      <div className="dashboard-card rounded-xl p-4">
        <p className="comp-heading-lg mt-0">Your Certificate is Ready</p>
        <p className="comp-body">{event?.title ?? "Event"} - {round?.title ?? "Round"}</p>
        {error ? <ErrorMessage message={error} onRetry={() => setError("")} preservedInput /> : null}
        {loading ? <SkeletonCard /> : (
          <div style={{ position: "relative", minHeight: 260, border: "1px solid var(--comp-border)", borderRadius: 10, overflow: "hidden", background: "var(--comp-surface-hover)" }}>
            {template?.templateImagePath ? <img src={template.templateImagePath} alt="Certificate template" style={{ width: "100%", display: "block" }} /> : null}
            {(template?.fields ?? []).map((field) => (
              <span key={field.key} style={{ position: "absolute", left: `${field.x}%`, top: `${field.y}%`, transform: field.align === "center" ? "translateX(-50%)" : field.align === "right" ? "translateX(-100%)" : undefined, fontSize: field.fontSize, fontWeight: field.fontWeight, color: field.color }}>
                {field.key === "participantName" ? currentRegNo : field.key === "eventName" ? event?.title : field.label}
              </span>
            ))}
            {!template ? <EmptyState title="No template configured" description="The organizer has not configured a certificate template yet." /> : null}
          </div>
        )}
        <button className="comp-btn-primary mt-4" disabled={processing || !template} onClick={() => void onDownload()}>
          {processing ? "Generating..." : "Download Certificate"}
        </button>
      </div>
    </PageStack>
  );
}