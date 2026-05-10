import { FileUploadZone as SharedFileUploadZone } from "../ui/FileUploadZone";

interface CurrentFile {
  name: string;
  size: number;
  uploadedAt: string;
}

interface FileUploadZoneProps {
  onFile: (file: File) => void;
  accept: string[];
  maxSizeMb: number;
  currentFile?: CurrentFile;
  error?: string;       // API error message — authoritative
  isUploading?: boolean;
}

export function FileUploadZone({
  onFile,
  accept,
  maxSizeMb,
  currentFile,
  error,
  isUploading = false,
}: FileUploadZoneProps) {
  return (
    <SharedFileUploadZone
      accept={accept}
      maxSizeMb={maxSizeMb}
      onFile={onFile}
      currentFile={currentFile}
      error={error}
      isUploading={isUploading}
      label="Drag & drop or click to browse"
      description="Upload a valid file to continue"
    />
  );
}
