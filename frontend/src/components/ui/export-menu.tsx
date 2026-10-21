'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';

export type ExportTableType =
  | 'leads-table'
  | 'customers-table'
  | 'projects-table'
  | 'invoices-table'
  | 'payments-table'
  | 'expenses-table'
  | 'tickets-table'
  | 'finance-summary';

type ExportFormat = 'xlsx' | 'pdf' | 'csv';

const FORMATS: Array<{ format: ExportFormat; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }> = [
  { format: 'xlsx', label: 'Excel', hint: '.xlsx spreadsheet', icon: FileSpreadsheet },
  { format: 'pdf', label: 'PDF', hint: 'Printable document', icon: FileText },
  { format: 'csv', label: 'CSV', hint: 'Plain data file', icon: Table2 },
];

interface ExportMenuProps {
  /** Which table to export. The server decides the rows, so this always exports the full list. */
  type: ExportTableType;
  label?: string;
  className?: string;
}

function filenameFrom(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

export function ExportMenu({ type, label = 'Export', className }: ExportMenuProps) {
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function download(format: ExportFormat) {
    setBusy(format);
    setError(null);
    try {
      const res = await fetch(`/api/v1/reports/export?type=${type}&format=${format}`, { credentials: 'include' });
      if (!res.ok) {
        let message = 'The export could not be created. Please try again.';
        try {
          const json = await res.json();
          if (res.status === 403) message = 'You do not have permission to export this data.';
          else if (json?.error?.message) message = json.error.message;
        } catch {
          // keep the default message
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFrom(res.headers.get('content-disposition'), `${type}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err: any) {
      setError(err?.message || 'The export could not be created. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  if (!hasPermission('reports.export')) return null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setError(null);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border/70 bg-card text-foreground text-sm font-medium hover:bg-secondary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <Download className="h-4 w-4" />
        {label}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-xl z-40 animate-in fade-in-0 zoom-in-95"
        >
          {FORMATS.map(({ format, label: formatLabel, hint, icon: Icon }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              disabled={busy !== null}
              onClick={() => download(format)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-secondary/60 disabled:opacity-60 transition-colors"
            >
              {busy === format ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Icon className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground leading-tight">{formatLabel}</span>
                <span className="text-[11px] text-muted-foreground leading-tight">{hint}</span>
              </span>
            </button>
          ))}
          {error && <p className="px-3 pt-1.5 pb-1 text-[11px] text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
