/**
 * ResumeProofPanel.tsx — the "Proof" card of the professional profile: resume
 * upload, the parsed ATS quality score, extracted skill chips, the top
 * improvement suggestions, and the projects/experience/certs tallies.
 *
 * Split out of `ProfessionalProfilePage` to keep that file readable; it is
 * purely presentational — the parent owns the resume state and the handlers.
 */
import { FileText, Sparkles } from "lucide-react";
import { SectionCard } from "../../components/ui/SectionCard";
import { FileUploadZone } from "../../components/ui/FileUploadZone";
import { Button } from "../../components/button";
import type { ResumeVersion } from "../../lib/career/careerApi";

export interface ResumeUploadState {
  file: File | null;
  uploading: boolean;
  version: ResumeVersion | null;
  merged: boolean;
}

export default function ResumeProofPanel({
  resume,
  onUpload,
  onMerge,
}: {
  resume: ResumeUploadState;
  onUpload: (file: File) => void;
  onMerge: () => void;
}) {
  const version = resume.version;
  const parsed = version?.parsedJson;

  return (
    <SectionCard title="Proof" description="Upload a resume to parse and merge structured data into your profile.">
      <div className="space-y-4">
        <FileUploadZone
          onFile={onUpload}
          accept={[".pdf", ".docx", ".txt", ".md"]}
          maxSizeMb={5}
          isUploading={resume.uploading}
          label="Upload Resume"
        />

        {version && (
          <div className="rounded-xl border border-[var(--comp-border)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-[var(--comp-text-muted)]" />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--comp-text-primary)" }}>
                    {version.fileName}
                  </p>
                  <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
                    Quality score: {version.qualityScore}/100
                  </p>
                </div>
              </div>
              <Button size="sm" disabled={resume.merged} onClick={onMerge}>
                {resume.merged ? "Merged" : "Merge to Profile"}
              </Button>
            </div>

            {parsed?.skills && parsed.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {parsed.skills.slice(0, 8).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-[color-mix(in_srgb,var(--comp-accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--comp-accent)_8%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--comp-accent)]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {version.analysis?.suggestions?.length ? (
              <ul className="mt-3 space-y-1.5">
                {version.analysis.suggestions.slice(0, 3).map((s) => (
                  <li key={s} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--comp-text-secondary)]">
                    <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[var(--comp-accent)]" />
                    {s}
                  </li>
                ))}
              </ul>
            ) : null}

            {parsed && (
              <div className="mt-3 grid grid-cols-3 gap-4 text-center">
                {(
                  [
                    ["Projects", parsed.projects?.length || 0],
                    ["Experience", parsed.experience?.length || 0],
                    ["Certs", parsed.certifications?.length || 0],
                  ] as const
                ).map(([label, count]) => (
                  <div key={label} className="rounded-lg bg-[var(--comp-surface-hover)] p-2">
                    <p className="text-lg font-bold" style={{ color: "var(--comp-text-primary)" }}>
                      {count}
                    </p>
                    <p className="text-xs" style={{ color: "var(--comp-text-muted)" }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
