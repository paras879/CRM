'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { apiFetch } from '@/lib/api';
import { DashboardSummary, SupportOverview, SupportOverviewTicket } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportMenu } from '@/components/ui/export-menu';
import { getDisplayName } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  Inbox,
  LifeBuoy,
  Plus,
  UserCheck,
} from 'lucide-react';
import { MetricTile, titleCase } from './staff-dashboard';

const HOUR_MS = 60 * 60 * 1000;

const CARD = 'bg-card rounded-xl border border-border/70 shadow-sm p-6 space-y-4';
const CARD_HEAD = 'flex items-start justify-between gap-3 border-b border-border/70 pb-3';
const CARD_TITLE = 'text-lg font-semibold tracking-tight text-foreground flex items-center gap-2';
const CARD_LINK = 'text-primary hover:underline text-xs font-semibold flex items-center gap-1 shrink-0';

const PRIORITY_STYLES: Record<string, string> = {
  URGENT: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  HIGH: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  MEDIUM: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  LOW: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
};

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
  WAITING_ON_CUSTOMER: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING_ON_CUSTOMER: 'Pending Client',
};

function describeDue(dueAt?: string | null): { label: string; tone: string } {
  const muted = 'text-muted-foreground';
  if (!dueAt) return { label: 'No deadline', tone: muted };
  const diff = new Date(dueAt).getTime() - Date.now();
  const hours = Math.floor(Math.abs(diff) / HOUR_MS);
  const span = hours >= 48 ? `${Math.floor(hours / 24)}d` : hours >= 1 ? `${hours}h` : `${Math.max(1, Math.floor(Math.abs(diff) / 60000))}m`;
  if (diff < 0) return { label: `Overdue ${span}`, tone: 'text-red-600 dark:text-red-400' };
  if (diff <= 4 * HOUR_MS) return { label: `Due in ${span}`, tone: 'text-amber-600 dark:text-amber-400' };
  return { label: `Due in ${span}`, tone: muted };
}

function TicketLine({ ticket, action }: { ticket: SupportOverviewTicket; action?: React.ReactNode }) {
  const due = describeDue(ticket.dueAt);
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <Link
        href={`/support/tickets/${ticket.id}`}
        className="min-w-0 flex-1 hover:text-primary transition-colors focus:outline-none focus:underline"
      >
        <p className="flex items-center gap-2 text-[13px]">
          <span className="font-semibold text-primary shrink-0">{ticket.ticketNumber}</span>
          <span className="font-medium text-foreground truncate">{ticket.subject}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{ticket.customerName ?? 'No customer'}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PRIORITY_STYLES[ticket.priority]}`}>
            {titleCase(ticket.priority)}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLES[ticket.status] ?? ''}`}>
            {STATUS_LABELS[ticket.status] ?? titleCase(ticket.status)}
          </span>
          <span className={`font-medium ${due.tone}`}>{due.label}</span>
        </p>
      </Link>
      {action}
    </li>
  );
}

