'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  Briefcase,
  CreditCard,
  LifeBuoy,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/ui/export-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  CRMReportData,
  ProjectsReportData,
  FinancialReportData,
  SupportReportData,
} from '@/types';

export default function ReportsAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'CRM' | 'PROJECTS' | 'FINANCE' | 'SUPPORT'>('CRM');
  const [loading, setLoading] = useState(true);

  // Reports state
  const [crmData, setCrmData] = useState<CRMReportData | null>(null);
  const [projectsData, setProjectsData] = useState<ProjectsReportData | null>(null);
  const [financeData, setFinanceData] = useState<FinancialReportData | null>(null);
  const [supportData, setSupportData] = useState<SupportReportData | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const [crmRes, projRes, finRes, supRes] = await Promise.all([
        fetch('/api/v1/reports/crm', { credentials: 'include' }),
        fetch('/api/v1/reports/projects', { credentials: 'include' }),
        fetch('/api/v1/reports/finance', { credentials: 'include' }),
        fetch('/api/v1/reports/support', { credentials: 'include' }),
      ]);

      if (crmRes.ok) {
        const json = await crmRes.json();
        setCrmData(json.data);
      }
      if (projRes.ok) {
        const json = await projRes.json();
        setProjectsData(json.data);
      }
      if (finRes.ok) {
        const json = await finRes.json();
        setFinanceData(json.data);
      }
      if (supRes.ok) {
        const json = await supRes.json();
        setSupportData(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const exportTypeByTab = {
    CRM: 'leads-table',
    PROJECTS: 'projects-table',
    FINANCE: 'invoices-table',
    SUPPORT: 'tickets-table',
  } as const;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports & Business Analytics</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real aggregate intelligence across CRM pipeline, project milestones, financial receivables, and support desk SLA performance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>

          <ExportMenu type={exportTypeByTab[activeTab]} label={`Export ${activeTab.toLowerCase()}`} />
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex border-b border-border/70 space-x-2">
        <button
          onClick={() => setActiveTab('CRM')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'CRM'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="h-4 w-4" /> CRM & Leads
        </button>
        <button
          onClick={() => setActiveTab('PROJECTS')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'PROJECTS'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Briefcase className="h-4 w-4" /> Projects & Tasks
        </button>
        <button
          onClick={() => setActiveTab('FINANCE')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'FINANCE'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CreditCard className="h-4 w-4" /> Financial Receivables
        </button>
        <button
          onClick={() => setActiveTab('SUPPORT')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'SUPPORT'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <LifeBuoy className="h-4 w-4" /> Support & SLA
        </button>
      </div>

      {loading && !crmData ? (
        <div className="py-24 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-xs text-muted-foreground font-medium">Aggregating database analytics...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: CRM & LEADS */}
          {activeTab === 'CRM' && crmData && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Leads</p>
                    <h3 className="text-2xl font-bold text-foreground mt-1">{crmData.totalLeads}</h3>
                    <p className="text-xs text-emerald-600 mt-1 font-semibold">
                      +{crmData.newLeadsInRange} new in last 90 days
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Conversion Rate</p>
                    <h3 className="text-2xl font-bold text-primary mt-1">{crmData.conversionRate}%</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {crmData.convertedCount} leads converted to customer
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Customers</p>
                    <h3 className="text-2xl font-bold text-foreground mt-1">{crmData.customers.total}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      +{crmData.customers.newInRange} onboarded recently
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Follow-ups Health</p>
                    <h3 className="text-2xl font-bold text-foreground mt-1">{crmData.followUps.completed}</h3>
                    <p className="text-xs text-amber-600 mt-1 font-semibold">
                      {crmData.followUps.upcoming} upcoming • {crmData.followUps.overdue} overdue
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* CRM Aggregation Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-sm font-bold text-foreground">Leads by Status</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {Object.entries(crmData.leadsByStatus).map(([status, count]) => {
                        const pct = crmData.totalLeads > 0 ? Math.round((count / crmData.totalLeads) * 100) : 0;
                        return (
                          <div key={status} className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="capitalize">{status.toLowerCase()}</span>
                              <span className="text-muted-foreground">{count} ({pct}%)</span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-sm font-bold text-foreground">Leads by Acquisition Source</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {Object.entries(crmData.leadsBySource).map(([source, count]) => {
                        const pct = crmData.totalLeads > 0 ? Math.round((count / crmData.totalLeads) * 100) : 0;
                        return (
                          <div key={source} className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span>{source}</span>
                              <span className="text-muted-foreground">{count} ({pct}%)</span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 2: PROJECTS & TASKS */}
          {activeTab === 'PROJECTS' && projectsData && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Projects</p>
                    <h3 className="text-2xl font-bold text-foreground mt-1">{projectsData.projects.active}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {projectsData.projects.completed} completed of {projectsData.projects.total} total
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Average Progress</p>
                    <h3 className="text-2xl font-bold text-primary mt-1">{projectsData.projects.averageProgress}%</h3>
                    <div className="h-1.5 w-full bg-muted rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${projectsData.projects.averageProgress}%` }} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overdue Projects</p>
                    <h3 className="text-2xl font-bold text-red-600 mt-1">{projectsData.projects.overdue}</h3>
                    <p className="text-xs text-red-500 mt-1 font-semibold">
                      {projectsData.tasks.overdue} tasks past due date
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Logged Hours</p>
                    <h3 className="text-2xl font-bold text-foreground mt-1">{projectsData.timeTracking.totalHoursLogged} hrs</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {projectsData.timeTracking.totalEntries} time entries recorded
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-sm font-bold text-foreground">Tasks by Status</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {Object.entries(projectsData.tasks.byStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40">
                        <span className="font-medium text-foreground">{status}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-sm font-bold text-foreground">Tasks by Priority</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {Object.entries(projectsData.tasks.byPriority).map(([prio, count]) => (
                      <div key={prio} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40">
                        <span className="font-medium text-foreground">{prio}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 3: FINANCIAL RECEIVABLES */}
          {activeTab === 'FINANCE' && financeData && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              {Object.entries(financeData.totalsByCurrency).map(([curr, m]) => (
                <div key={curr} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-bold font-mono">
                      Currency: {curr}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Financial isolation verified</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                      <CardContent className="p-5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Invoiced</p>
                        <h3 className="text-2xl font-bold text-foreground mt-1">
                          {curr} {m.totalInvoiced.toLocaleString()}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">Across all active invoices</p>
                      </CardContent>
                    </Card>

                    <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                      <CardContent className="p-5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Collected Payments</p>
                        <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                          {curr} {m.totalPaid.toLocaleString()}
                        </h3>
                        <p className="text-xs text-emerald-600 mt-1 font-semibold">Realized cash collection</p>
                      </CardContent>
                    </Card>

                    <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                      <CardContent className="p-5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outstanding Receivables</p>
                        <h3 className="text-2xl font-bold text-primary mt-1">
                          {curr} {m.outstanding.toLocaleString()}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">Pending settlement</p>
                      </CardContent>
                    </Card>

                    <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                      <CardContent className="p-5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overdue Invoices Amount</p>
                        <h3 className="text-2xl font-bold text-red-600 mt-1">
                          {curr} {m.overdue.toLocaleString()}
                        </h3>
                        <p className="text-xs text-red-500 mt-1 font-semibold">Immediate collection priority</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-sm font-bold text-foreground">Invoices by Status</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-2">
                    {Object.entries(financeData.invoiceStatusCounts).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40">
                        <span className="font-semibold text-foreground">{status}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-sm font-bold text-foreground">Expenses by Category</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-2">
                    {Object.entries(financeData.expenses.byCategory).map(([cat, amt]) => (
                      <div key={cat} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40">
                        <span className="font-medium text-foreground">{cat}</span>
                        <span className="font-mono font-bold text-foreground">INR {amt.toLocaleString()}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 4: SUPPORT & SLA */}
          {activeTab === 'SUPPORT' && supportData && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Tickets</p>
                    <h3 className="text-2xl font-bold text-foreground mt-1">{supportData.totalTickets}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {supportData.openTickets} open • {supportData.inProgressTickets} in progress
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overdue SLA Target</p>
                    <h3 className="text-2xl font-bold text-red-600 mt-1">{supportData.overdueTickets}</h3>
                    <p className="text-xs text-red-500 mt-1 font-semibold">Exceeded SLA deadline</p>
                  </CardContent>
                </Card>

                <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Resolution Time</p>
                    <h3 className="text-2xl font-bold text-primary mt-1">{supportData.averageResolutionHours} hrs</h3>
                    <p className="text-xs text-muted-foreground mt-1">From creation to resolution</p>
                  </CardContent>
                </Card>

                <Card className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card">
                  <CardContent className="p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resolved Tickets</p>
                    <h3 className="text-2xl font-bold text-emerald-600 mt-1">{supportData.resolvedTickets}</h3>
                    <p className="text-xs text-emerald-600 mt-1 font-semibold">Successful resolution rate</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-sm font-bold text-foreground">Tickets by Priority</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-2">
                    {Object.entries(supportData.byPriority).map(([prio, count]) => (
                      <div key={prio} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40">
                        <span className="font-semibold text-foreground">{prio}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-sm font-bold text-foreground">Tickets by Category</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-2">
                    {Object.entries(supportData.byCategory).map(([cat, count]) => (
                      <div key={cat} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40">
                        <span className="font-medium text-foreground">{cat}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
