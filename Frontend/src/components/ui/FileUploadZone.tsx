import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { UploadCloud, File as FileIcon, X } from "lucide-react";

export interface FileUploadZoneProps {
  className?: string;
  accept?: string;
  onFileSelect: (file: File | null) => void;
  selectedFile?: File | null;
  label?: string;
  description?: string;
}

export function FileUploadZone({ 
  className, 
  accept, 
  onFileSelect, 
  selectedFile,
  label = "Upload file",
  description = "Click or drag and drop"
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  if (selectedFile) {
    return (
      <div className={cn("flex items-center justify-between p-4 rounded-xl border border-[var(--comp-accent)] bg-[var(--comp-accent-light)]", className)}>
        <div className="flex items-center gap-3 overflow-hidden">
          <FileIcon className="w-5 h-5 text-[var(--comp-accent)] shrink-0" />
          <span className="text-sm font-medium text-[var(--comp-text-primary)] truncate">{selectedFile.name}</span>
        </div>
        <button type="button" onClick={() => onFileSelect(null)} className="shrink-0 text-[var(--comp-text-secondary)] hover:text-[var(--comp-text-primary)]">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-colors",
        isDragOver ? "border-[var(--comp-accent)] bg-[var(--comp-accent-light)]" : "border-[var(--comp-border-strong)] bg-[var(--comp-surface)] hover:bg-[var(--comp-surface-hover)]",
        className
      )}
    >
      <input type="file" ref={inputRef} className="hidden" accept={accept} onChange={(e) => {
        if (e.target.files && e.target.files.length > 0) {
          onFileSelect(e.target.files[0]);
        }
      }} />
      <UploadCloud className="w-8 h-8 text-[var(--comp-text-muted)] mb-3" />
      <h4 className="text-sm font-semibold text-[var(--comp-text-primary)]">{label}</h4>
      <p className="text-xs text-[var(--comp-text-muted)] mt-1">{description}</p>
    </div>
  );
}
