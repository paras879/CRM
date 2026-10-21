'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { apiFetch } from '@/lib/api';
import { DashboardSummary, WorkDashboardMetrics } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StaffDashboard } from '@/components/dashboard/staff-dashboard';
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard';
import { FinanceDashboard } from '@/components/dashboard/finance-dashboard';
import { SupportDashboard } from '@/components/dashboard/support-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { formatDate, getDisplayName, isFinanceUser, isSupportUser } from '@/lib/utils';
import {
  Users,
  ShieldCheck,
  Building2,
  Briefcase,
  Receipt,
  Activity,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  CheckSquare,
  TrendingUp,
  LifeBuoy,
  BookOpen,
  BarChart3,
  Bell,
  AlertTriangle,
  Layers,
  ArrowRight,
  Shield,
} from 'lucide-react';

const DASHBOARD_PROJECT_LIMIT = 3;

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();

  const roleNames = Array.isArray(user?.roles)
    ? user.roles.map((r: any) => (typeof r === 'string' ? r : r.name || '').trim().toLowerCase())
    : [];

  const isAdmin = roleNames.some((r) => r === 'administrator' || r === 'admin' || r === 'superadmin');
  const isManager = !isAdmin && roleNames.some((r) => r.includes('manager'));
  const isStaffMember =
    !isAdmin &&
    !isManager &&
    (roleNames.some((r) => r.includes('staff')) ||
      (!hasPermission('users.view') && !hasPermission('roles.view') && !hasPermission('invoices.view')));

  if (isAdmin) return <AdminDashboard />;
  if (isManager) return <ManagerDashboard />;
  if (isFinanceUser(user)) return <FinanceDashboard />;
  if (isSupportUser(user)) return <SupportDashboard />;
  if (isStaffMember) return <StaffDashboard />;
  return <OverviewDashboard />;
}

