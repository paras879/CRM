'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Paperclip, Trash2, Upload } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type AttachmentEntityType =
  | 'customer'
  | 'lead'
  | 'project'
  | 'task'
  | 'invoice'
  | 'ticket'
  | 'contract'
  | 'proposal'
  | 'estimate';

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentsPanelProps {
  entityType: AttachmentEntityType;
  entityId: string;
}

export function AttachmentsPanel({ entityType, entityId }: AttachmentsPanelProps) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: Attachment[] }>(
        `/attachments?entityType=${entityType}&entityId=${entityId}`
      );
      setItems(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load attachments.');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      await apiFetch(
        `/attachments?entityType=${entityType}&entityId=${entityId}&fileName=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file,
        }
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload file.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(`Delete "${attachment.fileName}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/attachments/${attachment.id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete file.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Files up to 10 MB. Executable and script files are not allowed.</p>
        <div>
          <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
          <Button
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Uploading...' : 'Upload File'}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Card className="border-border/70 bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/40">
            <TableRow className="border-border/60">
              <TableHead className="text-xs font-semibold text-foreground/80">File</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Size</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Uploaded</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                  Loading attachments...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                  No files attached yet. Use Upload File to add one.
                </TableCell>
              </TableRow>
            ) : (
              items.map((a) => (
                <TableRow key={a.id} className="border-border/50">
                  <TableCell className="text-xs font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      {a.fileName}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatSize(a.sizeBytes)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <a
                      href={`/api/v1/attachments/${a.id}/download`}
                      aria-label={`Download ${a.fileName}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      aria-label={`Delete ${a.fileName}`}
                      onClick={() => handleDelete(a)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
