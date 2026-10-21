'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { apiFetch } from '@/lib/api';
import { DashboardSummary, FinancialSummary, SupportOverview, WorkDashboardMetrics } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate, getDisplayName } from '@/lib/utils';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  History,
  LifeBuoy,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  UserCog,
} from 'lucide-react';
import { MetricTile } from './staff-dashboard';

interface UserStats {
  total: number;
  active: number;
  invited: number;
  disabled: number;
  neverSignedIn: number;
  staleInvites: number;
  withoutManager: number;
  byRole: Array<{ role: string; count: number }>;
}

const CARD = 'bg-card rounded-xl border border-border/70 shadow-sm p-6 space-y-4';
const CARD_HEAD = 'flex items-start justify-between gap-3 border-b border-border/70 pb-3';
const CARD_TITLE = 'text-lg font-semibold tracking-tight text-foreground flex items-center gap-2';
const CARD_LINK = 'text-primary hover:underline text-xs font-semibold flex items-center gap-1 shrink-0';

const ROLE_BAR_COLORS = ['bg-indigo-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500'];

/** "USER_CREATED" -> "User created" */
function readableAction(action: string): string {
  const text = action.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.max(0, Math.min(100, Math.round((part / whole) * 100))) : 100;
}

export function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [work, setWork] = useState<WorkDashboardMetrics | null>(null);
  const [finance, setFinance] = useState<FinancialSummary | null>(null);
  const [support, setSupport] = useState<SupportOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [statsRes, summaryRes, workRes, financeRes, supportRes] = await Promise.allSettled([
        apiFetch<{ data: UserStats }>('/users/stats'),
        apiFetch<{ summary: DashboardSummary }>('/dashboard/summary'),
        apiFetch<{ metrics: WorkDashboardMetrics }>('/work-dashboard/metrics'),
        apiFetch<{ data: FinancialSummary }>('/finance-dashboard/summary'),
        apiFetch<{ data: SupportOverview }>('/tickets/overview'),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.summary);
      if (workRes.status === 'fulfilled') setWork(workRes.value.metrics);
      if (financeRes.status === 'fulfilled') setFinance(financeRes.value.data);
      if (supportRes.status === 'fulfilled') setSupport(supportRes.value.data);
      setIsLoading(false);
    }
    load();
  }, []);

  // Money: show the first currency; a company that bills in several gets a hint instead of a wrong sum.
  const currencies = finance ? Object.keys(finance.currencyMetrics) : [];
  const currency = currencies[0] ?? 'INR';
  const money = finance?.currencyMetrics[currency];
  const extraCurrencies = Math.max(0, currencies.length - 1);

  const overdueInvoices = finance?.actionNeeded.overdueInvoiceCount ?? 0;
  const pendingExpenses = finance?.actionNeeded.pendingExpenseCount ?? 0;
  const expiringContracts = finance?.expiringContracts.length ?? 0;
  const ticketsLate = support?.counts.overdue ?? 0;
  const overdueTasks = work?.overdueTasksCount ?? 0;
  const overdueProjects = work?.overdueProjectsCount ?? 0;

  const attention = [
    { label: 'Overdue invoices', hint: 'Unpaid past the due date', count: overdueInvoices, href: '/finance/invoices?status=OVERDUE', tone: 'high' },
    { label: 'Tickets past their deadline', hint: 'SLA or due date has passed', count: ticketsLate, href: '/support/tickets?isOverdue=true', tone: 'high' },
    { label: 'Overdue projects', hint: 'Past their deadline and still open', count: overdueProjects, href: '/work/projects?status=ACTIVE', tone: 'high' },
    { label: 'Overdue tasks', hint: 'Open tasks past their due date', count: overdueTasks, href: '/work/tasks?filter=overdue', tone: 'medium' },
    { label: 'Expenses awaiting approval', hint: 'Waiting for a decision', count: pendingExpenses, href: '/finance/expenses?approvalStatus=PENDING', tone: 'medium' },
    { label: 'Invitations not accepted', hint: 'Invited over a week ago', count: stats?.staleInvites ?? 0, href: '/admin/users', tone: 'medium' },
    { label: 'Staff without a manager', hint: 'Nobody sees their work', count: stats?.withoutManager ?? 0, href: '/admin/users', tone: 'low' },
    { label: 'Contracts expiring soon', hint: 'Ending within 30 days', count: expiringContracts, href: '/sales/contracts', tone: 'low' },
  ];
  const attentionTotal = attention.reduce((sum, a) => sum + a.count, 0);
  const TONE: Record<string, string> = {
    high: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    low: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  };

  const collection = money ? percent(money.totalReceived, money.totalInvoiced) : 0;
  const activeProjects = work?.activeProjectsCount ?? 0;
  const activeTickets = support
    ? support.counts.open + support.counts.inProgress + support.counts.waitingOnCustomer
    : 0;
  const health = [
    { label: 'Invoices collected', value: collection, detail: `${collection}%`, href: '/finance/dashboard', bar: 'bg-emerald-500' },
    {
      label: 'Projects on schedule',
      value: percent(activeProjects - overdueProjects, activeProjects),
      detail: activeProjects > 0 ? `${Math.max(0, activeProjects - overdueProjects)} of ${activeProjects}` : 'No active projects',
      href: '/work/projects?status=ACTIVE',
      bar: 'bg-indigo-500',
    },
    {
      label: 'Tickets within deadline',
      value: percent(activeTickets - ticketsLate, activeTickets),
      detail: activeTickets > 0 ? `${Math.max(0, activeTickets - ticketsLate)} of ${activeTickets}` : 'No open tickets',
      href: '/support/tickets',
      bar: 'bg-sky-500',
    },
    {
      label: 'Open tasks on time',
      value: percent((work?.openTasksCount ?? 0) - overdueTasks, work?.openTasksCount ?? 0),
      detail: (work?.openTasksCount ?? 0) > 0 ? `${Math.max(0, (work?.openTasksCount ?? 0) - overdueTasks)} of ${work?.openTasksCount}` : 'No open tasks',
      href: '/work/tasks',
      bar: 'bg-purple-500',
    },
  ];

  const roleMax = Math.max(1, ...(stats?.byRole ?? []).map((r) => r.count));

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-6 rounded-xl border border-border/70 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h2 className="text-2xl md:text-[28px] font-bold tracking-tight text-foreground">
              Welcome back, {getDisplayName(user)}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
              {user?.isSuperAdmin ? 'Super Admin' : 'Administrator'}
            </span>
          </div>
          <p className="text-[15px] text-muted-foreground">
            {isLoading
              ? 'Your company at a glance: people, work, money and support.'
              : attentionTotal > 0
              ? `${attentionTotal} item${attentionTotal === 1 ? ' needs' : 's need'} your attention across ${user?.company?.name || 'your company'}.`
              : `Everything is on track at ${user?.company?.name || 'your company'}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:flex-nowrap md:shrink-0">
          <Link
            href="/admin/audit-logs"
            className="px-4 py-2 bg-card border border-border/70 hover:bg-secondary/50 text-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <History className="h-[18px] w-[18px]" /> Audit Logs
          </Link>
          <Link
            href="/admin/settings"
            className="px-4 py-2 bg-card border border-border/70 hover:bg-secondary/50 text-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <Settings className="h-[18px] w-[18px]" /> Settings
          </Link>
          <Link
            href="/admin/users"
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="h-[18px] w-[18px]" /> Add User
          </Link>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricTile
          label="Active Users"
          value={stats?.active ?? summary?.activeUsers ?? 0}
          href="/admin/users"
          isLoading={isLoading}
          icon={Users}
          iconClass="text-primary bg-primary/10"
        >
          <span className="text-muted-foreground">
            {stats ? `${stats.invited} invited • ${stats.disabled} disabled` : 'Staff accounts'}
          </span>
        </MetricTile>
        <MetricTile
          label="Customers"
          value={summary?.totalCustomers ?? 0}
          href="/crm/customers"
          isLoading={isLoading}
          icon={Building2}
          iconClass="text-sky-600 bg-sky-500/10 dark:text-sky-400"
        >
          <span className="text-muted-foreground">{summary?.totalLeads ?? 0} leads in the pipeline</span>
        </MetricTile>
        <MetricTile
          label="Active Projects"
          value={activeProjects}
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
        <MetricTile
          label="Open Tickets"
          value={activeTickets}
          href="/support/tickets"
          isLoading={isLoading}
          icon={LifeBuoy}
          iconClass="text-primary bg-primary/10"
        >
          {ticketsLate > 0 ? (
            <span className="text-red-600 dark:text-red-400">{ticketsLate} past deadline</span>
          ) : (
            <span className="text-muted-foreground">{support?.counts.unassigned ?? 0} unassigned</span>
          )}
        </MetricTile>
        <MetricTile
          label="Outstanding"
          value={formatCurrency(money?.outstandingBalance ?? 0, currency)}
          valueClass="text-amber-600 dark:text-amber-400"
          href="/finance/invoices"
          isLoading={isLoading}
          icon={Banknote}
          iconClass="text-amber-600 bg-amber-500/10 dark:text-amber-400"
        >
          <span className="text-muted-foreground">
            {extraCurrencies > 0 ? `${currency} only, +${extraCurrencies} more` : 'Still to collect'}
          </span>
        </MetricTile>
        <MetricTile
          label="Overdue"
          value={formatCurrency(money?.overdueAmount ?? 0, currency)}
          valueClass={(money?.overdueAmount ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}
          href="/finance/invoices?status=OVERDUE"
          isLoading={isLoading}
          icon={AlertTriangle}
          iconClass="text-red-600 bg-red-500/10 dark:text-red-400"
        >
          <span className="text-muted-foreground">{overdueInvoices} invoice{overdueInvoices === 1 ? '' : 's'}</span>
        </MetricTile>
      </div>

      {/* Needs attention + people & access */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div>
              <h3 className={CARD_TITLE}>
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Needs Attention
              </h3>
              <p className="text-xs text-muted-foreground">Across every team, most serious first</p>
            </div>
            {!isLoading && attentionTotal > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 text-xs font-semibold">
                {attentionTotal} open
              </span>
            )}
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : attentionTotal === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm font-semibold text-foreground">All clear</p>
              <p className="text-xs text-muted-foreground">Nothing is late, waiting or unowned.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {attention.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 py-2.5 hover:text-primary transition-colors focus:outline-none focus:underline"
                  >
                    <span>
                      <span className={`block text-[13px] ${item.count > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                        {item.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">{item.hint}</span>
                    </span>
                    <span
                      className={`min-w-[28px] text-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        item.count > 0 ? TONE[item.tone] : 'bg-secondary text-muted-foreground'
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
                <UserCog className="h-5 w-5 text-primary" /> People &amp; Access
              </h3>
              <p className="text-xs text-muted-foreground">Who can sign in, and as what</p>
            </div>
            <Link href="/admin/roles" className={CARD_LINK}>
              Roles <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !stats ? (
            <p className="py-12 text-center text-xs text-muted-foreground">Account data is unavailable.</p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Active', value: stats.active, tone: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Invited', value: stats.invited, tone: 'text-amber-600 dark:text-amber-400' },
                  { label: 'Disabled', value: stats.disabled, tone: 'text-muted-foreground' },
                ].map((s) => (
                  <Link
                    key={s.label}
                    href="/admin/users"
                    className="rounded-lg border border-border/70 bg-secondary/30 p-3 hover:border-primary/50 transition-colors"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-bold tracking-tight mt-1 ${s.tone}`}>{s.value}</p>
                  </Link>
                ))}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Active users by role</p>
                <ul className="space-y-3">
                  {stats.byRole.map((r, i) => (
                    <li key={r.role}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground font-medium">{r.role}</span>
                        <span className="font-semibold text-foreground">{r.count}</span>
                      </div>
                      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                        <div
                          className={`${ROLE_BAR_COLORS[i % ROLE_BAR_COLORS.length]} h-full rounded-full`}
                          style={{ width: `${(r.count / roleMax) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              {stats.neverSignedIn > 0 && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {stats.neverSignedIn} active account{stats.neverSignedIn === 1 ? ' has' : 's have'} never signed in.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Business health + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div>
              <h3 className={CARD_TITLE}>
                <Activity className="h-5 w-5 text-primary" /> Business Health
              </h3>
              <p className="text-xs text-muted-foreground">How well each area is keeping up</p>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <ul className="space-y-4">
              {health.map((h) => (
                <li key={h.label}>
                  <Link href={h.href} className="block focus:outline-none focus:ring-2 focus:ring-primary rounded">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground font-medium">{h.label}</span>
                      <span className="text-muted-foreground">
                        <span className="font-semibold text-foreground">{h.value}%</span> &bull; {h.detail}
                      </span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div className={`${h.bar} h-full rounded-full`} style={{ width: `${h.value}%` }} />
                    </div>
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
                <ShieldCheck className="h-5 w-5 text-primary" /> Recent Activity
              </h3>
              <p className="text-xs text-muted-foreground">The latest changes made in the system</p>
            </div>
            <Link href="/admin/audit-logs" className={CARD_LINK}>
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !summary?.recentActivity || summary.recentActivity.length === 0 ? (
            <p className="py-12 text-center text-xs text-muted-foreground">No activity has been recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {summary.recentActivity.map((log) => (
                <li key={log.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{readableAction(log.action)}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {log.actor?.name || 'System'} &bull; {log.entityType}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatDate(log.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
