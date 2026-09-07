/**
 * CareerIntentSettings.tsx — edit onboarding intent + consent after the fact,
 * and see / delete everything the platform has inferred (Batch B5, T3.2.4 +
 * T3.3.2 + T3.3.3). Rendered inside the Settings page.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { SectionCard } from "../../components/erp/ErpPrimitives";
import {
  getIntent,
  putIntent,
  getProvenance,
  deleteDerivedData,
  PLACEMENT_INTENT_OPTIONS,
  type IntentRecord,
  type StudentConsent,
  type PlacementIntent,
} from "../../lib/core/studentIntent";
import { studentGraphKeys } from "../../lib/core/queryKeys";
import { isStaticPrototype } from "../../lib/core/prototype";
import { hasSessionAuth } from "../../lib/core/session";

const YEAR_NOW = new Date().getFullYear();
const GRAD_YEARS = [YEAR_NOW, YEAR_NOW + 1, YEAR_NOW + 2, YEAR_NOW + 3, YEAR_NOW + 4];

const CONSENT_LABELS: Record<keyof StudentConsent, string> = {
  derivedSignals: "Let the app compute signals about me (risk, gaps, readiness)",
  leaderboards: "Include me in department leaderboards",
  publicProfile: "Allow me to publish a shareable career profile",
};

function TagRow({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const s = raw.trim();
    if (!s || value.some((v) => v.toLowerCase() === s.toLowerCase())) return;
    onChange([...value, s].slice(0, 12));
    setDraft("");
  };
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-[var(--comp-text-primary)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--comp-accent-fg)]">
            {tag}
            <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`} className="opacity-80 hover:opacity-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--comp-border)] px-3 py-1.5">
          <input
            className="w-28 bg-transparent text-xs outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
            placeholder={placeholder}
          />
          <button type="button" onClick={() => add(draft)} aria-label="Add" className="text-[var(--comp-text-muted)] hover:text-[var(--comp-accent)]">
            <Plus className="h-3 w-3" />
          </button>
        </span>
      </div>
    </div>
  );
}

export default function CareerIntentSettings() {
  const queryClient = useQueryClient();
  const enabled = hasSessionAuth() && !isStaticPrototype();

  const intentQuery = useQuery({ queryKey: ["student-intent"], queryFn: getIntent, enabled, retry: 1 });

  const [draft, setDraft] = useState<IntentRecord | null>(null);
  const [status, setStatus] = useState("");
  const [showProvenance, setShowProvenance] = useState(false);

  useEffect(() => {
    if (intentQuery.data && !draft) setDraft(intentQuery.data);
  }, [intentQuery.data, draft]);

  const provenanceQuery = useQuery({
    queryKey: ["student-provenance"],
    queryFn: getProvenance,
    enabled: enabled && showProvenance,
    retry: 1,
  });

  const save = useMutation({
    mutationFn: () =>
      putIntent({
        targetRoles: draft?.targetRoles ?? [],
        interestAreas: draft?.interestAreas ?? [],
        skills: draft?.skills ?? [],
        graduationYear: draft?.graduationYear ?? null,
        placementIntent: draft?.placementIntent ?? "",
        consent: draft?.consent,
        status: "complete",
      }),
    onSuccess: (saved) => {
      setDraft(saved);
      setStatus("Saved.");
      queryClient.invalidateQueries({ queryKey: ["student-intent"] });
      queryClient.invalidateQueries({ queryKey: studentGraphKeys.graph });
    },
    onError: () => setStatus("Couldn't save — try again."),
  });

  const wipe = useMutation({
    mutationFn: deleteDerivedData,
    onSuccess: (res) => {
      setDraft(res.intent);
      setStatus("Cleared. The platform no longer holds your declared goals or the signals derived from them.");
      queryClient.invalidateQueries({ queryKey: ["student-intent"] });
      queryClient.invalidateQueries({ queryKey: ["student-provenance"] });
      queryClient.invalidateQueries({ queryKey: studentGraphKeys.graph });
    },
  });

  const grouped = useMemo(() => {
    const rows = provenanceQuery.data?.rows ?? [];
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return [...map.entries()];
  }, [provenanceQuery.data]);

  if (!enabled) {
    return (
      <SectionCard title="Career intent">
        <p className="comp-body text-sm">Sign in to the live app to set your goals and control what the platform infers.</p>
      </SectionCard>
    );
  }

  if (!draft) {
    return (
      <SectionCard title="Career intent">
        <p className="comp-body text-sm">Loading…</p>
      </SectionCard>
    );
  }

  const set = <K extends keyof IntentRecord>(key: K, value: IntentRecord[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setStatus("");
  };

  return (
    <>
      <SectionCard title="Career intent">
        <p className="comp-body mb-4 text-sm">Sharpens the opportunities, events, and prep the app surfaces for you.</p>
        <div className="flex flex-col gap-5">
          <TagRow label="Target roles" value={draft.targetRoles} onChange={(v) => set("targetRoles", v)} placeholder="Add a role" />
          <TagRow label="Interest areas" value={draft.interestAreas} onChange={(v) => set("interestAreas", v)} placeholder="Add an area" />
          <TagRow label="Skills" value={draft.skills} onChange={(v) => set("skills", v)} placeholder="Add a skill" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="intent-grad-year" className="mb-1.5 block text-sm font-medium text-[var(--comp-text-primary)]">
                Graduation year
              </label>
              <select
                id="intent-grad-year"
                value={draft.graduationYear ?? ""}
                onChange={(e) => set("graduationYear", e.target.value ? Number(e.target.value) : null)}
                className="min-h-11 w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              >
                <option value="">Not set</option>
                {GRAD_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="intent-placement" className="mb-1.5 block text-sm font-medium text-[var(--comp-text-primary)]">
                After graduation
              </label>
              <select
                id="intent-placement"
                value={draft.placementIntent}
                onChange={(e) => set("placementIntent", e.target.value as PlacementIntent)}
                className="min-h-11 w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 text-sm outline-none focus:border-[var(--comp-accent)]"
              >
                <option value="">Not set</option>
                {PLACEMENT_INTENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="What the platform may infer">
        <p className="comp-body mb-3 text-sm">All off by default. Turning these off never removes a feature you use.</p>
        <div className="flex flex-col">
          {(Object.keys(CONSENT_LABELS) as Array<keyof StudentConsent>).map((key) => (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={draft.consent[key]}
              onClick={() => set("consent", { ...draft.consent, [key]: !draft.consent[key] })}
              className="flex min-h-11 w-full items-center justify-between gap-4 border-b border-[var(--comp-border)] py-2 text-left last:border-0 hover:bg-[var(--comp-surface-hover)]"
            >
              <span className="text-sm text-[var(--comp-text-primary)]">{CONSENT_LABELS[key]}</span>
              <span
                aria-hidden
                className={`relative h-[22px] w-10 shrink-0 rounded-full transition-colors ${draft.consent[key] ? "bg-[var(--comp-accent)]" : "bg-[var(--comp-border)]"}`}
              >
                <span
                  className="absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-[var(--background)] shadow-sm transition-transform"
                  style={{ transform: draft.consent[key] ? "translateX(18px)" : "translateX(0)" }}
                />
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--comp-accent)]"
          onClick={() => setShowProvenance((v) => !v)}
        >
          {showProvenance ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          What we know about you
        </button>
        {showProvenance && (
          <div className="mt-3 space-y-4">
            {provenanceQuery.isPending && <p className="text-sm text-[var(--comp-text-muted)]">Loading…</p>}
            {grouped.map(([category, rows]) => (
              <div key={category}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--comp-text-muted)]">{category}</p>
                <ul className="space-y-1">
                  {rows.map((r, i) => (
                    <li key={`${r.label}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                      <span className="text-[var(--comp-text-primary)]">
                        {r.label}: <span className="font-medium">{String(r.value)}</span>
                      </span>
                      <span className="text-xs text-[var(--comp-text-muted)]">{r.source}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {provenanceQuery.data && grouped.length === 0 && (
              <p className="text-sm text-[var(--comp-text-muted)]">Nothing derived yet.</p>
            )}
          </div>
        )}
      </SectionCard>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--status-live-text)]"
          onClick={() => wipe.mutate()}
          disabled={wipe.isPending}
        >
          <Trash2 className="h-4 w-4" /> Delete what the platform inferred
        </button>
        <div className="flex items-center gap-3">
          <p aria-live="polite" className="text-sm text-[var(--comp-text-muted)]">{status}</p>
          <button type="button" className="comp-btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save intent"}
          </button>
        </div>
      </div>
    </>
  );
}
