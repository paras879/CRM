'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { formatCurrency, formatCurrencyTotals } from '@/lib/utils';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Contract, Customer, Project, ContractStatus } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUploadField } from '@/components/ui/file-upload-field';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileCheck,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Clock,
  Building,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Briefcase,
  Paperclip,
} from 'lucide-react';

const statusBadgeStyles: Record<ContractStatus, { label: string; class: string }> = {
  DRAFT: { label: 'Draft', class: 'bg-muted text-muted-foreground border-border' },
  ACTIVE: { label: 'Active', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  EXPIRING: { label: 'Expiring Soon', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse' },
  EXPIRED: { label: 'Expired', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  TERMINATED: { label: 'Terminated', class: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Create Modal
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected contract for details
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Form Fields
  const [subject, setSubject] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [contractType, setContractType] = useState('Service Agreement');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [contractValue, setContractValue] = useState<number>(10000);
  const { user } = useAuth();
  const [currency, setCurrency] = useState(user?.company?.currency || 'INR');
  const [description, setDescription] = useState('');
  const [terms, setTerms] = useState('Standard SLA with 99.9% uptime and monthly reviews.');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  const fetchContracts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const res = await apiFetch<any>(`/contracts?${params.toString()}`);
      if (res && res.data) {
        setContracts(res.data);
        if (res.meta) {
          setTotalPages(res.meta.totalPages || 1);
          setTotalCount(res.meta.total || res.data.length);
        } else {
          setTotalCount(res.data.length);
        }
      }
    } catch (err: any) {
      console.error('Failed to load contracts:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuxData = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        apiFetch<any>('/customers?limit=100'),
        apiFetch<any>('/projects?limit=100'),
      ]);
      if (cRes && cRes.data) setCustomers(cRes.data);
      if (pRes && pRes.data) setProjects(pRes.data);
    } catch (err) {
      console.error('Failed to load customers/projects:', err);
    }
  };

  useEffect(() => {
    loadAuxData();
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [page, search, statusFilter]);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setFormError('Please enter a contract subject');
      return;
    }
    if (!customerId) {
      setFormError('Please select a customer');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setFormError('End date must be after start date');
      return;
    }
    if (contractValue < 0) {
      setFormError('Contract value cannot be negative');
      return;
    }

    setCreating(true);
    setFormError('');

    try {
      await apiFetch('/contracts', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          customerId,
          projectId: projectId || undefined,
          contractType,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          contractValue: Number(contractValue),
          currency,
          description,
          terms,
          attachmentUrl: attachmentUrl.trim() || undefined,
        }),
      });

      setSuccessMsg('Contract created successfully!');
      setOpenCreate(false);
      resetForm();
      fetchContracts();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create contract');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setSubject('');
    setCustomerId('');
    setProjectId('');
    setDescription('');
    setAttachmentUrl('');
  };

  // Days left calculation
  const getDaysRemaining = (endDateStr?: string | null) => {
    if (!endDateStr) return -1;
    const end = new Date(endDateStr).getTime();
    const now = new Date().getTime();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Metrics
  const activeContracts = contracts.filter((c) => c.status === 'ACTIVE');
  const expiringContracts = contracts.filter((c) => {
    if (c.status === 'EXPIRING') return true;
    const days = getDaysRemaining(c.endDate);
    return c.status === 'ACTIVE' && days >= 0 && days <= 30;
  });
  const totalValue = formatCurrencyTotals(contracts, (c) => c.value ?? c.contractValue ?? 0, (c) => c.currency);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-primary" />
            Contracts Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage legal agreements, service level contracts, terms, and track impending expiries.
          </p>
        </div>
        <Button onClick={() => setOpenCreate(true)} className="gap-2 bg-primary hover:bg-primary/90 text-white">
          <Plus className="w-4 h-4" />
          Create Contract
        </Button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-300 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* KPI Cards with hover lift and pointer cursor */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/70 bg-card hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Contract Value</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {totalValue}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{totalCount} registered agreements</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <FileCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-muted-foreground">Active Contracts</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{activeContracts.length}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">In full operational effect</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-muted-foreground">Expiring In &lt; 30 Days</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{expiringContracts.length}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Requires renewal attention</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border border-border/70 bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contract #, subject..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 bg-secondary/50 border-border/70"
              />
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-48 bg-secondary/50 border border-border/70 rounded-md text-sm px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRING">Expiring Soon</option>
                <option value="EXPIRED">Expired</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card className="border border-border/70 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/40">
              <TableRow>
                <TableHead className="font-medium text-xs uppercase">Contract #</TableHead>
                <TableHead className="font-medium text-xs uppercase">Subject & Customer</TableHead>
                <TableHead className="font-medium text-xs uppercase">Type</TableHead>
                <TableHead className="font-medium text-xs uppercase">Start Date</TableHead>
                <TableHead className="font-medium text-xs uppercase">End Date</TableHead>
                <TableHead className="font-medium text-xs uppercase text-right">Value</TableHead>
                <TableHead className="font-medium text-xs uppercase text-center">Status</TableHead>
                <TableHead className="font-medium text-xs uppercase text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>Loading contracts...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileCheck className="w-10 h-10 text-muted-foreground/40" />
                      <p className="font-medium text-base text-foreground">No contracts found</p>
                      <p className="text-xs">Create legal agreements to protect and organize client engagements.</p>
                      <Button onClick={() => setOpenCreate(true)} size="sm" className="mt-2">
                        Create Contract
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                contracts.map((c) => {
                  const daysRemaining = getDaysRemaining(c.endDate);
                  const isExpiringSoon = c.status === 'EXPIRING' || (c.status === 'ACTIVE' && daysRemaining >= 0 && daysRemaining <= 30);
                  const badge = isExpiringSoon
                    ? statusBadgeStyles.EXPIRING
                    : statusBadgeStyles[c.status] || {
                        label: c.status,
                        class: 'bg-muted text-muted-foreground',
                      };

                  return (
                    <TableRow key={c.id} className="hover:bg-secondary/30 transition-colors">
                      <TableCell className="font-semibold text-foreground">
                        <span className="font-mono text-primary cursor-pointer" onClick={() => setSelectedContract(c)}>
                          {c.contractNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{c.subject}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3" />
                            {c.customer?.companyName || c.customer?.name || 'Customer'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="border-border/70 text-xs">
                          {c.contractType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(c.startDate).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {c.endDate ? new Date(c.endDate).toLocaleDateString() : '—'}
                          {isExpiringSoon && (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold ml-1">({daysRemaining}d left)</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground">
                        {c.currency} {(c.value ?? c.contractValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-xs ${badge.class}`}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedContract(c)}
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing page {page} of {totalPages} ({totalCount} total)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 px-2 border-border/70"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 px-2 border-border/70"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Contract Details Modal */}
      <Dialog open={!!selectedContract} onOpenChange={() => setSelectedContract(null)}>
        {selectedContract && (
          <div className="fixed inset-0 z-50 flex p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto [&>*]:m-auto">
            <div className="w-full max-w-2xl bg-card border border-border/80 rounded-xl shadow-2xl p-6 space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-lg text-primary">{selectedContract.contractNumber}</span>
                  <Badge variant="outline" className={`text-xs ${statusBadgeStyles[selectedContract.status]?.class}`}>
                    {statusBadgeStyles[selectedContract.status]?.label}
                  </Badge>
                </div>
                <button onClick={() => setSelectedContract(null)} className="text-muted-foreground hover:text-foreground">
                  &times;
                </button>
              </div>

              <div>
                <h3 className="text-xl font-bold text-foreground">{selectedContract.subject}</h3>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <Building className="w-4 h-4 text-primary" />
                  {selectedContract.customer?.companyName || selectedContract.customer?.name}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-secondary/30 rounded-lg text-xs">
                <div>
                  <span className="text-muted-foreground block">Contract Type</span>
                  <span className="font-medium text-foreground">{selectedContract.contractType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Start Date</span>
                  <span className="font-medium text-foreground">{new Date(selectedContract.startDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">End Date</span>
                  <span className="font-medium text-foreground">{selectedContract.endDate ? new Date(selectedContract.endDate).toLocaleDateString() : '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Contract Value</span>
                  <span className="font-bold text-primary font-mono text-sm">
                    {formatCurrency(selectedContract.value ?? selectedContract.contractValue ?? 0, selectedContract.currency)}
                  </span>
                </div>
              </div>

              {selectedContract.description && (
                <div className="p-3 bg-secondary/20 rounded-md text-xs">
                  <span className="font-semibold text-foreground block mb-1">Description:</span>
                  <p className="text-muted-foreground">{selectedContract.description}</p>
                </div>
              )}

              {selectedContract.terms && (
                <div className="p-3 bg-secondary/20 rounded-md text-xs">
                  <span className="font-semibold text-foreground block mb-1">Terms & Conditions:</span>
                  <p className="text-muted-foreground">{selectedContract.terms}</p>
                </div>
              )}

              {selectedContract.attachmentUrl && (
                <div className="p-3 bg-secondary/20 rounded-md text-xs flex items-center justify-between">
                  <span className="font-medium text-foreground flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-primary" />
                    Contract Document Attached
                  </span>
                  <a
                    href={selectedContract.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    View File
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div className="flex items-center justify-end pt-3 border-t border-border/70">
                <Button variant="outline" onClick={() => setSelectedContract(null)} className="border-border/70 text-xs">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* Create Contract Modal */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        {openCreate && (
          <div className="fixed inset-0 z-50 flex p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto [&>*]:m-auto">
            <div className="w-full max-w-2xl bg-card border border-border/80 rounded-xl shadow-2xl p-6 space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-primary" />
                  New Contract Agreement
                </h3>
                <button onClick={() => setOpenCreate(false)} className="text-muted-foreground hover:text-foreground">
                  &times;
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateContract} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Subject <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. Annual Software Maintenance SLA"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="bg-secondary/50 border-border/70"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Customer <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full bg-secondary/50 border border-border/70 rounded-md text-sm px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    >
                      <option value="">Select customer...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName || c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Contract Type</label>
                    <Input
                      value={contractType}
                      onChange={(e) => setContractType(e.target.value)}
                      placeholder="Service Agreement, Retainer, NDA..."
                      className="bg-secondary/50 border-border/70"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-secondary/50 border-border/70"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">End Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-secondary/50 border-border/70"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Contract Value ({currency}) <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={contractValue}
                      onChange={(e) => setContractValue(parseFloat(e.target.value) || 0)}
                      className="bg-secondary/50 border-border/70"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Associated Project (Optional)</label>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full bg-secondary/50 border border-border/70 rounded-md text-sm px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">No linked project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name || p.projectName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Scope, deliverables, or background details..."
                    rows={2}
                    className="w-full text-xs bg-secondary/50 border border-border/70 rounded-md p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Terms & Conditions</label>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    rows={2}
                    className="w-full text-xs bg-secondary/50 border border-border/70 rounded-md p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Contract Document</label>
                  <FileUploadField value={attachmentUrl} onChange={setAttachmentUrl} disabled={creating} />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/70">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenCreate(false)}
                    disabled={creating}
                    className="border-border/70"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating} className="bg-primary hover:bg-primary/90 text-white gap-2">
                    {creating ? 'Saving...' : 'Create Contract'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
