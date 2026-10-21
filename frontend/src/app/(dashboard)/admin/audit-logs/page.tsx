'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { apiFetch } from '@/lib/api';
import { AuditLog, PaginatedResponse } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { History, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

/** "USER_UPDATED" -> "User updated" */
function readableAction(action: string): string {
  const text = action.replace(/[_.]/g, ' ').toLowerCase().trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "companyName" -> "Company name" */
function readableKey(key: string): string {
  const text = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_.]/g, ' ').toLowerCase().trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const DETAILS_PREVIEW = 3;

/** Turns an audit record's raw metadata into labelled rows that are easy to scan. */
function AuditDetails({ metadata }: { metadata: AuditLog['metadata'] }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(metadata ?? {});
  if (entries.length === 0) return <span className="text-xs text-muted-foreground">-</span>;

  const visible = expanded ? entries : entries.slice(0, DETAILS_PREVIEW);
  const hidden = entries.length - visible.length;

  return (
    <dl className="space-y-1 text-xs min-w-[14rem] max-w-md">
      {visible.map(([key, value]) => {
        const label = key === 'updatedFields' ? 'Changed' : readableKey(key);
        const text = key === 'updatedFields' && Array.isArray(value) ? value.map((v) => readableKey(String(v))).join(', ') : formatValue(value);
        return (
          <div key={key} className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">{label}:</dt>
            <dd className={`text-foreground ${expanded ? 'break-words' : 'truncate'}`} title={text}>
              {text}
            </dd>
          </div>
        );
      })}
      {(hidden > 0 || (expanded && entries.length > DETAILS_PREVIEW)) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] font-medium text-primary hover:underline"
        >
          {expanded ? 'Show less' : `Show ${hidden} more`}
        </button>
      )}
    </dl>
  );
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<PaginatedResponse<AuditLog>>(`/audit-logs?page=${page}&limit=15`);
      setLogs(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalRecords(res.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            <span>System Audit Trail</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Immutable chronological record of administrative actions, authentications, and data mutations
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadLogs}
          disabled={isLoading}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {/* Audit Logs Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Audit Event Records</CardTitle>
            <CardDescription>
              {totalRecords} total security and mutation events recorded
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Entity Scope</TableHead>
                <TableHead>Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  </TableRow>
                ))
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.action.includes('SECURITY') || log.action.includes('DEACTIVATED')
                            ? 'destructive'
                            : log.action.includes('LOGIN')
                            ? 'info'
                            : log.action.includes('CREATED')
                            ? 'success'
                            : 'secondary'
                        }
                        className="text-[11px] whitespace-nowrap"
                        title={log.action}
                      >
                        {readableAction(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.actor ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-foreground">{log.actor.name}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">{log.actor.email}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">System / Unauthenticated</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-medium text-foreground">{log.entityType}</span>
                      {log.entityId && (
                        <span className="text-[10px] text-muted-foreground block font-mono" title={log.entityId}>
                          #{log.entityId.slice(0, 8)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <AuditDetails metadata={log.metadata} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No audit records logged yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Page <span className="font-semibold text-foreground">{page}</span> of{' '}
              <span className="font-semibold text-foreground">{totalPages || 1}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