function OverviewDashboard() {
  const { user, hasPermission } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [workMetrics, setWorkMetrics] = useState<WorkDashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const primaryRole =
    Array.isArray(user?.roles) && user.roles.length > 0
      ? typeof user.roles[0] === 'string'
        ? user.roles[0]
        : (user.roles[0] as any).name
      : 'Staff Member';

  const isAdmin =
    primaryRole === 'Administrator' ||
    (Array.isArray(user?.roles) &&
      user.roles.some((r: any) => (typeof r === 'string' ? r : r.name) === 'Administrator'));

  const isStaffMember =
    !isAdmin &&
    !hasPermission('users.view') &&
    !hasPermission('roles.view') &&
    !hasPermission('invoices.view');

  useEffect(() => {
    async function loadMetrics() {
      try {
        setIsLoading(true);
        const [sumRes, workRes] = await Promise.allSettled([
          apiFetch<{ summary: DashboardSummary }>('/dashboard/summary'),
          apiFetch<{ metrics: WorkDashboardMetrics }>('/work-dashboard/metrics'),
        ]);

        if (sumRes.status === 'fulfilled') {
          setSummary(sumRes.value.summary);
        }
        if (workRes.status === 'fulfilled') {
          setWorkMetrics(workRes.value.metrics);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard metrics');
      } finally {
        setIsLoading(false);
      }
    }
    loadMetrics();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back, {getDisplayName(user)}
            </h2>
            <Badge
              variant="outline"
              className={
                isAdmin
                  ? 'border-primary/50 text-primary bg-primary/10 text-xs font-semibold'
                  : 'border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10 text-xs font-semibold'
              }
            >
              {primaryRole}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isStaffMember ? (
              <>
                Personal workspace &bull; Active tasks and deliveries for{' '}
                <span className="font-semibold text-foreground">{user?.company?.name || 'Your Company'}</span>
              </>
            ) : (
              <>
                System overview for{' '}
                <span className="font-semibold text-foreground">{user?.company?.name || 'Your Company'}</span> &bull; CRM, Sales, Projects, Support & Reports
              </>
            )}
          </p>
        </div>

        {/* Quick Action Buttons (Filtered by User Permissions) */}
        <div className="flex flex-wrap items-center gap-2">
          {hasPermission('tasks.view') && (
            <Link href={isStaffMember ? '/work/tasks?filter=my' : '/work/tasks'}>
              <Button size="sm" variant="outline" className="gap-1.5 border-border/70 text-foreground">
                <CheckSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span>{isStaffMember ? 'My Tasks' : 'Task Board'}</span>
              </Button>
            </Link>
          )}
          {hasPermission('projects.view') && (
            <Link href="/work/projects?status=ACTIVE">
              <Button size="sm" variant="outline" className="gap-1.5 border-border/70 text-foreground">
                <Briefcase className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>Projects</span>
              </Button>
            </Link>
          )}
          {hasPermission('tickets.view') && (
            <Link href="/support/tickets">
              <Button size="sm" variant="outline" className="gap-1.5 border-border/70 text-foreground">
                <LifeBuoy className="h-4 w-4 text-primary" />
                <span>Support Desk</span>
              </Button>
            </Link>
          )}
          {hasPermission('leads.view') && (
            <Link href="/crm/leads">
              <Button size="sm" variant="outline" className="gap-1.5 border-border/70 text-foreground">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>CRM Leads</span>
              </Button>
            </Link>
          )}
          {hasPermission('reports.view') && (
            <Link href="/reports">
              <Button size="sm" variant="outline" className="gap-1.5 border-border/70 text-foreground">
                <BarChart3 className="h-4 w-4 text-emerald-500" />
                <span>Reports</span>
              </Button>
            </Link>
          )}
          {hasPermission('users.view') && (
            <Link href="/admin/users">
              <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Users className="h-4 w-4" />
                <span>Staff Users</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Role-Aware KPI Cards Grid (Clickable with Hover Lift & Keyboard Focus) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Active Staff Users — Only for Authorized Users */}
        {hasPermission('users.view') && summary?.activeUsers !== null && summary?.activeUsers !== undefined && (
          <Link href="/admin/users" className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl">
            <Card className="h-full border-border/70 bg-card hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Staff Users</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">{summary.activeUsers}</div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                  <span>Manage staff</span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </p>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Roles — Only for Authorized Users */}
        {hasPermission('roles.view') && summary?.totalRoles !== null && summary?.totalRoles !== undefined && (
          <Link href="/admin/roles" className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl">
            <Card className="h-full border-border/70 bg-card hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">System Roles</CardTitle>
                <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">{summary.totalRoles}</div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                  <span>RBAC permissions</span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </p>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Leads — Only for Authorized Users */}
        {hasPermission('leads.view') && summary?.totalLeads !== null && summary?.totalLeads !== undefined && (
          <Link href="/crm/leads" className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl">
            <Card className="h-full border-border/70 bg-card hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">CRM Leads</CardTitle>
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">{summary.totalLeads}</div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                  <span>Pipeline prospects</span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </p>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Customers — Only for Authorized Users */}
        {hasPermission('customers.view') && summary?.totalCustomers !== null && summary?.totalCustomers !== undefined && (
          <Link href="/crm/customers" className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl">
            <Card className="h-full border-border/70 bg-card hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Customers</CardTitle>
                <Building2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">{summary.totalCustomers}</div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                  <span>Active client accounts</span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </p>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Projects — Scoped to User for Staff, Company-wide for Admin */}
        {hasPermission('projects.view') && (
          <Link
            href="/work/projects?status=ACTIVE"
            className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl"
          >
            <Card className="h-full border-border/70 bg-card hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {workMetrics?.isScopedToUser ? 'My Projects' : 'Active Projects'}
                </CardTitle>
                <Briefcase className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">
                    {workMetrics?.activeProjectsCount ?? summary?.totalProjects ?? 0}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                  <span>
                    {workMetrics?.overdueProjectsCount ? (
                      <span className="text-rose-600 dark:text-rose-400 font-medium">{workMetrics.overdueProjectsCount} overdue</span>
                    ) : workMetrics?.isScopedToUser ? (
                      'Assigned active projects'
                    ) : (
                      'Deliverables tracking'
                    )}
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </p>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Open Tasks — Scoped to User for Staff, Company-wide for Admin */}
        {hasPermission('tasks.view') && (
          <Link
            href={workMetrics?.isScopedToUser ? '/work/tasks?filter=my' : '/work/tasks'}
            className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl"
          >
            <Card className="h-full border-border/70 bg-card hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {workMetrics?.isScopedToUser ? 'My Open Tasks' : 'Open Tasks'}
                </CardTitle>
                <CheckSquare className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">
                    {workMetrics?.isScopedToUser
                      ? workMetrics.assignedTasksCount ?? workMetrics.openTasksCount
                      : workMetrics?.openTasksCount ?? 0}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                  <span>
                    {workMetrics?.isScopedToUser ? (
                      'Assigned to you'
                    ) : workMetrics?.assignedTasksCount ? (
                      <span className="text-primary font-medium">{workMetrics.assignedTasksCount} assigned to you</span>
                    ) : (
                      'Sprint tasks'
                    )}
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </p>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Invoices — Only for Authorized Roles */}
        {hasPermission('invoices.view') && summary?.totalInvoices !== null && summary?.totalInvoices !== undefined && (
          <Link href="/finance/invoices" className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl">
            <Card className="h-full border-border/70 bg-card hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Invoices</CardTitle>
                <Receipt className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-foreground">{summary.totalInvoices}</div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                  <span>Billing records</span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                </p>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Project Management & Delivery Metrics Strip (All Cards Clickable) */}
      {hasPermission('projects.view') && workMetrics && (
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3 border-b border-border/70 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-primary" />{' '}
                {workMetrics.isScopedToUser ? 'My Project Deliveries & Task Schedule' : 'Project Delivery & Task Performance'}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {workMetrics.isScopedToUser
                  ? 'Personal metrics for projects and tasks assigned to your account'
                  : 'Live metrics aggregated from project milestones, tasks, and tracked hours'}
              </CardDescription>
            </div>
            <Link href="/work/projects?status=ACTIVE">
              <Button variant="outline" size="sm" className="h-8 text-xs border-border/70 text-foreground gap-1">
                All Projects <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Active Projects Card (Clickable) */}
              <Link
                href="/work/projects?status=ACTIVE"
                className="block p-3 rounded-lg bg-secondary/30 border border-border/50 hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <span className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>{workMetrics.isScopedToUser ? 'My Active Projects' : 'Active Projects'}</span>
                  <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                </span>
                <span className="text-xl font-bold text-foreground mt-1 block">
                  {workMetrics.activeProjectsCount}
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400">In execution</span>
              </Link>

              {/* Nearing Deadline Card (Clickable) */}
              <Link
                href="/work/tasks?filter=dueSoon"
                className="block p-3 rounded-lg bg-secondary/30 border border-border/50 hover:border-amber-400/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <span className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>Nearing Deadline</span>
                  <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                </span>
                <span className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 block">
                  {workMetrics.nearingDeadlineProjectsCount}
                </span>
                <span className="text-[10px] text-muted-foreground">Due within 7 days</span>
              </Link>

              {/* Overdue Tasks Card (Clickable) */}
              <Link
                href="/work/tasks?filter=overdue"
                className="block p-3 rounded-lg bg-secondary/30 border border-border/50 hover:border-rose-400/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-400"
              >
                <span className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>Overdue Tasks</span>
                  <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                </span>
                <span className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 block">
                  {workMetrics.overdueTasksCount}
                </span>
                <span className="text-[10px] text-rose-600 dark:text-rose-400">Needs attention</span>
              </Link>

              {/* Tracked Hours Card (Clickable) */}
              <Link
                href="/work/projects"
                className="block p-3 rounded-lg bg-secondary/30 border border-border/50 hover:border-emerald-400/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <span className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>{workMetrics.isScopedToUser ? 'My Logged Hours' : 'Tracked Hours'}</span>
                  <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                </span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {workMetrics.timeTracking.totalHours} hrs
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  {workMetrics.timeTracking.billableHours} hrs billable
                </span>
              </Link>
            </div>

            {/* Recent Projects List with Progress */}
            {workMetrics.recentProjects && workMetrics.recentProjects.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  {workMetrics.isScopedToUser ? 'My Active Projects & Progress' : 'Recently Updated Projects'}
                </h4>
                <div className="divide-y divide-border/60">
                  {workMetrics.recentProjects.slice(0, DASHBOARD_PROJECT_LIMIT).map((proj) => (
                    <div
                      key={proj.id}
                      className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <Link
                          href={`/work/projects/${proj.id}`}
                          className="text-xs font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5 focus:outline-none focus:underline"
                        >
                          {proj.name}
                          <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                        </Link>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>Client: {proj.customerName}</span>
                          <span>&bull;</span>
                          <span>{proj.totalTasks} tasks</span>
                          <span>&bull;</span>
                          <span>{proj.membersCount} members</span>
                        </p>
                      </div>

                      <div className="w-full sm:w-48 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-semibold text-foreground">{proj.progress}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${
                              proj.progress === 100
                                ? 'bg-emerald-500'
                                : proj.progress >= 50
                                ? 'bg-primary'
                                : 'bg-blue-400'
                            }`}
                            style={{ width: `${proj.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {workMetrics.recentProjects.length > DASHBOARD_PROJECT_LIMIT && (
                  <div className="pt-1">
                    <Link href="/work/projects">
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                        More projects <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Support Desk & Operational Insights Strip (All Cards Clickable) */}
      {hasPermission('tickets.view') && (
        <Card className="border-border/70 bg-card">
          <CardHeader className="pb-3 border-b border-border/70 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-primary" />{' '}
                {isStaffMember ? 'Support Desk & Assigned Tickets' : 'Support Desk & Operations Center'}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {isStaffMember
                  ? 'Customer tickets assigned to your queue, SLA monitoring, and documentation'
                  : 'Live customer ticket pipeline, SLA compliance, knowledge base, and automated alerts'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasPermission('reports.view') && (
                <Link href="/reports?tab=support">
                  <Button variant="outline" size="sm" className="h-8 text-xs border-border/70 text-foreground gap-1">
                    <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
                    Support Analytics
                  </Button>
                </Link>
              )}
              <Link href="/support/tickets">
                <Button size="sm" className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1">
                  All Tickets <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Open Tickets */}
              <Link href="/support/tickets?status=OPEN" className="block focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg">
                <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer">
                  <span className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>Open Tickets</span>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                  </span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1 block">
                    {summary?.openTickets ?? 0}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Awaiting resolution</span>
                </div>
              </Link>

              {/* High Priority */}
              <Link href="/support/tickets?priority=HIGH" className="block focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg">
                <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer">
                  <span className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>High Priority</span>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                  </span>
                  <span className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 block">
                    {summary?.highPriorityUnresolved ?? 0}
                  </span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">High / Urgent queue</span>
                </div>
              </Link>

              {/* Overdue SLA */}
              <Link href="/support/tickets?isOverdue=true" className="block focus:outline-none focus:ring-2 focus:ring-rose-500 rounded-lg">
                <div className="p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer">
                  <span className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>Overdue SLA</span>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                  </span>
                  <span className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 block">
                    {summary?.overdueTickets ?? 0}
                  </span>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400">SLA deadline passed</span>
                </div>
              </Link>

              {/* Customer Pending */}
              <Link href="/support/tickets?status=WAITING_ON_CUSTOMER" className="block focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg">
                <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer">
                  <span className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>Customer Pending</span>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                  </span>
                  <span className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1 block">
                    {summary?.waitingOnCustomer ?? 0}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Waiting on reply</span>
                </div>
              </Link>

              {/* Published Articles (if KB permitted) */}
              {hasPermission('kb.view') ? (
                <Link href="/knowledge-base" className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer">
                    <span className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>Articles</span>
                      <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                    </span>
                    <span className="text-xl font-bold text-foreground mt-1 block">
                      {summary?.publishedArticles ?? 0}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Knowledge Base</span>
                  </div>
                </Link>
              ) : (
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <span className="text-xs text-muted-foreground block">In Progress</span>
                  <span className="text-xl font-bold text-foreground mt-1 block">
                    {summary?.inProgressTickets ?? 0}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Active tickets</span>
                </div>
              )}

              {/* Unread Alerts (informational; notifications live in the topbar bell) */}
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                <span className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>Unread Alerts</span>
                  <Bell className="w-3 h-3 text-primary" />
                </span>
                <span className="text-xl font-bold text-primary mt-1 block">
                  {summary?.unreadNotifications ?? 0}
                </span>
                <span className="text-[10px] text-muted-foreground">Open the bell for details</span>
              </div>
            </div>

            {/* Quick Reports Navigation — Only Rendered for Users with Reports Permission */}
            {hasPermission('reports.view') && (
              <div className="pt-2 border-t border-border/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-primary" /> Reports & Analytics Hub:
                  </span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {hasPermission('leads.view') && (
                      <Link
                        href="/reports?tab=crm"
                        className="px-2.5 py-1 rounded-md bg-secondary/60 hover:bg-secondary text-foreground transition-colors"
                      >
                        CRM & Conversion &rarr;
                      </Link>
                    )}
                    {hasPermission('projects.view') && (
                      <Link
                        href="/reports?tab=projects"
                        className="px-2.5 py-1 rounded-md bg-secondary/60 hover:bg-secondary text-foreground transition-colors"
                      >
                        Projects & Tasks &rarr;
                      </Link>
                    )}
                    {hasPermission('invoices.view') && (
                      <Link
                        href="/reports?tab=finance"
                        className="px-2.5 py-1 rounded-md bg-secondary/60 hover:bg-secondary text-foreground transition-colors"
                      >
                        Finance & Cashflow &rarr;
                      </Link>
                    )}
                    <Link
                      href="/reports?tab=support"
                      className="px-2.5 py-1 rounded-md bg-secondary/60 hover:bg-secondary text-foreground transition-colors"
                    >
                      Support Resolution &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Phase Status or Staff Shortcuts & Audit Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Admin Architecture or Staff Quick Actions */}
        <div className={hasPermission('audit.view') && summary?.recentActivity && summary.recentActivity.length > 0 ? 'lg:col-span-2 space-y-6' : 'lg:col-span-3 space-y-6'}>
          {hasPermission('company.view') || hasPermission('roles.view') ? (
            <Card className="border-border/70 bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-foreground">
                      Platform Capabilities: Support, Knowledge Base, Notifications & Reports
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      End-to-end multi-tenant CRM with sales pipeline, project delivery, ticket desk and analytics
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-lg border border-border/70 bg-secondary/20">
                    <span className="font-semibold text-xs text-foreground block mb-1">
                      🎫 Support Ticket Desk
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Ticket numbering, SLA due monitoring, private internal staff notes vs public replies, conversation timeline, and category routing.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg border border-border/70 bg-secondary/20">
                    <span className="font-semibold text-xs text-foreground block mb-1">
                      📚 Knowledge Base & Slug Engine
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Draft/published lifecycle, category and tag associations, unique collision-safe slugs, and Markdown article viewer.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg border border-border/70 bg-secondary/20">
                    <span className="font-semibold text-xs text-foreground block mb-1">
                      🔔 Notification Center
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Live unread counter badge, mark-as-read per notification or in bulk, and deep links to relevant CRM records.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg border border-border/70 bg-secondary/20">
                    <span className="font-semibold text-xs text-foreground block mb-1">
                      📊 Comprehensive Reports & CSV Export
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Real aggregate metrics across CRM, Projects, Finance (currency-separated), and Support with CSV formula injection protection.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/70 bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-foreground flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" /> Staff Member Workspace & Operational Shortcuts
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Quick navigation to your authorized workflows, deliverables, and team communications
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs font-medium">
                    Staff Portal
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {hasPermission('tasks.view') && (
                    <Link
                      href="/work/tasks?filter=my"
                      className="p-3.5 rounded-lg border border-border/70 bg-secondary/20 hover:border-primary/60 hover:bg-secondary/40 transition-all group focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" /> My Assigned Tasks
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        View tasks assigned to you, update task statuses, log time entries and collaborate with team members.
                      </p>
                    </Link>
                  )}

                  {hasPermission('projects.view') && (
                    <Link
                      href="/work/projects?status=ACTIVE"
                      className="p-3.5 rounded-lg border border-border/70 bg-secondary/20 hover:border-primary/60 hover:bg-secondary/40 transition-all group focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Active Project Memberships
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Access projects where you are a member, review milestone timelines, and inspect delivery specs.
                      </p>
                    </Link>
                  )}

                  {hasPermission('tickets.view') && (
                    <Link
                      href="/support/tickets"
                      className="p-3.5 rounded-lg border border-border/70 bg-secondary/20 hover:border-primary/60 hover:bg-secondary/40 transition-all group focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <LifeBuoy className="w-4 h-4 text-primary" /> Support Help Desk
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Review customer support tickets and reply to the ones assigned to you.
                      </p>
                    </Link>
                  )}

                  {hasPermission('kb.view') && (
                    <Link
                      href="/knowledge-base"
                      className="p-3.5 rounded-lg border border-border/70 bg-secondary/20 hover:border-primary/60 hover:bg-secondary/40 transition-all group focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Knowledge Base & Guides
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Read documentation, standard operating procedures, and product guides.
                      </p>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right 1 Col: Audit Log Activity — Only for Users with audit.view Permission */}
        {hasPermission('audit.view') && summary?.recentActivity && summary.recentActivity.length > 0 && (
          <div className="space-y-6">
            <Card className="border-border/70 bg-card">
              <CardHeader className="pb-3 border-b border-border/70">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">Audit Trail</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">Recent system mutations</CardDescription>
                  </div>
                  <Link
                    href="/admin/audit-logs"
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    View All
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {summary.recentActivity.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-border/50 bg-secondary/20 text-xs"
                      >
                        <div>
                          <span className="font-medium text-foreground block">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {log.actor?.name || 'System'} &bull; {log.entityType}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
