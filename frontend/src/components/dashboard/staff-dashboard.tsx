'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { apiFetch } from '@/lib/api';
import { DashboardSummary, Ticket, WorkDashboardMetrics } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { getDisplayName } from '@/lib/utils';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Clock,
  FolderKanban,
  LifeBuoy,
  TrendingUp,
  Users,
} from 'lucide-react';

const PROJECT_LIMIT = 3;
const TICKET_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export const PROJECT_STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  PLANNING: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
  ON_HOLD: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  COMPLETED: 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300',
  CANCELLED: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

const PRIORITY_STYLES: Record<string, string> = {
  URGENT: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  HIGH: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  MEDIUM: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  LOW: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
};

const TICKET_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
  WAITING_ON_CUSTOMER: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING_ON_CUSTOMER: 'Pending Client',
};

export const PROGRESS_COLORS = ['bg-indigo-600', 'bg-blue-500', 'bg-amber-500'];

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatDeadline(deadline?: string | null): { label: string; tone: string } {
  const muted = 'text-muted-foreground';
  if (!deadline) return { label: 'No deadline', tone: muted };
  const due = new Date(deadline);
  if (isNaN(due.getTime())) return { label: 'No deadline', tone: muted };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(due).setHours(0, 0, 0, 0) - startOfToday.getTime()) / DAY_MS);

  if (days < 0) return { label: `Overdue ${Math.abs(days)}d`, tone: 'text-red-600 dark:text-red-400' };
  if (days === 0) return { label: 'Due Today', tone: 'text-red-600 dark:text-red-400' };
  if (days === 1) return { label: 'Due Tomorrow', tone: 'text-red-600 dark:text-red-400' };
  const label = `Due ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(due)}`;
  return { label, tone: days <= 7 ? 'text-amber-600 dark:text-amber-400' : muted };
}

