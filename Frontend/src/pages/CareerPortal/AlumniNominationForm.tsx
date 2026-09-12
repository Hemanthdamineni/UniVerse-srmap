/**
 * AlumniNominationForm — student-facing half of the alumni networking loop:
 * a collapsible "suggest an alumnus" form plus the student's own nomination
 * and connection-request status history. Rendered inside AlumniConnect.tsx
 * for the non-admin view.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, UserPlus } from "lucide-react";
import { SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import { careerKeys } from "../../lib/career/queryKeys";
import {
  listMyAlumniNominations,
  listSentAlumniRequests,
  nominateAlumnus,
  type AlumniNomination,
} from "../../lib/career/careerApi";

const INPUT_CLASS =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)]";

const FORM_INIT = {
  name: "",
  email: "",
  batch: "",
  degree: "",
  company: "",
  role: "",
  location: "",
  linkedinUrl: "",
  instagramUrl: "",
  portfolioUrl: "",
  relation: "",
  note: "",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]",
  approved: "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]",
  accepted: "bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]",
  rejected: "bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-[var(--error)]",
  declined: "bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-[var(--error)]",
};

export default function AlumniNominationForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(FORM_INIT);
  const [error, setError] = useState<string | null>(null);

  const nominationsQuery = useQuery({
    queryKey: careerKeys.alumniNominationsMine,
    queryFn: listMyAlumniNominations,
    staleTime: 30_000,
  });
  const requestsQuery = useQuery({
    queryKey: careerKeys.alumniRequestsSent,
    queryFn: listSentAlumniRequests,
    staleTime: 30_000,
  });

  const nominations = nominationsQuery.data?.items ?? [];
  const sentRequests = requestsQuery.data?.items ?? [];

  const nominate = useMutation({
    mutationFn: (payload: Partial<AlumniNomination>) => nominateAlumnus(payload),
    onSuccess: () => {
      setForm(FORM_INIT);
      setError(null);
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: careerKeys.alumniNominationsMine });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not submit suggestion."),
  });

  if (nominations.length === 0 && sentRequests.length === 0 && !open) {
    return (
      <SectionCard title="Know an alumnus we're missing?">
        <div id="alumni-nomination-form" className="flex flex-wrap items-center justify-between gap-3 scroll-mt-24">
          <p className="body-text text-sm">
            Suggest them and an admin will review and add them to the directory.
          </p>
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--comp-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)]"
          >
            <UserPlus className="h-4 w-4" /> Suggest an alumnus
          </button>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Know an alumnus we're missing?">
      <button
        type="button"
        id="alumni-nomination-form"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between gap-2 text-left scroll-mt-24"
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--comp-accent)]">
          <UserPlus className="h-4 w-4" /> Suggest an alumnus
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-[var(--comp-text-muted)]" /> : <ChevronDown className="h-4 w-4 text-[var(--comp-text-muted)]" />}
      </button>

      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            void nominate.mutate({
              name: form.name.trim(),
              email: form.email.trim(),
              batch: form.batch.trim(),
              degree: form.degree.trim(),
              company: form.company.trim(),
              role: form.role.trim(),
              location: form.location.trim(),
              linkedinUrl: form.linkedinUrl.trim(),
              instagramUrl: form.instagramUrl.trim(),
              portfolioUrl: form.portfolioUrl.trim(),
              relation: form.relation.trim(),
              note: form.note.trim(),
            });
          }}
          className="mt-4 grid gap-3 md:grid-cols-2"
        >
          {error ? (
            <div className="md:col-span-2">
              <StatusBanner message={{ id: "nomination-error", tone: "warning", text: error }} />
            </div>
          ) : null}
          <div>
            <label htmlFor="nom-name" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Name *</label>
            <input
              id="nom-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="nom-batch" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Batch</label>
            <input
              id="nom-batch"
              value={form.batch}
              onChange={(event) => setForm((prev) => ({ ...prev, batch: event.target.value }))}
              placeholder="2019"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="nom-degree" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Degree</label>
            <input
              id="nom-degree"
              value={form.degree}
              onChange={(event) => setForm((prev) => ({ ...prev, degree: event.target.value }))}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="nom-company" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Company</label>
            <input
              id="nom-company"
              value={form.company}
              onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="nom-role" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Role</label>
            <input
              id="nom-role"
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="nom-location" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Location</label>
            <input
              id="nom-location"
              value={form.location}
              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="nom-email" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Email</label>
            <input
              id="nom-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Optional if LinkedIn is provided"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="nom-linkedin" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">LinkedIn</label>
            <input
              id="nom-linkedin"
              type="url"
              value={form.linkedinUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, linkedinUrl: event.target.value }))}
              placeholder="https://linkedin.com/in/..."
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="nom-instagram" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Instagram</label>
            <input
              id="nom-instagram"
              type="url"
              value={form.instagramUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, instagramUrl: event.target.value }))}
              placeholder="https://instagram.com/..."
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="nom-portfolio" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Portfolio / other link</label>
            <input
              id="nom-portfolio"
              type="url"
              value={form.portfolioUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, portfolioUrl: event.target.value }))}
              placeholder="https://..."
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="nom-relation" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">How do you know them?</label>
            <input
              id="nom-relation"
              value={form.relation}
              onChange={(event) => setForm((prev) => ({ ...prev, relation: event.target.value }))}
              placeholder="e.g. Mentored me during a hackathon, senior from my hostel..."
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="nom-note" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Note for the admin (optional)</label>
            <textarea
              id="nom-note"
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              rows={2}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={nominate.isPending}
              className="rounded-full bg-[var(--comp-accent)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--comp-accent-hover)] disabled:opacity-50"
            >
              {nominate.isPending ? "Submitting…" : "Submit suggestion"}
            </button>
          </div>
        </form>
      ) : null}

      {nominations.length > 0 ? (
        <div className="mt-5 space-y-2 border-t border-[var(--comp-border)] pt-4">
          <p className="text-xs font-semibold text-[var(--comp-text-secondary)]">Your suggestions</p>
          {nominations.slice(0, 5).map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--comp-border)] p-2.5">
              <div>
                <p className="text-sm font-medium text-[var(--comp-text-primary)]">{item.name}</p>
                {item.status === "rejected" && item.reviewReason ? (
                  <p className="text-xs text-[var(--text-secondary)]">Reason: {item.reviewReason}</p>
                ) : null}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[item.status]}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {sentRequests.length > 0 ? (
        <div className="mt-5 space-y-2 border-t border-[var(--comp-border)] pt-4">
          <p className="text-xs font-semibold text-[var(--comp-text-secondary)]">Your connection requests</p>
          {sentRequests.slice(0, 5).map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--comp-border)] p-2.5">
              <div>
                <p className="text-sm font-medium text-[var(--comp-text-primary)]">{item.alumniName}</p>
                {item.status !== "pending" && item.reviewNote ? (
                  <p className="text-xs text-[var(--text-secondary)]">{item.reviewNote}</p>
                ) : null}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[item.status]}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </SectionCard>
  );
}
