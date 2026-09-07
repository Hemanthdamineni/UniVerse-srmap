/**
 * OnboardingFlow.tsx — the first-run intent + consent flow (Batch B5).
 *
 * Five steps: consent → target roles → interest areas → skills (pre-filled
 * from the student graph) → graduation year + placement intent. Skippable at
 * every step; a skip still writes a usable "skipped" row so recommendations
 * fall back to branch/semester defaults rather than dead-ending (T3.2.3).
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Plus, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../../components/dialog";
import { Chip } from "../../components/ui/Chip";
import {
  getIntent,
  putIntent,
  PLACEMENT_INTENT_OPTIONS,
  type PlacementIntent,
  type StudentConsent,
} from "../../lib/core/studentIntent";
import { getStudentGraph } from "../../lib/core/studentGraph";
import { studentGraphKeys } from "../../lib/core/queryKeys";
import { hasSessionAuth } from "../../lib/core/session";
import { isStaticPrototype } from "../../lib/core/prototype";

const ROLE_SUGGESTIONS = [
  "Software Engineer",
  "Data Scientist",
  "Product Manager",
  "ML Engineer",
  "DevOps / SRE",
  "Analyst",
  "Research",
  "Core (VLSI / Embedded)",
];
const INTEREST_SUGGESTIONS = [
  "Web",
  "Systems",
  "AI / ML",
  "Cybersecurity",
  "Cloud",
  "Robotics",
  "Finance",
  "Design",
  "Data",
];

const CONSENT_COPY: Array<{ key: keyof StudentConsent; label: string; help: string }> = [
  {
    key: "derivedSignals",
    label: "Let the app work out signals about me",
    help: "Attendance risk, skill gaps, a readiness score — computed from data you already share, shown only to you.",
  },
  {
    key: "leaderboards",
    label: "Include me in department leaderboards",
    help: "Your name and activity can appear in faculty/department rankings. Academic risk is never shown to anyone but you.",
  },
  {
    key: "publicProfile",
    label: "Let me publish a shareable career profile",
    help: "Opt-in. You choose exactly what goes on it later, from your profile page.",
  },
];

const YEAR_NOW = new Date().getFullYear();
const GRAD_YEARS = [YEAR_NOW, YEAR_NOW + 1, YEAR_NOW + 2, YEAR_NOW + 3, YEAR_NOW + 4];

const STEPS = ["Consent", "Goals", "Interests", "Skills", "Timeline"] as const;

function TagField({
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const set = new Set(value.map((v) => v.toLowerCase()));

  const add = (raw: string) => {
    const s = raw.trim();
    if (!s || set.has(s.toLowerCase())) return;
    onChange([...value, s].slice(0, 12));
    setDraft("");
  };
  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-[var(--comp-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--comp-accent-fg)]"
          >
            {tag}
            <button type="button" onClick={() => remove(tag)} aria-label={`Remove ${tag}`} className="opacity-80 hover:opacity-100">
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
      <div className="flex flex-wrap gap-2">
        {suggestions
          .filter((s) => !set.has(s.toLowerCase()))
          .map((s) => (
            <Chip key={s} onClick={() => add(s)}>
              + {s}
            </Chip>
          ))}
      </div>
    </div>
  );
}

export default function OnboardingFlow() {
  const queryClient = useQueryClient();
  // The intent endpoints need the real backend; the static prototype has none.
  const authed = hasSessionAuth() && !isStaticPrototype();

  const intentQuery = useQuery({
    queryKey: ["student-intent"],
    queryFn: getIntent,
    enabled: authed,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const graphQuery = useQuery({
    queryKey: studentGraphKeys.graph,
    queryFn: () => getStudentGraph(),
    enabled: authed,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const [dismissed, setDismissed] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState<StudentConsent>({
    derivedSignals: false,
    leaderboards: false,
    publicProfile: false,
  });
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [interestAreas, setInterestAreas] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[] | null>(null);
  const [graduationYear, setGraduationYear] = useState<number | null>(null);
  const [placementIntent, setPlacementIntent] = useState<PlacementIntent>("");

  // Seed the skills step from the graph once it lands.
  const seededSkills = useMemo(
    () => (graphQuery.data?.skills ?? []).map((s) => s.skill).slice(0, 15),
    [graphQuery.data],
  );
  const effectiveSkills = skills ?? seededSkills;

  const save = useMutation({
    mutationFn: (final: boolean) =>
      putIntent(
        final
          ? { consent, targetRoles, interestAreas, skills: effectiveSkills, graduationYear, placementIntent, status: "complete" }
          : { skipped: true },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-intent"] });
      queryClient.invalidateQueries({ queryKey: studentGraphKeys.graph });
      setDismissed(true);
      setForceOpen(false);
    },
  });

  const status = intentQuery.data?.status;
  const open = authed && !dismissed && (status === "none" || forceOpen);

  // Gentle re-prompt for students who skipped the flow (T3.2.5).
  if (!open) {
    if (authed && status === "skipped" && !bannerHidden) {
      return (
        <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-lg border border-[var(--comp-border)] bg-[color-mix(in_srgb,var(--comp-accent)_6%,transparent)] px-4 py-2.5 text-sm md:mx-6">
          <span className="text-[var(--comp-text-secondary)]">
            Tell us your goals and we'll rank opportunities and events for you.
          </span>
          <span className="flex shrink-0 gap-3">
            <button
              type="button"
              className="font-semibold text-[var(--comp-accent)]"
              onClick={() => {
                setForceOpen(true);
                setDismissed(false);
                setStep(0);
              }}
            >
              Set it up
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              className="text-[var(--comp-text-muted)] hover:text-[var(--comp-text-primary)]"
              onClick={() => setBannerHidden(true)}
            >
              <X className="h-4 w-4" />
            </button>
          </span>
        </div>
      );
    }
    return null;
  }

  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open onOpenChange={(o) => !o && save.mutate(false)}>
      <DialogContent className="max-w-lg">
        <div className="mb-4 flex items-center gap-1.5">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-[var(--comp-accent)]" : "bg-[var(--comp-border)]"}`}
              title={label}
            />
          ))}
        </div>

        <DialogTitle className="text-lg font-semibold">
          {step === 0 && "What the app may infer about you"}
          {step === 1 && "What roles are you aiming for?"}
          {step === 2 && "Which areas interest you?"}
          {step === 3 && "Confirm your skills"}
          {step === 4 && "Your timeline"}
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-[var(--comp-text-secondary)]">
          {step === 0 && "All optional. You can use every feature with all of these off, and change them any time in Settings."}
          {step === 1 && "We use this to rank opportunities and events for you. Add your own or pick from below."}
          {step === 2 && "Broad areas are fine — this steers recommendations, not filters."}
          {step === 3 && "Pulled from your resume, courses, and activity. Remove anything wrong, add what's missing."}
          {step === 4 && "So deadlines and prep suggestions land at the right time."}
        </DialogDescription>

        <div className="mt-5 min-h-[180px]">
          {step === 0 && (
            <div className="space-y-3">
              {CONSENT_COPY.map(({ key, label, help }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setConsent((c) => ({ ...c, [key]: !c[key] }))}
                  className="flex w-full items-start justify-between gap-4 rounded-lg border border-[var(--comp-border)] p-3 text-left hover:bg-[var(--comp-surface-hover)]"
                  aria-pressed={consent[key]}
                >
                  <span>
                    <span className="block text-sm font-medium text-[var(--comp-text-primary)]">{label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--comp-text-muted)]">{help}</span>
                  </span>
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      consent[key] ? "border-[var(--comp-accent)] bg-[var(--comp-accent)] text-[var(--comp-accent-fg)]" : "border-[var(--comp-border)]"
                    }`}
                  >
                    {consent[key] && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              ))}
            </div>
          )}
          {step === 1 && (
            <TagField value={targetRoles} onChange={setTargetRoles} suggestions={ROLE_SUGGESTIONS} placeholder="Add a role" />
          )}
          {step === 2 && (
            <TagField value={interestAreas} onChange={setInterestAreas} suggestions={INTEREST_SUGGESTIONS} placeholder="Add an area" />
          )}
          {step === 3 && (
            <TagField
              value={effectiveSkills}
              onChange={setSkills}
              suggestions={[]}
              placeholder="Add a skill"
            />
          )}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <label htmlFor="grad-year" className="mb-1.5 block text-sm font-medium text-[var(--comp-text-primary)]">
                  Graduation year
                </label>
                <select
                  id="grad-year"
                  value={graduationYear ?? ""}
                  onChange={(e) => setGraduationYear(e.target.value ? Number(e.target.value) : null)}
                  className="min-h-11 w-full rounded-lg border border-[var(--comp-border)] bg-[var(--comp-surface)] px-3 text-sm outline-none focus:border-[var(--comp-accent)]"
                >
                  <option value="">Select…</option>
                  {GRAD_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-[var(--comp-text-primary)]">After graduation, I'm leaning towards</legend>
                {PLACEMENT_INTENT_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2.5 rounded-lg border border-[var(--comp-border)] p-2.5 text-sm hover:bg-[var(--comp-surface-hover)]">
                    <input
                      type="radio"
                      name="placement-intent"
                      checked={placementIntent === opt.value}
                      onChange={() => setPlacementIntent(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </fieldset>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-sm text-[var(--comp-text-muted)] hover:text-[var(--comp-text-primary)]"
            onClick={() => save.mutate(false)}
          >
            Skip for now
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" className="comp-btn-ghost" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}
            <button
              type="button"
              className="comp-btn-primary"
              disabled={save.isPending}
              onClick={() => (isLast ? save.mutate(true) : setStep((s) => s + 1))}
            >
              {isLast ? "Finish" : "Next"} {isLast ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
