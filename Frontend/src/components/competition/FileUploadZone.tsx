/**
 * FileUploadZone.tsx — 6-state file upload zone with drag-drop and mobile touch support.
 */

import { useRef, useState } from 'react';

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploadZone({
  onFile,
  accept,
  maxSizeMb,
  currentFile,
  error,
  isUploading = false,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

  function handleFile(file: File) {
    setClientError(null);
    if (!accept.some((ext) => file.name.toLowerCase().endsWith(ext.replace('*', '')))) {
      setClientError(`File type not supported. Accepted: ${accept.join(', ')}`);
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setClientError(`File too large. Max size: ${maxSizeMb} MB.`);
      return;
    }
    setSelectedFile(file);
    onFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const borderColor = dragging
    ? 'var(--comp-accent)'
    : error
    ? '#b91c1c'
    : clientError
    ? '#d97706'
    : 'var(--comp-border)';

  const bgColor = dragging ? 'var(--comp-accent-light)' : 'var(--comp-surface)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      {/* Upload zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload file zone"
        aria-busy={isUploading}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        style={{
          border: `2px dashed ${borderColor}`,
          borderRadius: 10,
          padding: 'var(--space-lg)',
          background: bgColor,
          cursor: isUploading ? 'not-allowed' : 'pointer',
          textAlign: 'center',
          transition: 'border-color 0.15s ease, background 0.15s ease',
          userSelect: 'none',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept.join(',')}
          style={{ display: 'none' }}
          aria-hidden="true"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {isUploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: '100%',
                height: 4,
                background: 'var(--comp-border)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: 'var(--comp-accent)',
                  width: '60%',
                  animation: 'shimmer 1.5s infinite',
                  backgroundSize: '200% 100%',
                  backgroundImage: 'linear-gradient(90deg, var(--comp-accent) 0%, var(--comp-accent-hover) 50%, var(--comp-accent) 100%)',
                }}
              />
            </div>
            <span className="comp-body">Uploading...</span>
          </div>
        ) : selectedFile ?? currentFile ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '1.5rem' }} aria-hidden="true">✅</span>
            <span className="comp-heading-md">{selectedFile?.name ?? currentFile?.name}</span>
            <span className="comp-body">
              {selectedFile ? formatBytes(selectedFile.size) : currentFile ? formatBytes(currentFile.size) : ''}
            </span>
            {!selectedFile && currentFile && (
              <span style={{ fontSize: '0.75rem', color: 'var(--comp-text-muted)' }}>
                Uploaded {new Date(currentFile.uploadedAt).toLocaleDateString('en-IN')} ·{' '}
                <span style={{ color: 'var(--comp-accent)', textDecoration: 'underline' }}>Replace</span>
              </span>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '2rem' }} aria-hidden="true">☁️</span>
            <span className="comp-heading-md">
              {isTouchDevice ? 'Tap to browse' : 'Drag & drop or click to browse'}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
              {accept.map((ext) => (
                <span
                  key={ext}
                  style={{
                    background: 'var(--comp-accent-light)',
                    color: 'var(--comp-accent)',
                    borderRadius: 20,
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  {ext}
                </span>
              ))}
              <span
                style={{
                  background: 'var(--comp-accent-light)',
                  color: 'var(--comp-accent)',
                  borderRadius: 20,
                  padding: '2px 8px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                }}
              >
                max {maxSizeMb} MB
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Client-side error (immediate feedback, pre-submit) */}
      {clientError && !error && (
        <p
          role="alert"
          style={{ color: '#d97706', fontSize: '0.8rem', margin: 0 }}
        >
          ⚠️ {clientError}
        </p>
      )}

      {/* API error — authoritative, always shown when set */}
      {error && (
        <p
          role="alert"
          style={{ color: 'var(--deadline-urgent)', fontSize: '0.8rem', margin: 0 }}
        >
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
