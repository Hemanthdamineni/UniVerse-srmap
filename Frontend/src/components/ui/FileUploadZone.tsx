import React, { useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { UploadCloud, File as FileIcon, X } from "lucide-react";

export interface UploadedFileDescriptor {
  name: string;
  size: number;
  uploadedAt: string;
}

export interface FileUploadZoneProps {
  className?: string;
  accept?: string | string[];
  onFileSelect?: (file: File | null) => void;
  onFile?: (file: File) => void;
  selectedFile?: File | null;
  currentFile?: UploadedFileDescriptor;
  maxSizeMb?: number;
  error?: string;
  isUploading?: boolean;
  label?: string;
  description?: string;
}

export function FileUploadZone({ 
  className, 
  accept, 
  onFileSelect, 
  onFile,
  selectedFile,
  currentFile,
  maxSizeMb,
  error,
  isUploading = false,
  label = "Upload file",
  description = "Click or drag and drop"
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const acceptList = Array.isArray(accept) ? accept : accept ? accept.split(",").map((item) => item.trim()) : [];
  const selectedOrCurrent = selectedFile ?? currentFile;

  const notifySelect = (file: File) => {
    onFileSelect?.(file);
    onFile?.(file);
  };

  const validateAndSetFile = (file: File) => {
    setClientError(null);
    if (acceptList.length > 0) {
      const lowerName = file.name.toLowerCase();
      const valid = acceptList.some((entry) => {
        const normalized = entry.toLowerCase();
        if (normalized.startsWith(".")) return lowerName.endsWith(normalized);
        if (normalized.includes("/")) return file.type === normalized;
        return lowerName.endsWith(normalized.replace("*", ""));
      });
      if (!valid) {
        setClientError(`Unsupported file type. Accepted: ${acceptList.join(", ")}`);
        return;
      }
    }
    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      setClientError(`File too large. Max size: ${maxSizeMb} MB.`);
      return;
    }
    notifySelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isUploading) return;
    e.preventDefault();
    setIsDragOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  if (selectedOrCurrent) {
    return (
      <div className={cn("flex items-center justify-between p-4 rounded-xl border border-[var(--comp-accent)] bg-[var(--comp-accent-light)]", className)} aria-live="polite">
        <div className="flex items-center gap-3 overflow-hidden">
          <FileIcon className="w-5 h-5 text-[var(--comp-accent)] shrink-0" />
          <span className="text-sm font-medium text-[var(--comp-text-primary)] truncate">{selectedOrCurrent.name}</span>
        </div>
        <button type="button" onClick={() => onFileSelect?.(null)} className="shrink-0 text-[var(--comp-text-secondary)] hover:text-[var(--comp-text-primary)]">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => !isUploading && inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-busy={isUploading}
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!isUploading) inputRef.current?.click();
        }
      }}
      className={cn(
        "cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-colors",
        isDragOver ? "border-[var(--comp-accent)] bg-[var(--comp-accent-light)]" : "border-[var(--comp-border-strong)] bg-[var(--comp-surface)] hover:bg-[var(--comp-surface-hover)]",
        className
      )}
    >
      <input type="file" ref={inputRef} className="hidden" accept={Array.isArray(accept) ? accept.join(",") : accept} onChange={(e) => {
        if (e.target.files && e.target.files.length > 0) {
          validateAndSetFile(e.target.files[0]);
        }
      }} />
      {isUploading ? (
        <div className="w-full space-y-3">
          <div className="h-1.5 rounded-full bg-[var(--comp-border)] overflow-hidden">
            <div className="h-full w-2/3 bg-[var(--comp-accent)] animate-pulse" />
          </div>
          <p className="text-xs text-[var(--comp-text-muted)] text-center">Uploading...</p>
        </div>
      ) : (
        <>
          <UploadCloud className="w-8 h-8 text-[var(--comp-text-muted)] mb-3" />
          <h4 className="text-sm font-semibold text-[var(--comp-text-primary)]">{label}</h4>
          <p className="text-xs text-[var(--comp-text-muted)] mt-1">{description}</p>
          {acceptList.length > 0 ? (
            <p className="text-[11px] text-[var(--comp-text-muted)] mt-1">{acceptList.join(", ")}{maxSizeMb ? ` · max ${maxSizeMb} MB` : ""}</p>
          ) : null}
        </>
      )}
      {(clientError || error) ? <p className="mt-2 text-xs text-[var(--error)]">{clientError ?? error}</p> : null}
    </div>
  );
}
