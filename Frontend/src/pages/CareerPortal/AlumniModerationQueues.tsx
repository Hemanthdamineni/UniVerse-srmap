/**
 * AlumniModerationQueues — admin-facing half of the alumni networking loop:
 * the "Pending Nominations" and "Pending Connection Requests" review queues.
 * Rendered inside AlumniConnect.tsx only when adminMode && admin.unlocked.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { EmptyStateCard, SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import { careerKeys } from "../../lib/career/queryKeys";
import {
  listPendingAlumniConnectionRequests,
  listPendingAlumniNominations,
  reviewAlumniConnectionRequest,
  reviewAlumniNomination,
  type AlumniConnectionRequestAdmin,
  type AlumniNomination,
} from "../../lib/career/careerApi";

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs outline-none focus:border-[var(--comp-accent)]";

export default function AlumniModerationQueues({ adminHeaders }: { adminHeaders?: HeadersInit }) {
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [nominationReasons, setNominationReasons] = useState<Record<string, string>>({});
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});

  /* eslint-disable @tanstack/query/exhaustive-deps -- the raw headers object deliberately stays out of the key, same as AlumniConnect.tsx's alumniQuery */
  const nominationsQuery = useQuery({
    queryKey: careerKeys.alumniNominationsPending,
    queryFn: () => listPendingAlumniNominations(adminHeaders),
    staleTime: 15_000,
  });
  const requestsQuery = useQuery({
    queryKey: careerKeys.alumniRequestsPending,
    queryFn: () => listPendingAlumniConnectionRequests(adminHeaders),
    staleTime: 15_000,
  });
  /* eslint-enable @tanstack/query/exhaustive-deps */

  const nominations = nominationsQuery.data?.items ?? [];
  const requests = requestsQuery.data?.items ?? [];

  const reviewNomination = useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: "approve" | "reject"; reason: string }) =>
      reviewAlumniNomination(id, { decision, reason }, adminHeaders),
    onSuccess: (_result, variables) => {
      setBanner({
        tone: "success",
        text: variables.decision === "approve" ? "Nomination approved and added to the directory." : "Nomination rejected.",
      });
      setNominationReasons((prev) => ({ ...prev, [variables.id]: "" }));
      void queryClient.invalidateQueries({ queryKey: careerKeys.alumniNominationsPending });
      void queryClient.invalidateQueries({ queryKey: careerKeys.alumni() });
    },
    onError: (err) => setBanner({ tone: "warning", text: err instanceof Error ? err.message : "Review failed." }),
  });

  const reviewRequest = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: "accept" | "decline"; note: string }) =>
      reviewAlumniConnectionRequest(id, { decision, note }, adminHeaders),
    onSuccess: (_result, variables) => {
      setBanner({
        tone: "success",
        text: variables.decision === "accept" ? "Connection request accepted." : "Connection request declined.",
      });
      setRequestNotes((prev) => ({ ...prev, [variables.id]: "" }));
      void queryClient.invalidateQueries({ queryKey: careerKeys.alumniRequestsPending });
    },
    onError: (err) => setBanner({ tone: "warning", text: err instanceof Error ? err.message : "Review failed." }),
  });

  function decideNomination(item: AlumniNomination, decision: "approve" | "reject") {
    const reason = nominationReasons[item.id]?.trim();
    if (!reason || reason.length < 3) {
      setBanner({ tone: "warning", text: "A short reason is required before approving or rejecting a nomination." });
      return;
    }
    void reviewNomination.mutate({ id: item.id, decision, reason });
  }

  function decideRequest(item: AlumniConnectionRequestAdmin, decision: "accept" | "decline") {
    void reviewRequest.mutate({ id: item.id, decision, note: requestNotes[item.id]?.trim() || "" });
  }

  return (
    <>
      {banner ? <StatusBanner message={{ id: "alumni-moderation-banner", tone: banner.tone, text: banner.text }} /> : null}

      <SectionCard title={`Pending Nominations${nominations.length ? ` (${nominations.length})` : ""}`}>
        {nominations.length === 0 ? (
          <EmptyStateCard message="No pending alumni suggestions." />
        ) : (
          <div className="space-y-3">
            {nominations.map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--comp-border)] p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--comp-text-primary)]">{item.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {[item.degree, item.batch && `Batch ${item.batch}`].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {[item.role, item.company].filter(Boolean).join(" at ")}
                    </p>
                  </div>
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-2 py-1 text-[11px] font-semibold text-[var(--comp-text-secondary)]">
                    Suggested by {item.submitterName}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--comp-accent)]">
                  {item.email ? <span>{item.email}</span> : null}
                  {item.linkedinUrl ? (
                    <a href={item.linkedinUrl} target="_blank" rel="noreferrer noopener" className="underline">
                      LinkedIn
                    </a>
                  ) : null}
                  {item.instagramUrl ? (
                    <a href={item.instagramUrl} target="_blank" rel="noreferrer noopener" className="underline">
                      Instagram
                    </a>
                  ) : null}
                  {item.portfolioUrl ? (
                    <a href={item.portfolioUrl} target="_blank" rel="noreferrer noopener" className="underline">
                      Portfolio
                    </a>
                  ) : null}
                </div>
                {item.relation ? (
                  <p className="mt-2 text-xs italic text-[var(--comp-text-muted)]">"{item.relation}"</p>
                ) : null}
                {item.note ? <p className="mt-1 text-xs text-[var(--comp-text-muted)]">{item.note}</p> : null}
                <textarea
                  value={nominationReasons[item.id] || ""}
                  onChange={(event) =>
                    setNominationReasons((prev) => ({ ...prev, [item.id]: event.target.value }))
                  }
                  placeholder="Reason for your decision (required)"
                  rows={2}
                  className={`mt-3 ${TEXTAREA_CLASS}`}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={reviewNomination.isPending}
                    onClick={() => decideNomination(item, "approve")}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--success)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={reviewNomination.isPending}
                    onClick={() => decideNomination(item, "reject")}
                    className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)] disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={`Pending Connection Requests${requests.length ? ` (${requests.length})` : ""}`}>
        {requests.length === 0 ? (
          <EmptyStateCard message="No pending connection requests." />
        ) : (
          <div className="space-y-3">
            {requests.map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--comp-border)] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--comp-text-primary)]">
                    {item.requesterName} <span className="font-normal text-[var(--text-secondary)]">wants to connect with</span> {item.alumniName}
                  </p>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{item.alumniCompany}</p>
                {item.message ? (
                  <p className="mt-2 text-xs italic text-[var(--comp-text-muted)]">"{item.message}"</p>
                ) : null}
                <textarea
                  value={requestNotes[item.id] || ""}
                  onChange={(event) => setRequestNotes((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  placeholder="Note for the student (optional)"
                  rows={2}
                  className={`mt-3 ${TEXTAREA_CLASS}`}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={reviewRequest.isPending}
                    onClick={() => decideRequest(item, "accept")}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--success)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> Accept
                  </button>
                  <button
                    type="button"
                    disabled={reviewRequest.isPending}
                    onClick={() => decideRequest(item, "decline")}
                    className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--error)_30%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--error)] transition hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)] disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Decline
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}
