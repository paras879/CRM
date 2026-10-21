'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { apiFetch } from '@/lib/api';
import { DashboardSummary, WorkDashboardMetrics } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { getDisplayName } from '@/lib/utils';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  CheckSquare,
  Clock,
  FolderKanban,
  LifeBuoy,
  Users,
  UsersRound,
} from 'lucide-react';
import {
  MetricTile,
  PROGRESS_COLORS,
  PROJECT_STATUS_STYLES,
  formatDeadline,
  titleCase,
} from './staff-dashboard';

const PROJECT_LIMIT = 5;
const WORKLOAD_LIMIT = 5;

interface CrmReport {
  totalLeads: number;
  conversionRate: number;
  leadsByStatus: Record<string, number>;
  followUps: { overdue: number; upcoming: number };
}

interface TeamMember {
  id: string;
  name: string;
  roles: string[];
  openTasks: number;
  overdueTasks: number;
  openTickets: number;
}

const PIPELINE_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];
const STAGE_COLORS: Record<string, string> = {
  NEW: 'bg-slate-400',
  CONTACTED: 'bg-blue-500',
  QUALIFIED: 'bg-indigo-500',
  PROPOSAL: 'bg-amber-500',
  WON: 'bg-emerald-500',
  LOST: 'bg-red-400',
};

const CARD = 'bg-card rounded-xl border border-border/70 shadow-sm p-6 space-y-4';
const CARD_HEAD = 'flex items-start justify-between gap-3 border-b border-border/70 pb-3';
const CARD_TITLE = 'text-lg font-semibold tracking-tight text-foreground flex items-center gap-2';
const CARD_LINK = 'text-primary hover:underline text-xs font-semibold flex items-center gap-1 shrink-0';

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

