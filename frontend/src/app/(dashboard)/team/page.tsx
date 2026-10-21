'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { RefreshCw, UsersRound } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  status: string;
  roles: string[];
  lastLoginAt: string | null;
  openTasks: number;
  overdueTasks: number;
  openTickets: number;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U'
  );
}

export default function MyTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: TeamMember[] }>('/users/team');
      setMembers([...res.data].sort((a, b) => b.overdueTasks - a.overdueTasks || b.openTasks - a.openTasks));
    } catch (err: any) {
      setError(err.message || 'Failed to load your team');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const totalOpen = members.reduce((sum, m) => sum + m.openTasks, 0);
  const totalOverdue = members.reduce((sum, m) => sum + m.overdueTasks, 0);
  const maxOpen = Math.max(1, ...members.map((m) => m.openTasks));

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UsersRound className="h-6 w-6 text-primary" /> My Team
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            People who report to you, with their current workload.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadTeam} title="Refresh team" className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Team members</CardDescription>
            <CardTitle className="text-2xl">{isLoading ? <Skeleton className="h-7 w-10" /> : members.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Open tasks</CardDescription>
            <CardTitle className="text-2xl">{isLoading ? <Skeleton className="h-7 w-10" /> : totalOpen}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Overdue tasks</CardDescription>
            <CardTitle className={`text-2xl ${totalOverdue > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
              {isLoading ? <Skeleton className="h-7 w-10" /> : totalOverdue}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Open Tasks</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Open Tickets</TableHead>
                <TableHead>Last Sign In</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : members.length > 0 ? (
                members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {initials(m.name)}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground text-sm truncate">{m.name}</span>
                          <span className="text-xs text-muted-foreground truncate">{m.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="text-[10px]">
                            {r}
                          </Badge>
                        ))}
                        {m.status !== 'ACTIVE' && (
                          <Badge variant="warning" className="text-[10px]">
                            {m.status}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-3">
                        <div className="hidden md:block w-24 bg-secondary h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.overdueTasks > 0 ? 'bg-red-500' : 'bg-primary'}`}
                            style={{ width: `${(m.openTasks / maxOpen) * 100}%` }}
                          />
                        </div>
                        <Link href="/work/tasks" className="font-semibold hover:text-primary w-6 text-right">
                          {m.openTasks}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${m.overdueTasks > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
                    >
                      {m.overdueTasks}
                    </TableCell>
                    <TableCell className="text-right">{m.openTickets}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(m.lastLoginAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                    No one reports to you yet. Ask an administrator to set &quot;Reports To&quot; for your staff.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
