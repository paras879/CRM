'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { formatCurrency, formatCurrencyTotals } from '@/lib/utils';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Proposal, Customer, Project, ProposalStatus } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { TaxRateSelect, TaxRateHint, useTaxRates } from '@/components/ui/tax-rate-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileText,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  ExternalLink,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  Building,
  User,
  Check,
  X,
  Receipt,
  FileCheck2,
  Download,
} from 'lucide-react';

const statusBadgeStyles: Record<ProposalStatus, { label: string; class: string }> = {
  DRAFT: { label: 'Draft', class: 'bg-muted text-muted-foreground border-border' },
  SENT: { label: 'Sent', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  ACCEPTED: { label: 'Accepted', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  REJECTED: { label: 'Rejected', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  EXPIRED: { label: 'Expired', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  CANCELLED: { label: 'Cancelled', class: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
};

interface NewItemRow {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
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

  // Selected proposal for details / preview
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const { user } = useAuth();
  const [currency, setCurrency] = useState(user?.company?.currency || 'INR');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Payment within 15 days upon acceptance.');
  const [items, setItems] = useState<NewItemRow[]>([
    { description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 },
  ]);
  const { rates: taxRates, loaded: taxRatesLoaded, defaultFraction } = useTaxRates();

  // Apply the company's default tax rate to the untouched first line once rates load
  useEffect(() => {
    if (!taxRatesLoaded || defaultFraction === 0) return;
    setItems((prev) =>
      prev.length === 1 && !prev[0].description && prev[0].unitPrice === 0 && prev[0].taxRate === 0
        ? [{ ...prev[0], taxRate: defaultFraction }]
        : prev
    );
  }, [taxRatesLoaded, defaultFraction]);

  // Converting proposal
  const [converting, setConverting] = useState(false);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const res = await apiFetch<any>(`/proposals?${params.toString()}`);
      if (res && res.data) {
        setProposals(res.data);
        if (res.meta) {
          setTotalPages(res.meta.totalPages || 1);
          setTotalCount(res.meta.total || res.data.length);
        } else {
          setTotalCount(res.data.length);
        }
      }
    } catch (err: any) {
      console.error('Failed to load proposals:', err);
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
      console.error('Failed to load auxiliary customer/project data:', err);
    }
  };

  useEffect(() => {
    loadAuxData();
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [page, search, statusFilter]);

  // Live item calculations
  const calculateTotals = () => {
    let subtotal = 0;
    let totalTax = 0;
    items.forEach((item) => {
      const lineSub = (item.quantity || 0) * (item.unitPrice || 0);
      const lineDisc = Math.min(lineSub, item.discount || 0);
      const taxable = lineSub - lineDisc;
      const lineTax = taxable * (item.taxRate || 0);
      subtotal += lineSub;
      totalTax += lineTax;
    });
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(totalTax * 100) / 100,
      total: Math.round((subtotal + totalTax) * 100) / 100,
    };
  };

  const totals = calculateTotals();

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: defaultFraction }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof NewItemRow, val: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter a proposal title');
      return;
    }
    if (!customerId) {
      setFormError('Please select a customer');
      return;
    }
    if (new Date(expiryDate) < new Date(issueDate)) {
      setFormError('Expiry date cannot be before issue date');
      return;
    }
    if (items.some((i) => !i.description.trim() || i.quantity <= 0 || i.unitPrice < 0)) {
      setFormError('Please ensure all items have descriptions, quantity > 0, and unit price >= 0');
      return;
    }

    setCreating(true);
    setFormError('');

    try {
      await apiFetch('/proposals', {
        method: 'POST',
        body: JSON.stringify({
          title,
          customerId,
          projectId: projectId || undefined,
          issueDate: new Date(issueDate).toISOString(),
          expiryDate: new Date(expiryDate).toISOString(),
          currency,
          notes,
          terms,
          items: items.map((i) => ({
            description: i.description.trim(),
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
            discount: Number(i.discount || 0),
            taxRate: Number(i.taxRate || 0),
          })),
        }),
      });

      setSuccessMsg('Proposal created successfully!');
      setOpenCreate(false);
      resetForm();
      fetchProposals();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create proposal');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setCustomerId('');
    setProjectId('');
    setNotes('');
    setItems([{ description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: defaultFraction }]);
  };

  const handleConvertToInvoice = async (proposal: Proposal) => {
    if (proposal.convertedToInvoiceId) return;
    setConverting(true);
    try {
      const res = await apiFetch<any>(`/proposals/${proposal.id}/convert-to-invoice`, {
        method: 'POST',
      });
      setSuccessMsg(`Proposal converted to invoice ${res?.data?.invoice?.invoiceNumber || res?.invoice?.invoiceNumber || ''}!`);
      fetchProposals();
      if (selectedProposal && selectedProposal.id === proposal.id) {
        setSelectedProposal(null);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to convert proposal to invoice');
    } finally {
      setConverting(false);
    }
  };

  // Metrics
  const acceptedProposals = proposals.filter((p) => p.status === 'ACCEPTED');
  const totalValue = formatCurrencyTotals(proposals, (p) => p.total, (p) => p.currency);
  const acceptedValue = formatCurrencyTotals(acceptedProposals, (p) => p.total, (p) => p.currency);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Proposals Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Create, send, track client proposals, and convert accepted deals seamlessly into invoices.
          </p>
        </div>
        <Button onClick={() => setOpenCreate(true)} className="gap-2 bg-primary hover:bg-primary/90 text-white">
          <Plus className="w-4 h-4" />
          Create Proposal
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Proposals</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{totalCount}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalValue} pipeline
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <FileText className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-muted-foreground">Accepted Deals</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{acceptedProposals.length}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {acceptedValue} accepted
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FileCheck2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-muted-foreground">Pending Review</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {proposals.filter((p) => p.status === 'SENT' || p.status === 'DRAFT').length}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Awaiting customer decision</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="w-6 h-6" />
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
                placeholder="Search proposal #, title..."
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
                <option value="SENT">Sent</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proposals Table */}
      <Card className="border border-border/70 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/40">
              <TableRow>
                <TableHead className="font-medium text-xs uppercase">Proposal #</TableHead>
                <TableHead className="font-medium text-xs uppercase">Title & Customer</TableHead>
                <TableHead className="font-medium text-xs uppercase">Issue Date</TableHead>
                <TableHead className="font-medium text-xs uppercase">Expiry Date</TableHead>
                <TableHead className="font-medium text-xs uppercase text-right">Amount</TableHead>
                <TableHead className="font-medium text-xs uppercase text-center">Status</TableHead>
                <TableHead className="font-medium text-xs uppercase text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>Loading proposals...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : proposals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-10 h-10 text-muted-foreground/40" />
                      <p className="font-medium text-base text-foreground">No proposals found</p>
                      <p className="text-xs">Create your first proposal to start closing business deals.</p>
                      <Button onClick={() => setOpenCreate(true)} size="sm" className="mt-2">
                        Create Proposal
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                proposals.map((p) => {
                  const badge = statusBadgeStyles[p.status] || {
                    label: p.status,
                    class: 'bg-muted text-muted-foreground',
                  };
                  return (
                    <TableRow key={p.id} className="hover:bg-secondary/30 transition-colors">
                      <TableCell className="font-semibold text-foreground">
                        <span className="font-mono text-primary cursor-pointer" onClick={() => setSelectedProposal(p)}>
                          {p.proposalNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{p.title}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3" />
                            {p.customer?.companyName || p.customer?.name || 'Customer'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(p.issueDate || p.issuedAt || p.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(p.expiryDate || p.validUntil || p.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground">
                        {p.currency} {p.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-xs ${badge.class}`}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedProposal(p)}
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            View
                          </Button>
                          {p.convertedToInvoiceId ? (
                            <Link href={`/finance/invoices/${p.convertedToInvoiceId}`}>
                              <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 gap-1 cursor-pointer hover:bg-indigo-500/20">
                                <Receipt className="w-3 h-3" />
                                Invoice
                              </Badge>
                            </Link>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConvertToInvoice(p)}
                              disabled={converting}
                              className="h-7 px-2 text-xs border-border/70 hover:border-primary/50 text-foreground"
                              title="Convert to Invoice"
                            >
                              <ArrowRight className="w-3 h-3 mr-1 text-primary" />
                              To Invoice
                            </Button>
                          )}
                        </div>
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

      {/* Proposal Details Modal */}
      <Dialog open={!!selectedProposal} onOpenChange={() => setSelectedProposal(null)}>
        {selectedProposal && (
          <div className="fixed inset-0 z-50 flex p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto [&>*]:m-auto">
            <div className="w-full max-w-2xl bg-card border border-border/80 rounded-xl shadow-2xl p-6 space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-lg text-primary">{selectedProposal.proposalNumber}</span>
                  <Badge variant="outline" className={`text-xs ${statusBadgeStyles[selectedProposal.status]?.class}`}>
                    {statusBadgeStyles[selectedProposal.status]?.label}
                  </Badge>
                </div>
                <button onClick={() => setSelectedProposal(null)} className="text-muted-foreground hover:text-foreground">
                  &times;
                </button>
              </div>

              <div>
                <h3 className="text-xl font-bold text-foreground">{selectedProposal.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <Building className="w-4 h-4 text-primary" />
                  {selectedProposal.customer?.companyName || selectedProposal.customer?.name}
                </p>
              </div>

              <a
                href={`/api/v1/proposals/${selectedProposal.id}/pdf`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium shadow-sm hover:bg-secondary"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF
              </a>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-secondary/30 rounded-lg text-xs">
                <div>
                  <span className="text-muted-foreground block">Issue Date</span>
                  <span className="font-medium text-foreground">{new Date(selectedProposal.issueDate || selectedProposal.issuedAt || selectedProposal.createdAt).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Expiry Date</span>
                  <span className="font-medium text-foreground">{new Date(selectedProposal.expiryDate || selectedProposal.validUntil || selectedProposal.createdAt).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Currency</span>
                  <span className="font-medium text-foreground">{selectedProposal.currency}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Total Value</span>
                  <span className="font-bold text-primary font-mono text-sm">
                    {formatCurrency(selectedProposal.total, selectedProposal.currency)}
                  </span>
                </div>
              </div>

              {/* Items breakdown */}
              <div className="border border-border/70 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow>
                      <TableHead className="text-xs uppercase font-medium">Item</TableHead>
                      <TableHead className="text-xs uppercase font-medium text-center">Qty</TableHead>
                      <TableHead className="text-xs uppercase font-medium text-right">Price</TableHead>
                      <TableHead className="text-xs uppercase font-medium text-right">Discount</TableHead>
                      <TableHead className="text-xs uppercase font-medium text-right">Tax %</TableHead>
                      <TableHead className="text-xs uppercase font-medium text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedProposal.items && selectedProposal.items.length > 0 ? (
                      selectedProposal.items.map((it, idx) => (
                        <TableRow key={it.id || idx}>
                          <TableCell className="text-sm font-medium text-foreground">{it.description}</TableCell>
                          <TableCell className="text-sm text-center font-mono">{it.quantity}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{formatCurrency(it.unitPrice, selectedProposal.currency)}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{(it.discount || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{Math.round((it.taxRate || 0) * 10000) / 100}%</TableCell>
                          <TableCell className="text-sm text-right font-mono font-bold text-foreground">
                            {formatCurrency(it.lineTotal ?? it.total ?? 0, selectedProposal.currency)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-xs text-muted-foreground">
                          No line items found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Notes & Terms */}
              {(selectedProposal.notes || selectedProposal.terms) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {selectedProposal.notes && (
                    <div className="p-3 bg-secondary/20 rounded-md">
                      <span className="font-semibold text-foreground block mb-1">Notes:</span>
                      <p className="text-muted-foreground">{selectedProposal.notes}</p>
                    </div>
                  )}
                  {selectedProposal.terms && (
                    <div className="p-3 bg-secondary/20 rounded-md">
                      <span className="font-semibold text-foreground block mb-1">Terms:</span>
                      <p className="text-muted-foreground">{selectedProposal.terms}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Footer action buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-border/70">
                <Button variant="outline" onClick={() => setSelectedProposal(null)} className="border-border/70 text-xs">
                  Close
                </Button>
                <div className="flex items-center gap-2">
                  {selectedProposal.convertedToInvoiceId ? (
                    <Link href={`/finance/invoices/${selectedProposal.convertedToInvoiceId}`}>
                      <Button className="bg-primary text-white text-xs gap-1.5">
                        <Receipt className="w-3.5 h-3.5" />
                        View Converted Invoice
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      onClick={() => handleConvertToInvoice(selectedProposal)}
                      disabled={converting}
                      className="bg-primary hover:bg-primary/90 text-white text-xs gap-1.5"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      {converting ? 'Converting...' : 'Convert to Invoice'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* Create Proposal Modal */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        {openCreate && (
          <div className="fixed inset-0 z-50 flex p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto [&>*]:m-auto">
            <div className="w-full max-w-3xl bg-card border border-border/80 rounded-xl shadow-2xl p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  New Business Proposal
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

              <form onSubmit={handleCreateProposal} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Proposal Title <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. Website Redesign & Maintenance Contract"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
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

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Issue Date</label>
                    <Input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="bg-secondary/50 border-border/70"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Expiry Date</label>
                    <Input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="bg-secondary/50 border-border/70"
                      required
                    />
                  </div>
                </div>

                {/* Line Items Editor */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Line Items</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddItem}
                      className="text-xs h-7 gap-1 border-border/70"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Item
                    </Button>
                  </div>
                  <TaxRateHint rates={taxRates} loaded={taxRatesLoaded} />

                  <div className="border border-border/70 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-secondary/40">
                        <TableRow>
                          <TableHead className="text-xs uppercase font-medium">Description</TableHead>
                          <TableHead className="text-xs uppercase font-medium w-20 text-center">Qty</TableHead>
                          <TableHead className="text-xs uppercase font-medium w-28 text-right">Price ({currency})</TableHead>
                          <TableHead className="text-xs uppercase font-medium w-20 text-right">Discount</TableHead>
                          <TableHead className="text-xs uppercase font-medium w-20 text-right">Tax %</TableHead>
                          <TableHead className="text-xs uppercase font-medium w-28 text-right">Total ({currency})</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, idx) => {
                          const lineSub = (item.quantity || 0) * (item.unitPrice || 0);
                          const lineDisc = Math.min(lineSub, item.discount || 0);
                          const taxable = lineSub - lineDisc;
                          const lineTax = taxable * (item.taxRate || 0);
                          const lineTotal = taxable + lineTax;

                          return (
                            <TableRow key={idx}>
                              <TableCell className="p-2">
                                <Input
                                  placeholder="Service or product description"
                                  value={item.description}
                                  onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                  className="h-8 text-xs bg-secondary/30"
                                  required
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs bg-secondary/30 text-center"
                                  required
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs bg-secondary/30 text-right"
                                  required
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.discount}
                                  onChange={(e) => handleItemChange(idx, 'discount', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-xs bg-secondary/30 text-right"
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <TaxRateSelect
                                  value={item.taxRate}
                                  rates={taxRates}
                                  onChange={(fraction) => handleItemChange(idx, 'taxRate', fraction)}
                                  className="w-full h-8 rounded-md bg-secondary/30 border border-border px-1 text-xs text-foreground"
                                />
                              </TableCell>
                              <TableCell className="p-2 text-right font-mono text-xs font-bold">
                                {formatCurrency(lineTotal, currency)}
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveItem(idx)}
                                  disabled={items.length <= 1}
                                  className="h-8 w-8 p-0 text-rose-600 dark:text-rose-400 hover:text-rose-300"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="flex justify-end pt-2">
                  <div className="w-64 space-y-1.5 p-3 bg-secondary/30 rounded-lg text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal:</span>
                      <span className="font-mono">{formatCurrency(totals.subtotal, currency)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Estimated Tax:</span>
                      <span className="font-mono">{formatCurrency(totals.tax, currency)}</span>
                    </div>
                    <div className="flex justify-between text-foreground font-bold border-t border-border/70 pt-1.5 text-sm">
                      <span>Total Value:</span>
                      <span className="font-mono text-primary">{formatCurrency(totals.total, currency)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Special instructions or background..."
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
                    {creating ? 'Saving...' : 'Create Proposal'}
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
