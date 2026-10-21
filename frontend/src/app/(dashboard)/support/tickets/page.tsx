'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LifeBuoy,
  Plus,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  User,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/ui/export-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/auth/auth-provider';
import { Ticket, TicketStatus, TicketPriority, TicketCategory } from '@/types';

export default function SupportTicketsPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const searchParams = useSearchParams();
  const initStatus = searchParams.get('status') || 'ALL';
  const initPriority = searchParams.get('priority') || 'ALL';
  const initOverdue = searchParams.get('isOverdue') === 'true';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initStatus);
  const [priorityFilter, setPriorityFilter] = useState<string>(initPriority);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showOverdueOnly, setShowOverdueOnly] = useState(initOverdue);

  // Dialog State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    customerId: '',
    categoryId: '',
    priority: 'MEDIUM' as TicketPriority,
    department: 'Support',
    dueDate: '',
    slaDueAt: '',
  });

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter);
      if (categoryFilter !== 'ALL') params.set('categoryId', categoryFilter);
      if (showOverdueOnly) params.set('isOverdue', 'true');

      const res = await fetch(`/api/v1/tickets?${params.toString()}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setTickets(json.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, categoryFilter, showOverdueOnly]);

  const fetchMetadata = async () => {
    try {
      const [catRes, custRes, userRes] = await Promise.all([
        fetch('/api/v1/tickets/categories', { credentials: 'include' }),
        fetch('/api/v1/customers?limit=100', { credentials: 'include' }),
        fetch('/api/v1/users?limit=100', { credentials: 'include' }),
      ]);
      if (catRes.ok) {
        const json = await catRes.json();
        setCategories(json.data ?? []);
      }
      if (custRes.ok) {
        const json = await custRes.json();
        setCustomers(json.data ?? []);
      }
      if (userRes.ok) {
        const json = await userRes.json();
        setUsers(json.data ?? []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.description) return;

    setSubmitting(true);
    try {
      const payload: any = {
        subject: formData.subject,
        description: formData.description,
        priority: formData.priority,
        department: formData.department || undefined,
        categoryId: formData.categoryId || undefined,
        customerId: formData.customerId || undefined,
      };
      if (formData.dueDate) payload.dueDate = new Date(formData.dueDate).toISOString();
      if (formData.slaDueAt) payload.slaDueAt = new Date(formData.slaDueAt).toISOString();

      const res = await fetch('/api/v1/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCreateModalOpen(false);
        setFormData({
          subject: '',
          description: '',
          customerId: '',
          categoryId: '',
          priority: 'MEDIUM',
          department: 'Support',
          dueDate: '',
          slaDueAt: '',
        });
        fetchTickets();
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const openCount = tickets.filter((t) => t.status === 'OPEN').length;
  const inProgressCount = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter((t) => t.status === 'RESOLVED').length;
  const now = new Date();
  const overdueCount = tickets.filter(
    (t) =>
      t.status !== 'RESOLVED' &&
      t.status !== 'CLOSED' &&
      ((t.dueDate && new Date(t.dueDate) < now) || (t.slaDueAt && new Date(t.slaDueAt) < now))
  ).length;

  const getPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case 'URGENT':
        return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-semibold">Urgent</Badge>;
      case 'HIGH':
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold">High</Badge>;
      case 'MEDIUM':
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-semibold">Medium</Badge>;
      case 'LOW':
      default:
        return <Badge variant="secondary" className="text-muted-foreground font-medium">Low</Badge>;
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'OPEN':
        return <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20">Open</Badge>;
      case 'IN_PROGRESS':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">In Progress</Badge>;
      case 'WAITING_ON_CUSTOMER':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Waiting on Client</Badge>;
      case 'RESOLVED':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Resolved</Badge>;
      case 'CLOSED':
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Customer Support Desk</h1>
          </div>
          <p className="text-sm text-secondary-foreground text-muted-foreground mt-1">
            Manage customer help desk requests, SLA deadlines, conversation history and staff internal notes.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTickets}
            className="gap-1.5"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <ExportMenu type="tickets-table" />
          {hasPermission('tickets.create') && (
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
          )}
        </div>
      </div>

      {/* KPI Insight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          onClick={() => {
            setStatusFilter('OPEN');
            setShowOverdueOnly(false);
          }}
          className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card"
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Tickets</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{openCount}</h3>
              <p className="text-xs text-sky-600 mt-1 font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" /> Awaiting initial triage
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setStatusFilter('IN_PROGRESS');
            setShowOverdueOnly(false);
          }}
          className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card"
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">In Progress</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{inProgressCount}</h3>
              <p className="text-xs text-blue-600 mt-1 font-medium flex items-center gap-1">
                <Layers className="h-3 w-3" /> Under active investigation
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <LifeBuoy className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setShowOverdueOnly(!showOverdueOnly);
            setStatusFilter('ALL');
          }}
          className={`hover:-translate-y-0.5 hover:shadow-lg hover:border-red-500/60 cursor-pointer transition-all duration-200 border-border/80 bg-card ${
            showOverdueOnly ? 'ring-2 ring-red-500' : ''
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overdue SLA</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{overdueCount}</h3>
              <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Requires immediate action
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setStatusFilter('RESOLVED');
            setShowOverdueOnly(false);
          }}
          className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card"
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resolved</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{resolvedCount}</h3>
              <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Successfully closed
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card p-4 rounded-xl border border-border flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets by number, subject, description..."
            className="pl-9 bg-background"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="WAITING_ON_CUSTOMER">Waiting on Client</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          {/* Priority Select */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Category Select */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ticket List Table */}
      <Card className="border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="py-3.5 px-4">Ticket</th>
                <th className="py-3.5 px-4">Subject & Category</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Assignee</th>
                <th className="py-3.5 px-4">SLA Deadline</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading support tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground">
                    <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-foreground text-sm">No tickets found</p>
                    <p className="text-xs mt-1">Try adjusting your filters or create a new support ticket.</p>
                  </td>
                </tr>
              ) : (
                tickets.map((t) => {
                  const isSlaOverdue =
                    t.status !== 'RESOLVED' &&
                    t.status !== 'CLOSED' &&
                    ((t.dueDate && new Date(t.dueDate) < now) || (t.slaDueAt && new Date(t.slaDueAt) < now));

                  return (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/support/tickets/${t.id}`)}
                      className={`hover:bg-muted/40 transition-colors cursor-pointer group ${
                        isSlaOverdue ? 'bg-red-500/[0.02]' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-primary">
                        {t.ticketNumber}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {t.subject}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                          {t.category ? (
                            <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-medium">
                              {t.category.name}
                            </span>
                          ) : (
                            <span>General</span>
                          )}
                          {t.department && (
                            <>
                              <span>•</span>
                              <span>{t.department}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {t.customer ? (
                          <div className="flex items-center gap-1.5 text-foreground">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate max-w-[140px] font-medium">{t.customer.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {getPriorityBadge(t.priority)}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(t.status)}
                      </td>
                      <td className="py-3.5 px-4">
                        {t.assignee ? (
                          <div className="flex items-center gap-1.5 text-foreground">
                            <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                              {t.assignee.name.charAt(0)}
                            </div>
                            <span className="truncate max-w-[120px]">{t.assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {t.slaDueAt || t.dueDate ? (
                          <div className={`flex items-center gap-1 text-[11px] ${isSlaOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                            {isSlaOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                            <span>{new Date(t.slaDueAt || t.dueDate!).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No SLA</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/support/tickets/${t.id}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline font-semibold text-xs"
                        >
                          View <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Ticket Modal Dialog */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Create New Support Ticket</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTicket} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Subject *</label>
              <Input
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Brief summary of the customer inquiry or issue..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Customer</label>
                <select
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">No customer associated</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.companyName ? `(${c.companyName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">General Support</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as TicketPriority })}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent (SLA alert)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Department</label>
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g. Engineering, Billing"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Description *</label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Full details of the request, error message, steps to reproduce..."
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">SLA Deadline</label>
                <Input
                  type="datetime-local"
                  value={formData.slaDueAt}
                  onChange={(e) => setFormData({ ...formData, slaDueAt: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Due Date</label>
                <Input
                  type="datetime-local"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {submitting ? 'Creating...' : 'Create Ticket'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