export function SupportDashboard() {
  const { user, hasPermission } = useAuth();
  const [overview, setOverview] = useState<SupportOverview | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canUpdate = hasPermission('tickets.update');

  const load = useCallback(async () => {
    const [overviewRes, summaryRes] = await Promise.allSettled([
      apiFetch<{ data: SupportOverview }>('/tickets/overview'),
      apiFetch<{ summary: DashboardSummary }>('/dashboard/summary'),
    ]);
    if (overviewRes.status === 'fulfilled') {
      setOverview(overviewRes.value.data);
      setLoadFailed(false);
    } else {
      setLoadFailed(true);
    }
    if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.summary);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateTicket(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      await apiFetch(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      await load();
    } catch {
      // the ticket stays where it was if the update fails
    } finally {
      setBusyId(null);
    }
  }

  const c = overview?.counts;
  const queueTotal = (c?.open ?? 0) + (c?.inProgress ?? 0) + (c?.waitingOnCustomer ?? 0);
  const statusBars = [
    { label: 'Open', value: c?.open ?? 0, bar: 'bg-slate-400', href: '/support/tickets?status=OPEN' },
    { label: 'In progress', value: c?.inProgress ?? 0, bar: 'bg-indigo-500', href: '/support/tickets?status=IN_PROGRESS' },
    { label: 'Waiting on customer', value: c?.waitingOnCustomer ?? 0, bar: 'bg-amber-500', href: '/support/tickets?status=WAITING_ON_CUSTOMER' },
  ];

  const actionButton = 'px-3 py-1 rounded bg-card border border-border/70 text-xs font-semibold hover:bg-secondary/50 disabled:opacity-50 shrink-0';

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-6 rounded-xl border border-border/70 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h2 className="text-2xl md:text-[28px] font-bold tracking-tight text-foreground">
              Welcome back, {getDisplayName(user)}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300 text-[11px] font-semibold">
              Support
            </span>
          </div>
          <p className="text-[15px] text-muted-foreground">
            {isLoading || !c
              ? 'Your help desk queue and SLA deadlines.'
              : c.assignedToMe > 0
              ? `You have ${c.assignedToMe} open ticket${c.assignedToMe === 1 ? '' : 's'}, and ${c.unassigned} waiting in the queue.`
              : `Nothing assigned to you. ${c.unassigned} ticket${c.unassigned === 1 ? ' is' : 's are'} waiting in the queue.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:flex-nowrap md:shrink-0">
          <ExportMenu type="tickets-table" label="Export tickets" />
          {hasPermission('kb.view') && (
            <Link
              href="/knowledge-base"
              className="px-4 py-2 bg-card border border-border/70 hover:bg-secondary/50 text-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <BookOpen className="h-[18px] w-[18px]" /> Knowledge Base
            </Link>
          )}
          {hasPermission('tickets.create') && (
            <Link
              href="/support/tickets"
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 shadow-sm"
            >
              <Plus className="h-[18px] w-[18px]" /> New Ticket
            </Link>
          )}
        </div>
      </div>

      {loadFailed && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-foreground flex items-center justify-between gap-3">
          <span>We couldn&apos;t load the ticket queue. Check your connection and try again.</span>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              load();
            }}
            className="px-3 py-1.5 rounded-md border border-border/70 bg-card text-xs font-semibold hover:bg-secondary/50"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricTile
          label="Unassigned"
          value={c?.unassigned ?? 0}
          valueClass={(c?.unassigned ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}
          href="/support/tickets"
          isLoading={isLoading}
          icon={Inbox}
          iconClass="text-amber-600 bg-amber-500/10 dark:text-amber-400"
        >
          <span className="text-muted-foreground">Waiting for an owner</span>
        </MetricTile>
        <MetricTile
          label="My Open Tickets"
          value={c?.assignedToMe ?? 0}
          href="/support/tickets"
          isLoading={isLoading}
          icon={UserCheck}
          iconClass="text-primary bg-primary/10"
        >
          <span className="text-muted-foreground">Assigned to you</span>
        </MetricTile>
        <MetricTile
          label="Overdue"
          value={c?.overdue ?? 0}
          valueClass={(c?.overdue ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}
          href="/support/tickets?isOverdue=true"
          isLoading={isLoading}
          icon={AlertTriangle}
          iconClass="text-red-600 bg-red-500/10 dark:text-red-400"
        >
          <span className="text-muted-foreground">Past SLA or due date</span>
        </MetricTile>
        <MetricTile
          label="Due in 4 hours"
          value={c?.dueSoon ?? 0}
          valueClass={(c?.dueSoon ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}
          isLoading={isLoading}
          icon={Clock}
          iconClass="text-amber-600 bg-amber-500/10 dark:text-amber-400"
        >
          <span className="text-muted-foreground">Act before it slips</span>
        </MetricTile>
        <MetricTile
          label="High / Urgent"
          value={c?.highPriority ?? 0}
          valueClass={(c?.highPriority ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}
          href="/support/tickets?priority=HIGH"
          isLoading={isLoading}
          icon={Flame}
          iconClass="text-rose-600 bg-rose-500/10 dark:text-rose-400"
        >
          <span className="text-muted-foreground">Still unresolved</span>
        </MetricTile>
        <MetricTile
          label="Resolved Today"
          value={c?.resolvedToday ?? 0}
          valueClass="text-emerald-600 dark:text-emerald-400"
          isLoading={isLoading}
          icon={CheckCircle2}
          iconClass="text-emerald-600 bg-emerald-500/10 dark:text-emerald-400"
        >
          <span className="text-muted-foreground">{c?.myResolvedToday ?? 0} by you</span>
        </MetricTile>
      </div>

      {/* SLA at risk + queue health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div>
              <h3 className={CARD_TITLE}>
                <AlertTriangle className="h-5 w-5 text-red-500" /> SLA at Risk
              </h3>
              <p className="text-xs text-muted-foreground">Overdue or due within 4 hours, soonest first</p>
            </div>
            <Link href="/support/tickets?isOverdue=true" className={CARD_LINK}>
              View overdue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : !overview || overview.atRisk.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm font-semibold text-foreground">All clear</p>
              <p className="text-xs text-muted-foreground">No ticket is late or about to be.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {overview.atRisk.map((t) => (
                <TicketLine key={t.id} ticket={t} />
              ))}
            </ul>
          )}
        </div>

        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div>
              <h3 className={CARD_TITLE}>
                <LifeBuoy className="h-5 w-5 text-primary" /> Queue Health
              </h3>
              <p className="text-xs text-muted-foreground">Where the {queueTotal} active tickets stand</p>
            </div>
            <Link href="/support/tickets" className={CARD_LINK}>
              All tickets <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : queueTotal === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">The queue is empty.</div>
          ) : (
            <div className="space-y-4">
              {statusBars.map((s) => (
                <Link key={s.label} href={s.href} className="block focus:outline-none focus:ring-2 focus:ring-primary rounded">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-semibold text-foreground">{s.value}</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div className={`${s.bar} h-full rounded-full`} style={{ width: `${(s.value / queueTotal) * 100}%` }} />
                  </div>
                </Link>
              ))}
              {hasPermission('kb.view') && summary?.publishedArticles != null && (
                <Link
                  href="/knowledge-base"
                  className="mt-2 flex items-center justify-between rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5 hover:border-primary/50 transition-colors"
                >
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <BookOpen className="h-4 w-4 text-sky-500" /> Knowledge base articles
                  </span>
                  <span className="text-sm font-semibold text-foreground">{summary.publishedArticles}</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unassigned queue + my tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div>
              <h3 className={CARD_TITLE}>
                <Inbox className="h-5 w-5 text-amber-500" /> Unassigned Queue
              </h3>
              <p className="text-xs text-muted-foreground">Take one to start working on it</p>
            </div>
            <Link href="/support/tickets" className={CARD_LINK}>
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : !overview || overview.unassignedQueue.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">Every ticket has an owner.</div>
          ) : (
            <ul className="divide-y divide-border/70">
              {overview.unassignedQueue.map((t) => (
                <TicketLine
                  key={t.id}
                  ticket={t}
                  action={
                    canUpdate && user ? (
                      <button
                        type="button"
                        disabled={busyId === t.id}
                        onClick={() => updateTicket(t.id, { assignedTo: user.id, status: 'IN_PROGRESS' })}
                        className={actionButton}
                      >
                        {busyId === t.id ? 'Assigning…' : 'Assign to me'}
                      </button>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )}
        </div>

        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div>
              <h3 className={CARD_TITLE}>
                <UserCheck className="h-5 w-5 text-primary" /> My Tickets
              </h3>
              <p className="text-xs text-muted-foreground">Most urgent first</p>
            </div>
            <Link href="/support/tickets" className={CARD_LINK}>
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : !overview || overview.myTickets.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              You have no open tickets. Pick one from the queue.
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {overview.myTickets.map((t) => (
                <TicketLine
                  key={t.id}
                  ticket={t}
                  action={
                    canUpdate ? (
                      <button
                        type="button"
                        disabled={busyId === t.id}
                        onClick={() => updateTicket(t.id, { status: 'RESOLVED', resolvedAt: new Date().toISOString() })}
                        className={actionButton}
                      >
                        {busyId === t.id ? 'Resolving…' : 'Resolve'}
                      </button>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
