'use client';

import React, { useRef, useState } from 'react';
import { FileText, Loader2, Paperclip, Upload, X } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

const MAX_MB = 10;

interface UploadedFile {
  url: string;
  fileName: string;
  sizeBytes: number;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileUploadFieldProps {
  /** The stored link: an uploaded file's URL, or an older external address. Empty when nothing is attached. */
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  /** A single slim row, for tight spaces such as a reply box. */
  compact?: boolean;
  accept?: string;
  className?: string;
}

export function FileUploadField({ value, onChange, disabled, compact, accept, className }: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<{ url: string; name: string; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    setError(null);
    if (file.size === 0) {
      setError('That file is empty. Choose a different one.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That file is ${formatSize(file.size)}. Files must be ${MAX_MB} MB or smaller.`);
      return;
    }
    setUploading(true);
    try {
      const res = await apiFetch<{ data: UploadedFile }>(`/uploads?fileName=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });
      setUploaded({ url: res.data.url, name: res.data.fileName, size: res.data.sizeBytes });
      onChange(res.data.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The upload failed. Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) void upload(file);
  }

  function remove() {
    setUploaded(null);
    setError(null);
    onChange('');
  }

  const hasFile = value !== '';
  const displayName = uploaded && uploaded.url === value ? uploaded.name : 'Attached file';
  const displaySize = uploaded && uploaded.url === value ? formatSize(uploaded.size) : null;

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      className="hidden"
      onChange={(e) => {
        handleFiles(e.target.files);
        e.target.value = '';
      }}
    />
  );

  if (hasFile) {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 rounded-md border border-border/70 bg-secondary/40 px-3 py-2">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs font-medium text-foreground hover:text-primary hover:underline"
            >
              {displayName}
            </a>
            {displaySize && <span className="text-[11px] text-muted-foreground">{displaySize}</span>}
          </div>
          <button
            type="button"
            onClick={remove}
            disabled={disabled}
            aria-label="Remove attached file"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={className}>
        {picker}
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border/70 bg-card text-xs font-medium text-foreground hover:bg-secondary/50 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : 'Attach a file'}
        </button>
        {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className={className}>
      {picker}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && !uploading) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-5 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border/80 bg-secondary/30'
        )}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <Upload className="h-5 w-5 text-muted-foreground" />
        )}
        <p className="text-xs text-muted-foreground">
          {uploading ? 'Uploading…' : 'Drag a file here, or'}
        </p>
        {!uploading && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="px-3 py-1.5 rounded-md border border-border/70 bg-card text-xs font-semibold text-foreground hover:bg-secondary/50 disabled:opacity-50"
          >
            Choose a file
          </button>
        )}
        <p className="text-[11px] text-muted-foreground">PDF, image, Word, Excel or ZIP, up to {MAX_MB} MB</p>
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
