/**
 * ResumeProofPanel.tsx — the "Proof" card of the professional profile: résumé
 * upload, the parsed structured record (identity, education, skills, per-entry
 * experience & projects) and the prioritised improvement recommendations.
 *
 * Purely presentational — the parent owns the résumé state and the handlers.
 */
import { AlertTriangle, FileText, GraduationCap, Sparkles } from "lucide-react";
import { SectionCard } from "../../components/ui/SectionCard";
import { FileUploadZone } from "../../components/ui/FileUploadZone";
import { Button } from "../../components/button";
import type { ResumeEntry, ResumeSuggestion, ResumeVersion } from "../../lib/career/careerApi";

export interface ResumeUploadState {
  file: File | null;
  uploading: boolean;
  version: ResumeVersion | null;
  merged: boolean;
}

function normaliseSuggestions(raw: ResumeVersion["analysis"]): ResumeSuggestion[] {
  const list = raw?.suggestions ?? [];
  return list.map((s) =>
    typeof s === "string" ? { tip: s, priority: "medium" as const, category: "general" } : s,
  );
}

function entryLine(e: ResumeEntry): string {
  const org = e.org || e.subtitle;
  return [e.title, org].filter(Boolean).join(" — ");
}

export default function ResumeProofPanel({
  resume,
  onUpload,
  onMerge,
  onRemove,
  removing = false,
}: {
  resume: ResumeUploadState;
  onUpload: (file: File) => void;
  onMerge: () => void;
  onRemove: () => void;
  removing?: boolean;
}) {
  const version = resume.version;
  const parsed = version?.parsedJson;
  const suggestions = normaliseSuggestions(version?.analysis);
  const identity = [parsed?.name, parsed?.email, parsed?.phone].filter(Boolean).join(" · ");

  return (
    <SectionCard title="Proof" description="Upload a résumé to parse into structured data and get targeted feedback.">
      <div className="space-y-4">
        <FileUploadZone
          onFile={onUpload}
          accept={[".pdf", ".docx", ".txt", ".md"]}
          maxSizeMb={5}
          isUploading={resume.uploading}
          label={version ? "Replace résumé" : "Upload résumé"}
          description="Text-based PDF, DOCX, TXT or MD, up to 5 MB. Scanned or image-only PDFs can't be read."
        />

        {version && parsed && (
          <div className="rounded-xl border border-[var(--comp-border)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-[var(--comp-text-muted)]" />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--comp-text-primary)" }}>
                    {version.fileName}
                  </p>
                  <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
                    Score: {version.qualityScore}/100
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" disabled={removing} onClick={onRemove}>
                  {removing ? "Removing…" : "Remove"}
                </Button>
                <Button size="sm" disabled={resume.merged} onClick={onMerge}>
                  {resume.merged ? "Merged" : "Merge to Profile"}
                </Button>
              </div>
            </div>

            {parsed.layoutWarning === "multi-column" || parsed.layoutWarning === "no-sections" ? (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--warning)]">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {parsed.layoutWarning === "multi-column"
                  ? "This looks like a multi-column PDF — parsing may be imperfect. A single-column export reads best."
                  : "No standard section headings found — add labelled Experience / Projects / Skills / Education sections."}
              </p>
            ) : null}

            {(identity || parsed.headline) && (
              <div className="mt-3 space-y-1">
                {identity && (
                  <p className="text-xs text-[var(--comp-text-secondary)]">{identity}</p>
                )}
                {parsed.headline && (
                  <p className="text-xs italic text-[var(--comp-text-muted)]">
                    &ldquo;{parsed.headline.slice(0, 180)}
                    {parsed.headline.length > 180 ? "…" : ""}&rdquo;
                  </p>
                )}
              </div>
            )}

            {parsed.education && parsed.education.length > 0 && (
              <div className="mt-3 space-y-1">
                {parsed.education.map((ed, i) => (
                  <p
                    key={`${ed.institution}-${i}`}
                    className="flex items-center gap-1.5 text-xs text-[var(--comp-text-secondary)]"
                  >
                    <GraduationCap className="h-3.5 w-3.5 shrink-0 text-[var(--comp-text-muted)]" />
                    {[ed.degree, ed.institution].filter(Boolean).join(", ")}
                    {ed.year ? ` · ${ed.year}` : ""}
                    {ed.gpa ? ` · GPA ${ed.gpa}` : ""}
                  </p>
                ))}
              </div>
            )}

            {parsed.skills && parsed.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {parsed.skills.slice(0, 12).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--comp-accent)]"
                  >
                    {skill}
                  </span>
                ))}
                {parsed.skills.length > 12 && (
                  <span className="px-1 text-xs text-[var(--comp-text-muted)]">
                    +{parsed.skills.length - 12} more
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <EntryList label="Experience" entries={parsed.experience} />
              <EntryList label="Projects" entries={parsed.projects} />
            </div>

            {parsed.certifications && parsed.certifications.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-[var(--comp-text-secondary)]">Certifications</p>
                <ul className="mt-1 space-y-0.5">
                  {parsed.certifications.map((c) => (
                    <li key={c} className="text-xs text-[var(--comp-text-muted)]">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-[var(--comp-text-secondary)]">
                  Recommendations
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {suggestions.map((s, i) => (
                    <li
                      key={s.tip}
                      className="flex items-start gap-2 text-xs leading-relaxed text-[var(--comp-text-secondary)]"
                    >
                      <Sparkles
                        className={`mt-0.5 h-3 w-3 shrink-0 ${
                          s.priority === "high" ? "text-[var(--warning)]" : "text-[var(--comp-accent)]"
                        }`}
                      />
                      <span>
                        {i === 0 && (
                          <span className="mr-1 rounded bg-[color-mix(in_srgb,var(--comp-accent)_15%,transparent)] px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--comp-accent)]">
                            Biggest win
                          </span>
                        )}
                        {s.tip}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function EntryList({ label, entries }: { label: string; entries?: ResumeEntry[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--comp-text-secondary)]">
        {label} <span className="text-[var(--comp-text-muted)]">({entries?.length ?? 0})</span>
      </p>
      {entries && entries.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {entries.slice(0, 6).map((e, i) => (
            <li key={`${e.title}-${i}`} className="text-xs text-[var(--comp-text-muted)]">
              <span className="text-[var(--comp-text-secondary)]">{entryLine(e)}</span>
              {e.dateRange ? ` · ${e.dateRange}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs italic text-[var(--comp-text-muted)]">None detected</p>
      )}
    </div>
  );
}
