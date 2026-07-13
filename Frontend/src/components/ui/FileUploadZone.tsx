import { Upload, FileCheck2, Loader2, AlertCircle } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "../../lib/core/utils";

type CurrentFile = {
  name: string;
  size: number;
  uploadedAt?: string;
};

type FileUploadZoneProps = {
  onFile: (file: File) => void;
  accept: string[];
  maxSizeMb: number;
  currentFile?: CurrentFile;
  error?: string;
  isUploading?: boolean;
  label?: string;
  description?: string;
  className?: string;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function FileUploadZone({
  onFile,
  accept,
  maxSizeMb,
  currentFile,
  error,
  isUploading = false,
  label = "Choose a file",
  description,
  className,
}: FileUploadZoneProps) {
  const inputId = useId();
  const [localError, setLocalError] = useState<string | null>(null);
  const acceptValue = accept.join(",");
  const shownError = error || localError;

  function handleFile(file: File | undefined) {
    if (!file) return;
    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setLocalError(`File must be ${maxSizeMb} MB or smaller.`);
      return;
    }
    setLocalError(null);
    onFile(file);
  }

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--comp-border)] bg-[var(--comp-surface)] p-5 text-center transition hover:border-[var(--comp-accent)] hover:bg-[color-mix(in_srgb,var(--comp-accent)_5%,transparent)]",
        shownError && "border-[var(--error)] bg-[color-mix(in_srgb,var(--error)_7%,transparent)]",
        isUploading && "cursor-wait opacity-80",
        className
      )}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        handleFile(event.dataTransfer.files?.[0]);
      }}
    >
      <input
        id={inputId}
        type="file"
        accept={acceptValue}
        className="sr-only"
        disabled={isUploading}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_10%,transparent)] text-[var(--comp-accent)]">
        {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : currentFile ? <FileCheck2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
      </span>
      <span className="text-sm font-semibold text-[var(--comp-text-primary)]">{currentFile?.name || label}</span>
      <span className="max-w-md text-xs text-[var(--comp-text-muted)]">
        {currentFile ? `${formatBytes(currentFile.size)} uploaded` : description || `Accepted: ${accept.join(", ")}. Max ${maxSizeMb} MB.`}
      </span>
      {shownError ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--error)]">
          <AlertCircle className="h-3.5 w-3.5" />
          {shownError}
        </span>
      ) : null}
    </label>
  );
}
