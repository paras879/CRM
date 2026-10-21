'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { CrmDashboardMetrics } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Building2,
  TrendingUp,
  CalendarClock,
  AlertCircle,
  Plus,
  ArrowRight,
  Clock,
  DollarSign,
  ChevronRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export default function CrmDashboardPage() {
  const { hasPermission } = useAuth();
  // Deal values are revenue data: only roles that manage leads see them
  const canSeeValues = hasPermission('leads.update');
  const router = useRouter();
  const [metrics, setMetrics] = useState<CrmDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(30);
  // A custom range replaces the preset buttons while it is applied.
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const draftValid = draftFrom !== '' && draftTo !== '' && draftFrom <= draftTo;

  const fetchMetrics = async (days: number, range: { from: string; to: string } | null) => {
    try {
      setLoading(true);
      const query = range ? `startDate=${range.from}&endDate=${range.to}` : `days=${days}`;
      const res = await apiFetch<{ metrics: CrmDashboardMetrics }>(`/crm-dashboard/metrics?${query}`);
      setMetrics(res.metrics);
    } catch (err) {
      console.error('Failed to load CRM dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics(periodDays, customRange);
  }, [periodDays, customRange]);

  const formatRangeDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            CRM Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time pipeline performance, lead conversions, and pending follow-ups.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="relative">
            <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-secondary/60 p-1 text-xs">
              {[
                { label: '7 Days', val: 7 },
                { label: '30 Days', val: 30 },
                { label: '90 Days', val: 90 },
                { label: 'All Time', val: 0 },
              ].map((p) => (
                <button
                  key={p.val}
                  onClick={() => {
                    setCustomRange(null);
                    setPickerOpen(false);
                    setPeriodDays(p.val);
                  }}
                  className={`rounded-md px-3 py-1 font-medium transition-all ${
                    !customRange && periodDays === p.val
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setDraftFrom(customRange?.from ?? '');
                  setDraftTo(customRange?.to ?? '');
                  setPickerOpen((open) => !open);
                }}
                aria-expanded={pickerOpen}
                className={`rounded-md px-3 py-1 font-medium transition-all ${
                  customRange
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {customRange ? `${formatRangeDate(customRange.from)} - ${formatRangeDate(customRange.to)}` : 'Custom'}
              </button>
            </div>

            {pickerOpen && (
              <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-border bg-card p-4 shadow-xl space-y-3 animate-in fade-in-0 zoom-in-95">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-medium text-foreground">
                    From
                    <input
                      type="date"
                      value={draftFrom}
                      max={draftTo || today}
                      onChange={(e) => setDraftFrom(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="text-xs font-medium text-foreground">
                    To
                    <input
                      type="date"
                      value={draftTo}
                      min={draftFrom || undefined}
                      max={today}
                      onChange={(e) => setDraftTo(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    />
                  </label>
                </div>
                {draftFrom && draftTo && draftFrom > draftTo && (
                  <p className="text-[11px] text-destructive">The start date must be on or before the end date.</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!draftValid}
                    onClick={() => {
                      setCustomRange({ from: draftFrom, to: draftTo });
                      setPickerOpen(false);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Link href="/crm/leads">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              New Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards - All Clickable with Hover Lift */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Pipeline Card */}
        <Link href="/crm/leads" className="group block">
          <Card className="h-full border-border/70 bg-card hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Active Leads
              </CardTitle>
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {metrics?.totalActiveLeads ?? 0}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      +{metrics?.newLeadsInPeriod ?? 0} new in period
                    </span>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
                      View leads <ChevronRight className="h-3 w-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Total Customers Card */}
        <Link href="/crm/customers" className="group block">
          <Card className="h-full border-border/70 bg-card hover:border-indigo-500/60 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Total Customers
              </CardTitle>
              <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
                <Building2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {metrics?.totalCustomers ?? 0}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      <strong className="text-foreground font-semibold">{metrics?.companyCustomers ?? 0}</strong> Company •{' '}
                      <strong className="text-foreground font-semibold">{metrics?.individualCustomers ?? 0}</strong> Individual
                    </span>
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
                      Directory <ChevronRight className="h-3 w-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Conversion Rate Card */}
        <Link href="/crm/leads" className="group block">
          <Card className="h-full border-border/70 bg-card hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Conversion Rate
              </CardTitle>
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 transition-colors">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {metrics?.conversionRate ?? 0}%
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {metrics?.convertedLeads ?? 0} converted deals
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
                      Pipeline <ChevronRight className="h-3 w-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Pipeline Value & Follow-ups Card */}
        <Link href="/crm/activities" className="group block">
          <Card className="h-full border-border/70 bg-card hover:border-amber-500/60 hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Pipeline Value
              </CardTitle>
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20 group-hover:text-amber-300 transition-colors">
                <DollarSign className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {canSeeValues ? formatCurrency(metrics?.totalPipelineValue ?? 0) : '—'}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {metrics?.upcomingFollowUps ?? 0} upcoming follow-ups
                    </span>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
                      Schedule <ChevronRight className="h-3 w-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Follow-up Alerts Banner if Overdue */}
      {!loading && (metrics?.overdueFollowUps ?? 0) > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>
              You have <strong className="font-semibold text-rose-200">{metrics?.overdueFollowUps}</strong> overdue follow-up{' '}
              {metrics?.overdueFollowUps === 1 ? 'activity' : 'activities'} requiring prompt client action.
            </span>
          </div>
          <Link href="/crm/activities?timeframe=overdue">
            <Button size="sm" variant="outline" className="border-rose-400/30 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 bg-background/50 h-7 text-xs">
              Resolve Overdue
            </Button>
          </Link>
        </div>
      )}

      {/* Breakdown Section - Clickable Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pipeline Stage Breakdown */}
        <Link href="/crm/leads" className="group block">
          <Card className="border-border/70 bg-card hover:border-primary/50 transition-all duration-200 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  Pipeline Stage Breakdown
                  <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Proportion of active vs converted opportunities
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/80">
                Click to view pipeline
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : metrics?.statusDistribution && metrics.statusDistribution.length > 0 ? (
                <div className="space-y-3">
                  {metrics.statusDistribution.map((item) => (
                    <div key={item.status} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{item.status}</span>
                        <span className="text-muted-foreground">
                          {item.count} leads ({item.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.status === 'WON'
                              ? 'bg-emerald-500'
                              : item.status === 'LOST'
                              ? 'bg-rose-500'
                              : item.status === 'PROPOSAL'
                              ? 'bg-amber-500'
                              : item.status === 'QUALIFIED'
                              ? 'bg-blue-500'
                              : 'bg-indigo-500'
                          }`}
                          style={{ width: `${Math.max(item.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No lead stage records available yet.
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Acquisition Sources Breakdown */}
        <Link href="/crm/leads" className="group block">
          <Card className="border-border/70 bg-card hover:border-primary/50 transition-all duration-200 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  Acquisition Sources
                  <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Top channels driving inbound deal generation
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/80">
                Click to explore
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : metrics?.sourceBreakdown && metrics.sourceBreakdown.length > 0 ? (
                <div className="space-y-3">
                  {metrics.sourceBreakdown.map((item) => (
                    <div key={item.source} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{item.source}</span>
                        <span className="text-muted-foreground">
                          {item.count} leads ({item.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${Math.max(item.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No lead source data available yet.
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Tables: Recent Leads & Recent Activities */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Leads */}
        <Card className="border-border/70 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Recent Leads
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Latest inbound leads added to system
              </CardDescription>
            </div>
            <Link href="/crm/leads">
              <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/90">
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : metrics?.recentLeads && metrics.recentLeads.length > 0 ? (
              <div className="divide-y divide-border/50">
                {metrics.recentLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/crm/leads/${lead.id}`}
                    className="flex items-center justify-between py-3 px-2 rounded-lg transition-colors hover:bg-secondary/60 cursor-pointer block"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground hover:text-primary truncate">
                        {lead.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{lead.companyName || 'No Company'}</span>
                        <span>•</span>
                        <span>{lead.ownerName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {canSeeValues && lead.value ? (
                        <span className="text-xs font-semibold text-foreground">
                          {formatCurrency(lead.value)}
                        </span>
                      ) : null}
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-medium ${
                          lead.status === 'WON'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : lead.status === 'QUALIFIED'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                            : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {lead.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No recent leads found.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="border-border/70 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">
                Follow-ups & Engagements
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Upcoming calls, tasks and customer meetings
              </CardDescription>
            </div>
            <Link href="/crm/activities">
              <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/90">
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : metrics?.recentActivities && metrics.recentActivities.length > 0 ? (
              <div className="divide-y divide-border/50">
                {metrics.recentActivities.map((act) => (
                  <Link
                    key={act.id}
                    href="/crm/activities"
                    className="flex items-center justify-between py-3 px-2 rounded-lg transition-colors hover:bg-secondary/60 cursor-pointer block"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground truncate">
                        {act.subject}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground/80">{act.type}</span>
                        {act.relatedName && (
                          <>
                            <span>•</span>
                            <span className="truncate">{act.relatedName}</span>
                          </>
                        )}
                        {act.dueDate && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {new Date(act.dueDate).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-medium shrink-0 ${
                        act.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }`}
                    >
                      {act.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No recent activities found.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
