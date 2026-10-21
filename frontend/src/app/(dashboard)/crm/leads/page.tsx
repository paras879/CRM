'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { Lead, PaginatedResponse, LeadStatus, LeadPriority, LeadSource, CustomerType } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/ui/export-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users,
  Building2,
  Plus,
  Search,
  Archive,
  RotateCcw,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  UserCheck,
  CheckCircle2,
  Mail,
  Phone,
} from 'lucide-react';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [isArchived, setIsArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // New Lead Modal State
  const [openCreate, setOpenCreate] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formCompanyName, setFormCompanyName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formValue, setFormValue] = useState<string>('');
  const [formCurrency, setFormCurrency] = useState('INR');
  const [formStatus, setFormStatus] = useState<LeadStatus>('NEW');
  const [formPriority, setFormPriority] = useState<LeadPriority>('MEDIUM');
  const [formSource, setFormSource] = useState('');
  const [formNextFollowUp, setFormNextFollowUp] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [initialNote, setInitialNote] = useState('');

  // Convert Modal State
  const [openConvert, setOpenConvert] = useState(false);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertType, setConvertType] = useState<CustomerType>('COMPANY');
  const [convertCustomerName, setConvertCustomerName] = useState('');
  const [convertContactName, setConvertContactName] = useState('');
  const [convertContactTitle, setConvertContactTitle] = useState('');
  const [convertTaxId, setConvertTaxId] = useState('');
  const [convertSuccessMsg, setConvertSuccessMsg] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        isArchived: isArchived.toString(),
      });
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);

      const res = await apiFetch<PaginatedResponse<Lead>>(`/leads?${params.toString()}`);
      setLeads(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  }, [page, isArchived, search, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    apiFetch<{ sources: LeadSource[] }>('/leads/sources')
      .then((res) => setSources(res.sources))
      .catch((err) => console.error('Failed to load lead sources:', err));
  }, []);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!formName.trim()) {
      setCreateError('Contact or lead name is required.');
      return;
    }

    try {
      setCreateSubmitting(true);
      const payload: any = {
        name: formName.trim(),
        title: formTitle.trim() || undefined,
        companyName: formCompanyName.trim() || undefined,
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        value: formValue ? parseFloat(formValue) : undefined,
        currency: formCurrency,
        status: formStatus,
        priority: formPriority,
        source: formSource.trim() || undefined,
        nextFollowUp: formNextFollowUp ? new Date(formNextFollowUp).toISOString() : undefined,
        description: formDescription.trim() || undefined,
        initialNote: initialNote.trim() || undefined,
      };

      await apiFetch('/leads', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setOpenCreate(false);
      resetCreateForm();
      fetchLeads();
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateError(err.message);
      } else {
        setCreateError('Failed to create lead. Please check details.');
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleOpenConvert = (lead: Lead) => {
    setConvertingLead(lead);
    setConvertType('COMPANY');
    setConvertCustomerName(lead.companyName || lead.name);
    setConvertContactName(lead.name);
    setConvertContactTitle('Primary Contact');
    setConvertTaxId('');
    setConvertError(null);
    setConvertSuccessMsg(null);
    setOpenConvert(true);
  };

  const handleConvertLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingLead) return;
    setConvertError(null);

    try {
      setConvertSubmitting(true);
      const res: any = await apiFetch(`/leads/${convertingLead.id}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          customerType: convertType,
          customerName: convertCustomerName.trim() || undefined,
          contactName: convertContactName.trim() || undefined,
          contactTitle: convertContactTitle.trim() || undefined,
          taxId: convertTaxId.trim() || undefined,
        }),
      });

      setConvertSuccessMsg(`Lead successfully converted to customer: ${res.customer.name}!`);
      setTimeout(() => {
        setOpenConvert(false);
        fetchLeads();
      }, 1400);
    } catch (err) {
      if (err instanceof ApiError) {
        setConvertError(err.message);
      } else {
        setConvertError('Failed to convert lead.');
      }
    } finally {
      setConvertSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setFormName('');
    setFormTitle('');
    setFormCompanyName('');
    setFormEmail('');
    setFormPhone('');
    setFormValue('');
    setFormStatus('NEW');
    setFormPriority('MEDIUM');
    setFormSource('');
    setFormNextFollowUp('');
    setFormDescription('');
    setInitialNote('');
    setCreateError(null);
  };

  const toggleArchive = async (lead: Lead) => {
    try {
      const endpoint = lead.isArchived
        ? `/leads/${lead.id}/restore`
        : `/leads/${lead.id}/archive`;
      await apiFetch(endpoint, { method: 'PATCH' });
      fetchLeads();
    } catch (err) {
      console.error('Failed to toggle archive on lead:', err);
    }
  };

  const formatCurrency = (val?: number | null, curr = 'INR') => {
    if (!val) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Leads Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track prospective deals, manage stage velocity, and convert qualified leads into active customers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ExportMenu type="leads-table" />
          <Button
            onClick={() => {
              resetCreateForm();
              setOpenCreate(true);
            }}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Lead
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border/70 bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads by title, contact, company, email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-border/80 bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">All Stages</option>
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="PROPOSAL">Proposal</option>
                <option value="WON">Won (Converted)</option>
                <option value="LOST">Lost</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-border/80 bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>

              {/* Active vs Archived Toggle */}
              <div className="flex items-center rounded-md border border-border/80 bg-secondary/60 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsArchived(false);
                    setPage(1);
                  }}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    !isArchived ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsArchived(true);
                    setPage(1);
                  }}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    isArchived ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Archived
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card className="border-border/70 bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/40">
            <TableRow className="border-border/60">
              <TableHead className="text-xs font-semibold text-foreground/80">Lead</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Contact</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Company</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Deal Value</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Stage</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Priority</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Next Follow-up</TableHead>
              <TableHead className="text-xs font-semibold text-foreground/80">Assigned To</TableHead>
              <TableHead className="text-right text-xs font-semibold text-foreground/80">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-xs text-muted-foreground">
                  Loading leads pipeline...
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-xs text-muted-foreground">
                  No leads found matching current filters.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => {
                const isOverdue =
                  lead.nextFollowUp &&
                  new Date(lead.nextFollowUp).getTime() < Date.now() &&
                  lead.status !== 'WON' &&
                  lead.status !== 'LOST';

                return (
                  <TableRow key={lead.id} className="hover:bg-secondary/40 transition-colors border-border/50">
                    <TableCell className="align-top min-w-[11rem]">
                      <Link
                        href={`/crm/leads/${lead.id}`}
                        className="text-sm font-semibold text-foreground hover:text-primary block"
                      >
                        {lead.name}
                      </Link>
                      {lead.title && <div className="text-xs text-muted-foreground mt-0.5">{lead.title}</div>}
                    </TableCell>
                    <TableCell className="align-top min-w-[16rem]">
                      <div className="space-y-1 text-xs">
                        {lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            className="flex items-center gap-1.5 text-foreground/80 hover:text-primary"
                            title={lead.email}
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate max-w-[14rem]">{lead.email}</span>
                          </a>
                        ) : null}
                        {lead.phone ? (
                          <a
                            href={`tel:${lead.phone}`}
                            className="flex items-center gap-1.5 text-foreground/80 hover:text-primary whitespace-nowrap"
                          >
                            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span>{lead.phone}</span>
                          </a>
                        ) : null}
                        {!lead.email && !lead.phone && <span className="text-muted-foreground/70 italic">No contact info</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-foreground/80">
                      {lead.companyName || <span className="text-muted-foreground/70 italic">None</span>}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">
                      {formatCurrency(lead.value, lead.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-medium ${
                          lead.status === 'WON'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : lead.status === 'LOST'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : lead.status === 'QUALIFIED'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                            : lead.status === 'PROPOSAL'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium ${
                          lead.priority === 'URGENT'
                            ? 'border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10'
                            : lead.priority === 'HIGH'
                            ? 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                            : 'border-border/80 text-muted-foreground'
                        }`}
                      >
                        {lead.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {lead.nextFollowUp ? (
                        <div
                          className={`flex items-center gap-1 ${
                            isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-foreground/80'
                          }`}
                        >
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>{new Date(lead.nextFollowUp).toLocaleDateString()}</span>
                          {isOverdue && <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">(Overdue)</span>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/70 italic">Not set</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.owner?.name || <span className="text-muted-foreground/70 italic">Unassigned</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/crm/leads/${lead.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary hover:text-primary/90">
                            Details
                          </Button>
                        </Link>

                        {!lead.convertedToId ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenConvert(lead)}
                            className="h-7 px-2 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 bg-emerald-500/5"
                          >
                            <UserCheck className="h-3.5 w-3.5 mr-1" />
                            Convert
                          </Button>
                        ) : (
                          <Link href={`/crm/customers/${lead.convertedToId}`}>
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] cursor-pointer hover:underline">
                              Customer
                            </Badge>
                          </Link>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleArchive(lead)}
                          className={`h-7 px-2 text-xs ${
                            lead.isArchived
                              ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-300'
                              : 'text-muted-foreground hover:text-rose-400'
                          }`}
                        >
                          {lead.isArchived ? (
                            <RotateCcw className="h-3.5 w-3.5" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          <div>
            Showing <strong className="font-semibold text-foreground">{leads.length}</strong> of{' '}
            <strong className="font-semibold text-foreground">{totalCount}</strong> leads
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 text-xs border-border/80"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Previous
            </Button>
            <span className="px-2 font-medium text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 text-xs border-border/80"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* New Lead Dialog */}
      <Dialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        title="Create New Lead Opportunity"
        description="Add a prospective customer or enterprise deal to the CRM pipeline."
        className="max-w-2xl bg-card border-border text-foreground"
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          {createError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{createError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Contact Name *</label>
              <Input
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Full name"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Company / Organization</label>
              <Input
                value={formCompanyName}
                onChange={(e) => setFormCompanyName(e.target.value)}
                placeholder="Company name"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Deal Title / Opportunity</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Annual Cloud Infrastructure Deal"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Estimated Deal Value</label>
              <Input
                type="number"
                min="0"
                step="any"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="e.g. 250000"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Email Address</label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="name@company.com"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Phone Number</label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="Phone number"
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Priority</label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as LeadPriority)}
                className="w-full h-9 rounded-md border border-border/80 bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Lead Source</label>
              <select
                value={formSource}
                onChange={(e) => setFormSource(e.target.value)}
                className="w-full h-9 rounded-md border border-border/80 bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Select acquisition source</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
                <option value="Direct Inbound">Direct Inbound</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Initial Stage</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as LeadStatus)}
                className="w-full h-9 rounded-md border border-border/80 bg-background/50 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="PROPOSAL">Proposal</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">Next Follow-up Date</label>
              <Input
                type="date"
                value={formNextFollowUp}
                onChange={(e) => setFormNextFollowUp(e.target.value)}
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Initial Note / Interaction Record</label>
            <textarea
              rows={2}
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              placeholder="Context regarding initial discussion, customer pain points, timeline..."
              className="w-full rounded-md border border-border/80 bg-background/50 p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="sticky -bottom-6 -mx-6 bg-card/95 backdrop-blur-md px-6 py-3.5 border-t border-border/70 flex items-center justify-end gap-2 z-10 mt-6 shadow-lg">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenCreate(false)}
              className="text-xs border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm"
            >
              {createSubmitting ? 'Creating Lead...' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Convert Lead Dialog */}
      <Dialog
        open={openConvert}
        onOpenChange={setOpenConvert}
        title="Convert Lead into Customer & Contact"
        description="Converts this lead opportunity into a permanent Customer account and primary Contact record."
        className="bg-card border-border text-foreground"
      >
        <form onSubmit={handleConvertLead} className="space-y-4">
          {convertError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{convertError}</span>
            </div>
          )}

          {convertSuccessMsg && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{convertSuccessMsg}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1.5">New Customer Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConvertType('COMPANY')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  convertType === 'COMPANY'
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                    : 'border-border/80 bg-background/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                <Building2 className="h-4 w-4" />
                Company Account
              </button>
              <button
                type="button"
                onClick={() => setConvertType('INDIVIDUAL')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                  convertType === 'INDIVIDUAL'
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                    : 'border-border/80 bg-background/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                <Users className="h-4 w-4" />
                Individual Client
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">
              Customer / Account Name *
            </label>
            <Input
              required
              value={convertCustomerName}
              onChange={(e) => setConvertCustomerName(e.target.value)}
              className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">
                Primary Contact Name *
              </label>
              <Input
                required
                value={convertContactName}
                onChange={(e) => setConvertContactName(e.target.value)}
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">
                Contact Job Title
              </label>
              <Input
                value={convertContactTitle}
                onChange={(e) => setConvertContactTitle(e.target.value)}
                className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 block mb-1">Tax ID (Optional)</label>
            <Input
              value={convertTaxId}
              onChange={(e) => setConvertTaxId(e.target.value)}
              placeholder="e.g. GSTIN / VAT"
              className="text-xs h-9 bg-background/50 border-border/80 text-foreground"
            />
          </div>

          <div className="rounded-lg bg-primary/10 p-3 text-xs text-primary-foreground/90 border border-primary/20 space-y-1">
            <div className="font-semibold text-primary">Atomic Conversion Details:</div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground">
              <li>Lead status is automatically set to WON.</li>
              <li>Lead history, notes and activities are linked to the newly generated Customer.</li>
              <li>A new Primary Contact record will be created.</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenConvert(false)}
              className="text-xs border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={convertSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-sm"
            >
              {convertSubmitting ? 'Converting...' : 'Confirm Conversion'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