export function ManagerDashboard() {
  const { user, hasPermission } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [work, setWork] = useState<WorkDashboardMetrics | null>(null);
  const [crm, setCrm] = useState<CrmReport | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canViewReports = hasPermission('reports.view');
  const canViewLeads = hasPermission('leads.view');

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const [sumRes, workRes, crmRes, teamRes] = await Promise.allSettled([
        apiFetch<{ summary: DashboardSummary }>('/dashboard/summary'),
        apiFetch<{ metrics: WorkDashboardMetrics }>('/work-dashboard/metrics'),
        canViewReports && canViewLeads
          ? apiFetch<{ data: CrmReport }>('/reports/crm')
          : Promise.reject(new Error('skipped')),
        apiFetch<{ data: TeamMember[] }>('/users/team'),
      ]);
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.summary);
      if (workRes.status === 'fulfilled') setWork(workRes.value.metrics);
      if (crmRes.status === 'fulfilled') setCrm(crmRes.value.data);
      if (teamRes.status === 'fulfilled') setTeam(teamRes.value.data);
      setIsLoading(false);
    }
    load();
  }, [canViewReports, canViewLeads]);

  const overdueTasks = work?.overdueTasksCount ?? 0;
  const overdueProjects = work?.overdueProjectsCount ?? 0;
  const nearingDeadline = work?.nearingDeadlineProjectsCount ?? 0;
  const slaOverdue = summary?.overdueTickets ?? 0;
  const highPriority = summary?.highPriorityUnresolved ?? 0;
  const overdueFollowUps = crm?.followUps.overdue ?? 0;
  const teamSize = work?.teamSize;

  const attention = [
    hasPermission('tasks.view') && {
      label: 'Overdue tasks',
      count: overdueTasks,
      href: '/work/tasks?filter=overdue',
      severity: 'high',
    },
    hasPermission('projects.view') && {
      label: 'Overdue projects',
      count: overdueProjects,
      href: '/work/projects?status=ACTIVE',
      severity: 'high',
    },
    hasPermission('tickets.view') && {
      label: 'Tickets past SLA',
      count: slaOverdue,
      href: '/support/tickets?isOverdue=true',
      severity: 'high',
    },
    hasPermission('tickets.view') && {
      label: 'High / urgent tickets',
      count: highPriority,
      href: '/support/tickets?priority=HIGH',
      severity: 'medium',
    },
    canViewLeads &&
      crm && {
        label: 'Overdue lead follow-ups',
        count: overdueFollowUps,
        href: '/crm/activities',
        severity: 'medium',
      },
    hasPermission('projects.view') && {
      label: 'Projects due within 7 days',
      count: nearingDeadline,
      href: '/work/projects?status=ACTIVE',
      severity: 'low',
    },
  ].filter(Boolean) as Array<{ label: string; count: number; href: string; severity: 'high' | 'medium' | 'low' }>;

  const attentionTotal = attention.reduce((sum, item) => sum + item.count, 0);
  const SEVERITY_PILL: Record<string, string> = {
    high: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    low: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  };

  const pipelineMax = Math.max(1, ...PIPELINE_STAGES.map((s) => crm?.leadsByStatus[s] ?? 0));
  const pipelineTotal = PIPELINE_STAGES.reduce((sum, s) => sum + (crm?.leadsByStatus[s] ?? 0), 0);

  const workload = [...team]
    .sort((a, b) => b.overdueTasks - a.overdueTasks || b.openTasks - a.openTasks)
    .slice(0, WORKLOAD_LIMIT);
  const workloadMax = Math.max(1, ...team.map((m) => m.openTasks));

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-6 rounded-xl border border-border/70 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h2 className="text-2xl md:text-[28px] font-bold tracking-tight text-foreground">
              Welcome back, {getDisplayName(user)}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300 text-[11px] font-semibold">
              Manager
            </span>
          </div>
          <p className="text-[15px] text-muted-foreground">
            {teamSize
              ? `Leading ${teamSize} ${teamSize === 1 ? 'person' : 'people'} across delivery, sales and support.`
              : 'Team delivery, sales pipeline and support health.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/team"
            className="px-4 py-2 bg-card border border-border/70 hover:bg-secondary/50 text-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <UsersRound className="h-[18px] w-[18px]" /> My Team
          </Link>
          {hasPermission('tasks.view') && (
            <Link
              href="/work/tasks"
              className="px-4 py-2 bg-card border border-border/70 hover:bg-secondary/50 text-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <CheckSquare className="h-[18px] w-[18px]" /> Task Board
            </Link>
          )}
          {canViewReports && (
            <Link
              href="/reports"
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 shadow-sm"
            >
              <BarChart3 className="h-[18px] w-[18px]" /> Reports
            </Link>
          )}
        </div>
      </div>

      {!isLoading && teamSize === 0 && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-4 text-[13px] text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <Users className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">No team members assigned yet</p>
            <p className="text-xs mt-0.5">
              This dashboard shows data for the people who report to you. Ask an administrator to set
              &quot;Reports To&quot; on your staff in Admin &rarr; Users.
            </p>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {hasPermission('projects.view') && (
          <MetricTile
            label="Projects"
            value={work?.activeProjectsCount ?? 0}
            href="/work/projects?status=ACTIVE"
            isLoading={isLoading}
            icon={Briefcase}
            iconClass="text-amber-600 bg-amber-500/10 dark:text-amber-400"
          >
            {overdueProjects > 0 ? (
              <span className="text-red-600 dark:text-red-400">{overdueProjects} overdue</span>
            ) : (
              <span className="text-muted-foreground">All on schedule</span>
            )}
          </MetricTile>
        )}
        {hasPermission('tasks.view') && (
          <MetricTile
            label="Open Tasks"
            value={work?.openTasksCount ?? 0}
            href="/work/tasks"
            isLoading={isLoading}
            icon={CheckSquare}
            iconClass="text-purple-600 bg-purple-500/10 dark:text-purple-400"
          >
            {overdueTasks > 0 ? (
              <span className="text-red-600 dark:text-red-400">{overdueTasks} overdue</span>
            ) : (
              <span className="text-muted-foreground">Nothing overdue</span>
            )}
          </MetricTile>
        )}
        {canViewLeads && (
          <MetricTile
            label="Leads"
            value={summary?.totalLeads ?? 0}
            href="/crm/leads"
            isLoading={isLoading}
            icon={Activity}
            iconClass="text-emerald-600 bg-emerald-500/10 dark:text-emerald-400"
          >
            {crm && <span className="text-muted-foreground">{crm.conversionRate}% conversion</span>}
          </MetricTile>
        )}
        {hasPermission('customers.view') && (
          <MetricTile
            label="Customers"
            value={summary?.totalCustomers ?? 0}
            href="/crm/customers"
            isLoading={isLoading}
            icon={Building2}
            iconClass="text-sky-600 bg-sky-500/10 dark:text-sky-400"
          >
            <span className="text-muted-foreground">Active accounts</span>
          </MetricTile>
        )}
        {hasPermission('tickets.view') && (
          <MetricTile
            label="Open Tickets"
            value={summary?.openTickets ?? 0}
            href="/support/tickets?status=OPEN"
            isLoading={isLoading}
            icon={LifeBuoy}
            iconClass="text-primary bg-primary/10"
          >
            <span className="text-muted-foreground">{summary?.inProgressTickets ?? 0} in progress</span>
          </MetricTile>
        )}
        {hasPermission('tasks.view') && (
          <MetricTile
            label="Logged Hours"
            value={work?.timeTracking.totalHours ?? 0}
            isLoading={isLoading}
            icon={Clock}
            iconClass="text-teal-600 bg-teal-500/10 dark:text-teal-400"
          >
            <span className="text-muted-foreground">{work?.timeTracking.billableHours ?? 0} hrs billable</span>
          </MetricTile>
        )}
      </div>

      {/* Needs attention + team workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div>
              <h3 className={CARD_TITLE}>
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Needs Attention
              </h3>
              <p className="text-xs text-muted-foreground">Late or at-risk items across your team</p>
            </div>
            {!isLoading && attentionTotal > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 text-xs font-semibold">
                {attentionTotal} open
              </span>
            )}
          </div>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : attentionTotal === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm font-semibold text-foreground">All clear</p>
              <p className="text-xs text-muted-foreground">Nothing is late or at risk right now.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {attention.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between py-3 text-[13px] hover:text-primary transition-colors focus:outline-none focus:underline"
                  >
                    <span className={item.count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                      {item.label}
                    </span>
                    <span
                      className={`min-w-[28px] text-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        item.count > 0 ? SEVERITY_PILL[item.severity] : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {item.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div>
              <h3 className={CARD_TITLE}>
                <UsersRound className="h-5 w-5 text-primary" /> Team Workload
              </h3>
              <p className="text-xs text-muted-foreground">Open tasks per person, most overdue first</p>
            </div>
            <Link href="/team" className={CARD_LINK}>
              My Team <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : workload.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No one reports to you yet.
            </div>
          ) : (
            <ul className="space-y-4">
              {workload.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <span className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {initials(m.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-foreground truncate">{m.name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {m.openTasks} open
                        {m.overdueTasks > 0 && (
                          <span className="text-red-600 dark:text-red-400 font-semibold"> &bull; {m.overdueTasks} overdue</span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1.5 w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${m.overdueTasks > 0 ? 'bg-red-500' : 'bg-primary'}`}
                        style={{ width: `${(m.openTasks / workloadMax) * 100}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Project delivery */}
      {hasPermission('projects.view') && (
        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div>
              <h3 className={CARD_TITLE}>
                <FolderKanban className="h-5 w-5 text-primary" /> Project Delivery
              </h3>
              <p className="text-xs text-muted-foreground">Recently updated projects your team works on</p>
            </div>
            <Link href="/work/projects?status=ACTIVE" className={CARD_LINK}>
              All Projects <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !work || work.recentProjects.length === 0 ? (
            <div className="border border-dashed border-border/70 rounded-lg p-8 text-center text-xs text-muted-foreground">
              No active projects yet.
            </div>
          ) : (
            <div className="divide-y divide-border/70 border border-border/70 rounded-lg overflow-hidden">
              {work.recentProjects.slice(0, PROJECT_LIMIT).map((proj, index) => {
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
                      <div className="text-xs text-muted-foreground">
                        {proj.customerName} &bull; {proj.membersCount} members
                      </div>
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
      )}

      {/* Sales pipeline + support health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {canViewLeads && (
          <div className={CARD}>
            <div className={CARD_HEAD}>
              <div>
                <h3 className={CARD_TITLE}>
                  <Building2 className="h-5 w-5 text-primary" /> Sales Pipeline
                </h3>
                <p className="text-xs text-muted-foreground">Your team&apos;s leads by stage</p>
              </div>
              <Link href="/crm/leads" className={CARD_LINK}>
                All Leads <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : !crm || pipelineTotal === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                No leads are owned by your team yet.
              </div>
            ) : (
              <div className="space-y-3">
                {PIPELINE_STAGES.map((stage) => {
                  const count = crm.leadsByStatus[stage] ?? 0;
                  return (
                    <Link
                      key={stage}
                      href="/crm/leads"
                      className="block focus:outline-none focus:ring-2 focus:ring-primary rounded"
                    >
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{titleCase(stage)}</span>
                        <span className="font-semibold text-foreground">{count}</span>
                      </div>
                      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                        <div
                          className={`${STAGE_COLORS[stage]} h-full rounded-full`}
                          style={{ width: `${(count / pipelineMax) * 100}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {hasPermission('tickets.view') && (
          <div className={CARD}>
            <div className={CARD_HEAD}>
              <div>
                <h3 className={CARD_TITLE}>
                  <LifeBuoy className="h-5 w-5 text-primary" /> Support Health
                </h3>
                <p className="text-xs text-muted-foreground">Tickets for your team plus the unassigned queue</p>
              </div>
              <Link href="/support/tickets" className={CARD_LINK}>
                All Tickets <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MetricTile label="Open" value={summary?.openTickets ?? 0} href="/support/tickets?status=OPEN" isLoading={isLoading} />
              <MetricTile
                label="High Priority"
                value={highPriority}
                valueClass="text-red-600 dark:text-red-400"
                href="/support/tickets?priority=HIGH"
                isLoading={isLoading}
              />
              <MetricTile
                label="Overdue SLA"
                value={slaOverdue}
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