export function MetricTile({
  label,
  value,
  valueClass = 'text-foreground',
  children,
  href,
  isLoading,
  icon: Icon,
  iconClass = 'text-primary bg-primary/10',
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  children?: React.ReactNode;
  href?: string;
  isLoading: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  iconClass?: string;
}) {
  const body = (
    <div className="h-full p-4 rounded-lg bg-secondary/30 border border-border/70 hover:border-primary/50 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        {Icon && (
          <span className={`h-7 w-7 shrink-0 rounded-md flex items-center justify-center ${iconClass}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-7 w-12 mt-1" />
      ) : (
        <div className={`text-2xl font-bold tracking-tight mt-1 ${valueClass}`}>{value}</div>
      )}
      {children && <div className="text-xs mt-1">{children}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
      {body}
    </Link>
  ) : (
    body
  );
}

export function StaffDashboard() {
  const { user, hasPermission } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [workMetrics, setWorkMetrics] = useState<WorkDashboardMetrics | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const canViewTickets = hasPermission('tickets.view');
  const canUpdateTickets = hasPermission('tickets.update');
  const userId = user?.id;

  const loadTickets = useCallback(async () => {
    if (!canViewTickets || !userId) return;
    try {
      const [res, summaryRes] = await Promise.all([
        apiFetch<{ data: Ticket[] }>(`/tickets?assignedTo=${userId}&sortBy=priority&sortOrder=desc&limit=50`),
        apiFetch<{ summary: DashboardSummary }>('/dashboard/summary'),
      ]);
      const active = (res.data ?? []).filter((t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED');
      setTickets(active);
      setSummary(summaryRes.summary);
    } catch {
      // keep the previous list on failure
    }
  }, [canViewTickets, userId]);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const [sumRes, workRes] = await Promise.allSettled([
        apiFetch<{ summary: DashboardSummary }>('/dashboard/summary'),
        apiFetch<{ metrics: WorkDashboardMetrics }>('/work-dashboard/metrics'),
      ]);
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.summary);
      if (workRes.status === 'fulfilled') setWorkMetrics(workRes.value.metrics);

      if (canViewTickets && userId) {
        try {
          const res = await apiFetch<{ data: Ticket[] }>(
            `/tickets?assignedTo=${userId}&sortBy=priority&sortOrder=desc&limit=50`
          );
          setTickets((res.data ?? []).filter((t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED'));
        } catch {
          setTickets([]);
        }
      }
      setIsLoading(false);
    }
    load();
  }, [canViewTickets, userId]);

  async function resolveTicket(ticketId: string) {
    setResolvingId(ticketId);
    try {
      await apiFetch(`/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'RESOLVED' }),
      });
      await loadTickets();
    } catch {
      // ticket stays in the list if the update fails
    } finally {
      setResolvingId(null);
    }
  }

  const primaryRole =
    Array.isArray(user?.roles) && user.roles.length > 0
      ? typeof user.roles[0] === 'string'
        ? user.roles[0]
        : (user.roles[0] as any).name
      : 'Staff Member';

  const scopedProjects = workMetrics?.recentProjects ?? [];
  const projectCount = workMetrics?.activeProjectsCount ?? 0;
  const openTaskCount = workMetrics?.assignedTasksCount ?? workMetrics?.openTasksCount ?? 0;
  const overdueTasks = workMetrics?.overdueTasksCount ?? 0;
  const overdueProjects = workMetrics?.overdueProjectsCount ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-6 rounded-xl border border-border/70 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h2 className="text-2xl md:text-[28px] font-bold tracking-tight text-foreground">
              Welcome back, {getDisplayName(user)}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300 text-[11px] font-semibold">
              {primaryRole}
            </span>
          </div>
          <p className="text-[15px] text-muted-foreground">
            Your personal workspace for projects, tasks and support
            {user?.company?.name ? ` at ${user.company.name}` : ''}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hasPermission('tasks.view') && (
            <Link
              href="/work/tasks?filter=my"
              className="px-4 py-2 bg-card border border-border/70 hover:bg-secondary/50 text-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="h-[18px] w-[18px]" /> My Tasks
            </Link>
          )}
          {hasPermission('projects.view') && (
            <Link
              href="/work/projects?status=ACTIVE"
              className="px-4 py-2 bg-card border border-border/70 hover:bg-secondary/50 text-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <FolderKanban className="h-[18px] w-[18px]" /> Projects
            </Link>
          )}
          {canViewTickets && (
            <Link
              href="/support/tickets"
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 shadow-sm"
            >
              <LifeBuoy className="h-[18px] w-[18px]" /> Support Desk
            </Link>
          )}
        </div>
      </div>

      {/* Primary Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {hasPermission('projects.view') && (
          <Link
            href="/work/projects?status=ACTIVE"
            className="bg-card p-6 rounded-xl border border-border/70 shadow-sm flex items-center justify-between hover:border-primary/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">My Projects</div>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-foreground flex items-baseline gap-2">
                  {projectCount}
                  {overdueProjects > 0 && (
                    <span className="text-red-600 dark:text-red-400 text-[11px] font-semibold">{overdueProjects} overdue</span>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Active collaborative workspaces</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FolderKanban className="h-6 w-6" />
            </div>
          </Link>
        )}
        {hasPermission('tasks.view') && (
          <Link
            href="/work/tasks?filter=my"
            className="bg-card p-6 rounded-xl border border-border/70 shadow-sm flex items-center justify-between hover:border-primary/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">My Open Tasks</div>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-foreground flex items-baseline gap-2">
                  {openTaskCount}
                  {overdueTasks > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 text-[11px] font-semibold">{overdueTasks} overdue</span>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Assigned action items pending</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CheckSquare className="h-6 w-6" />
            </div>
          </Link>
        )}
      </div>

      {/* Project Delivery & Task Schedule */}
      {hasPermission('projects.view') && (
        <div className="bg-card rounded-xl border border-border/70 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border/70 pb-4">
            <div>
              <h3 className="text-[22px] font-semibold tracking-tight text-foreground">Project Delivery &amp; Task Schedule</h3>
              <p className="text-xs text-muted-foreground">Real-time status of assigned deliverables and active milestones</p>
            </div>
            <Link href="/work/projects?status=ACTIVE" className="text-primary hover:underline text-xs font-semibold flex items-center gap-1">
              All Projects <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricTile label="My Active Projects" value={projectCount} href="/work/projects?status=ACTIVE" isLoading={isLoading}>
              {overdueProjects > 0 ? (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> {overdueProjects} overdue
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" /> On track
                </span>
              )}
            </MetricTile>
            <MetricTile
              label="Nearing Deadline"
              value={workMetrics?.nearingDeadlineProjectsCount ?? 0}
              href="/work/tasks?filter=dueSoon"
              isLoading={isLoading}
            >
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" /> Due within 7 days
              </span>
            </MetricTile>
            <MetricTile
              label="Overdue Tasks"
              value={overdueTasks}
              valueClass={overdueTasks > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}
              href="/work/tasks?filter=overdue"
              isLoading={isLoading}
            >
              {overdueTasks > 0 ? (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertTriangle className="h-3.5 w-3.5" /> Action required
                </span>
              ) : (
                <span className="text-muted-foreground">Nothing overdue</span>
              )}
            </MetricTile>
            <MetricTile label="My Logged Hours" value={workMetrics?.timeTracking.totalHours ?? 0} isLoading={isLoading}>
              <span className="text-muted-foreground">{workMetrics?.timeTracking.billableHours ?? 0} hrs billable</span>
            </MetricTile>
          </div>

          <div className="space-y-4 pt-2">
            <h4 className="text-[13px] font-semibold text-foreground">Active Projects &amp; Progress</h4>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : scopedProjects.length === 0 ? (
              <div className="border border-dashed border-border/70 rounded-lg p-6 text-center text-xs text-muted-foreground">
                No active projects assigned to you yet.
              </div>
            ) : (
              <div className="divide-y divide-border/70 border border-border/70 rounded-lg overflow-hidden">
                {scopedProjects.slice(0, PROJECT_LIMIT).map((proj, index) => {
                  const deadline = formatDeadline(proj.deadline);
                  const color = PROGRESS_COLORS[index % PROGRESS_COLORS.length];
                  return (
                    <Link
                      key={proj.id}
                      href={`/work/projects/${proj.id}`}
                      className="p-4 bg-card hover:bg-secondary/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 focus:outline-none focus:bg-secondary/30"
                    >
                      <div className="space-y-1 md:min-w-[240px]">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                          <span className="text-[13px] font-semibold text-foreground">{proj.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{proj.customerName}</div>
                      </div>
                      <div className="flex-1 md:max-w-xs">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Progress</span>
                          <span className="font-semibold text-foreground">{proj.progress}%</span>
                        </div>
                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                          <div className={`${color} h-full rounded-full`} style={{ width: `${proj.progress}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">{proj.totalTasks} Tasks</div>
                          <div className={`text-xs font-medium ${deadline.tone}`}>{deadline.label}</div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            PROJECT_STATUS_STYLES[proj.status] ?? PROJECT_STATUS_STYLES.ACTIVE
                          }`}
                        >
                          {titleCase(proj.status)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Support Desk & Assigned Tickets */}
      {canViewTickets && (
        <div className="bg-card rounded-xl border border-border/70 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border/70 pb-4">
            <div>
              <h3 className="text-[22px] font-semibold tracking-tight text-foreground">Support Desk &amp; Assigned Tickets</h3>
              <p className="text-xs text-muted-foreground">Active client requests and operational queue metrics</p>
            </div>
            <Link href="/support/tickets" className="text-primary hover:underline text-xs font-semibold flex items-center gap-1">
              All Tickets <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricTile label="Open Tickets" value={summary?.openTickets ?? 0} href="/support/tickets?status=OPEN" isLoading={isLoading} />
            <MetricTile
              label="High Priority"
              value={summary?.highPriorityUnresolved ?? 0}
              valueClass="text-red-600 dark:text-red-400"
              href="/support/tickets?priority=HIGH"
              isLoading={isLoading}
            />
            <MetricTile
              label="Overdue SLA"
              value={summary?.overdueTickets ?? 0}
              valueClass="text-amber-600 dark:text-amber-400"
              href="/support/tickets?isOverdue=true"
              isLoading={isLoading}
            />
            <MetricTile
              label="Customer Pending"
              value={summary?.waitingOnCustomer ?? 0}
              href="/support/tickets?status=WAITING_ON_CUSTOMER"
              isLoading={isLoading}
            />
            <MetricTile
              label="In Progress"
              value={summary?.inProgressTickets ?? 0}
              valueClass="text-indigo-600 dark:text-indigo-400"
              href="/support/tickets?status=IN_PROGRESS"
              isLoading={isLoading}
            />
            <MetricTile label="Unread Alerts" value={summary?.unreadNotifications ?? 0} isLoading={isLoading} />
          </div>

          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : tickets.length === 0 ? (
            <div className="border border-dashed border-border/70 rounded-lg p-6 text-center text-xs text-muted-foreground">
              No open tickets are assigned to you.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-secondary/30 border-b border-border/70 text-[11px] text-muted-foreground">
                    <th className="py-3 px-4 font-semibold">Ticket ID</th>
                    <th className="py-3 px-4 font-semibold">Subject</th>
                    <th className="py-3 px-4 font-semibold">Client</th>
                    <th className="py-3 px-4 font-semibold">Priority</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    {canUpdateTickets && <th className="py-3 px-4 font-semibold text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70 text-[13px] text-foreground">
                  {tickets.slice(0, TICKET_LIMIT).map((t) => (
                    <tr key={t.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-primary">
                        <Link href={`/support/tickets/${t.id}`} className="hover:underline">
                          {t.ticketNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4">{t.subject}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {t.customer?.companyName || t.customer?.name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${PRIORITY_STYLES[t.priority]}`}>
                          {titleCase(t.priority)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${TICKET_STATUS_STYLES[t.status] ?? ''}`}>
                          {TICKET_STATUS_LABELS[t.status] ?? titleCase(t.status)}
                        </span>
                      </td>
                      {canUpdateTickets && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            disabled={resolvingId === t.id}
                            onClick={() => resolveTicket(t.id)}
                            className="px-3 py-1 rounded bg-card border border-border/70 text-xs font-semibold hover:bg-secondary/50 disabled:opacity-50"
                          >
                            {resolvingId === t.id ? 'Resolving…' : 'Resolve'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Workspace Shortcuts */}
      <div className="space-y-4">
        <h3 className="text-[22px] font-semibold tracking-tight text-foreground">Workspace Shortcuts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {hasPermission('tasks.view') && (
            <ShortcutCard
              href="/work/tasks?filter=my"
              icon={<CheckCircle2 className="h-5 w-5" />}
              iconClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
              title="My Assigned Tasks"
              description="View and update your individual task backlog across boards."
              cta="Open tasks"
            />
          )}
          {hasPermission('projects.view') && (
            <ShortcutCard
              href="/work/projects?status=ACTIVE"
              icon={<Users className="h-5 w-5" />}
              iconClass="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
              title="Active Project Memberships"
              description="Collaborate with team members and inspect shared milestones."
              cta="View memberships"
            />
          )}
          {canViewTickets && (
            <ShortcutCard
              href="/support/tickets"
              icon={<LifeBuoy className="h-5 w-5" />}
              iconClass="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
              title="Support Help Desk"
              description="Access customer escalation channels and knowledge base articles."
              cta="Launch help desk"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ShortcutCard({
  href,
  icon,
  iconClass,
  title,
  description,
  cta,
}: {
  href: string;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="bg-card p-6 rounded-xl border border-border/70 shadow-sm hover:border-primary transition-all group flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${iconClass}`}>{icon}</div>
        <h4 className="text-[13px] font-semibold text-foreground mb-1">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="mt-6 flex items-center justify-between text-primary font-semibold text-xs">
        <span>{cta}</span>
        <ArrowRight className="h-[18px] w-[18px] group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}
