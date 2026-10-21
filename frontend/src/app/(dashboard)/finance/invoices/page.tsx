'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Invoice, Customer, Project, InvoiceStatus } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/ui/export-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { TaxRateSelect, TaxRateHint, useTaxRates } from '@/components/ui/tax-rate-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Receipt,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Printer,
  ChevronLeft,
  ChevronRight,
  Clock,
  Ban,
} from 'lucide-react';

const statusBadgeStyles: Record<InvoiceStatus, { label: string; class: string }> = {
  DRAFT: { label: 'Draft', class: 'bg-muted text-muted-foreground border-border' },
  ISSUED: { label: 'Issued', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  UNPAID: { label: 'Unpaid', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  PARTIALLY_PAID: { label: 'Partially Paid', class: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
  PAID: { label: 'Paid', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  OVERDUE: { label: 'Overdue', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  VOID: { label: 'Void', class: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  CANCELLED: { label: 'Cancelled', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' },
};

interface NewItemRow {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? '');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Create Modal
  const [openCreate, setOpenCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    customerId: '',
    projectId: '',
    title: '',
    currency: 'INR',
    discount: 0,
    dueDate: '',
    notes: '',
    terms: '',
  });

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

  // Load Invoices
  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });

      const res = await apiFetch<{ success: boolean; data: Invoice[]; pagination: any }>(`/invoices?${params}`);
      setInvoices(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err) {
      console.error('Failed to load invoices', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [page, statusFilter]);

  // Load metadata for form
  useEffect(() => {
    async function loadMeta() {
      // Finance users can see customers but not projects, so one failing must not hide the other.
      const [custRes, projRes] = await Promise.allSettled([
        apiFetch<{ success: boolean; data: Customer[] }>('/customers?limit=100'),
        apiFetch<{ success: boolean; data: Project[] }>('/projects?limit=100'),
      ]);
      if (custRes.status === 'fulfilled') setCustomers(custRes.value.data);
      else console.error('Failed to load customers', custRes.reason);
      if (projRes.status === 'fulfilled') setProjects(projRes.value.data);
    }
    loadMeta();
  }, []);

  // Live item total calculation
  const calculateTotals = () => {
    let subtotal = 0;
    let itemDiscounts = 0;
    let taxTotal = 0;

    items.forEach((item) => {
      const gross = item.quantity * item.unitPrice;
      const net = Math.max(0, gross - (item.discount || 0));
      const tax = net * (item.taxRate || 0);

      subtotal += gross;
      itemDiscounts += item.discount || 0;
      taxTotal += tax;
    });

    const totalDiscount = itemDiscounts + (Number(formData.discount) || 0);
    const grandTotal = Math.max(0, subtotal - totalDiscount + taxTotal);

    return { subtotal, totalDiscount, taxTotal, grandTotal };
  };

  const totals = calculateTotals();

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: defaultFraction }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof NewItemRow, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.customerId) {
      setErrorMsg('Please select a customer.');
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customerId: formData.customerId,
          projectId: formData.projectId || undefined,
          title: formData.title || undefined,
          currency: formData.currency,
          discount: Number(formData.discount) || 0,
          dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
          notes: formData.notes || undefined,
          terms: formData.terms || undefined,
          items: items.map((i, idx) => ({
            description: i.description,
            quantity: Number(i.quantity) || 1,
            unitPrice: Number(i.unitPrice) || 0,
            discount: Number(i.discount) || 0,
            taxRate: Number(i.taxRate) || 0,
            order: idx + 1,
          })),
        }),
      });

      setOpenCreate(false);
      loadInvoices();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueInvoice = async (invoiceId: string) => {
    if (!confirm('Issue this invoice? This transitions the draft into a payable financial document.')) return;
    try {
      await apiFetch(`/invoices/${invoiceId}/issue`, { method: 'PATCH' });
      loadInvoices();
    } catch (err: any) {
      alert(err.message || 'Failed to issue invoice');
    }
  };

  const handleVoidInvoice = async (invoiceId: string) => {
    const reason = prompt('Enter reason for voiding this invoice:');
    if (reason === null) return;
    try {
      await apiFetch(`/invoices/${invoiceId}/void`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
      loadInvoices();
    } catch (err: any) {
      alert(err.message || 'Failed to void invoice');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Invoices Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage billing documents, view payment reconciliations and generate professional client invoices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu type="invoices-table" />
          <Button
            onClick={() => setOpenCreate(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border/70 bg-card">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoice number, title, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadInvoices()}
              className="pl-9 h-9 bg-secondary/50 border-border"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs px-3 rounded-md bg-secondary border border-border text-foreground font-medium"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="UNPAID">Unpaid / Issued</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="VOID">Void</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={loadInvoices}
              className="h-9 text-xs border-border"
            >
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card className="border-border/70 bg-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/70 bg-secondary/30">
                  <TableHead className="font-semibold text-xs">Invoice #</TableHead>
                  <TableHead className="font-semibold text-xs">Customer</TableHead>
                  <TableHead className="font-semibold text-xs">Status</TableHead>
                  <TableHead className="font-semibold text-xs">Due Date</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Total</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Balance Due</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                      Loading invoices...
                    </TableCell>
                  </TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                      No invoices found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => {
                    const badge = statusBadgeStyles[inv.status] || {
                      label: inv.status,
                      class: 'bg-muted text-muted-foreground',
                    };
                    const isOverdue = inv.status === 'OVERDUE';

                    return (
                      <TableRow
                        key={inv.id}
                        className="border-border/50 hover:bg-muted/40 transition-colors"
                      >
                        <TableCell>
                          <Link
                            href={`/finance/invoices/${inv.id}`}
                            className="font-mono text-sm font-semibold text-primary hover:underline flex items-center gap-1.5"
                          >
                            {inv.invoiceNumber}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </Link>
                          {inv.title && (
                            <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {inv.title}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm text-foreground">
                            {inv.customer?.name || 'Customer'}
                          </div>
                          {inv.project && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Proj: {inv.project.name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs px-2 py-0.5 font-medium ${badge.class}`}>
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-rose-500 font-semibold' : 'text-muted-foreground'}`}>
                            <Calendar className="h-3.5 w-3.5" />
                            {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm text-foreground">
                          {new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: inv.currency,
                          }).format(inv.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`text-sm font-semibold ${
                              inv.balanceDue > 0
                                ? isOverdue
                                  ? 'text-rose-500'
                                  : 'text-amber-500'
                                : 'text-emerald-500'
                            }`}
                          >
                            {new Intl.NumberFormat('en-IN', {
                              style: 'currency',
                              currency: inv.currency,
                            }).format(inv.balanceDue)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/finance/invoices/${inv.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-primary hover:bg-primary/10">
                                View
                              </Button>
                            </Link>

                            {inv.status === 'DRAFT' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleIssueInvoice(inv.id)}
                                className="h-8 px-2 text-xs border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                              >
                                Issue
                              </Button>
                            )}

                            {['ISSUED', 'UNPAID', 'DRAFT'].includes(inv.status) && inv.amountPaid === 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleVoidInvoice(inv.id)}
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                              >
                                Void
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
            <div className="flex items-center justify-between p-4 border-t border-border/70 text-xs text-muted-foreground">
              <div>
                Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, totalCount)} of {totalCount} invoices
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 font-medium text-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Create New Invoice
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generate a professional invoice with automatic decimal rounding and tax arithmetic.
                </p>
              </div>
              <button
                onClick={() => setOpenCreate(false)}
                className="text-muted-foreground hover:text-foreground p-1 text-sm rounded-lg"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-5">
              {/* Top Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Customer *
                  </label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    required
                    className="w-full h-9 rounded-md bg-secondary border border-border px-3 text-sm text-foreground"
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.companyName ? `(${c.companyName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Associated Project (Optional)
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full h-9 rounded-md bg-secondary border border-border px-3 text-sm text-foreground"
                  >
                    <option value="">No Project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Invoice Title / Subject
                  </label>
                  <Input
                    placeholder="e.g. Milestone 1 - Architectural Design"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="h-9 bg-secondary/50 border-border text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Due Date
                  </label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="h-9 bg-secondary/50 border-border text-sm"
                  />
                </div>
              </div>

              {/* Line Items Editor */}
              <div className="border border-border/70 rounded-lg p-4 bg-secondary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Line Items
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                    className="h-7 text-xs border-border flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Item
                  </Button>
                </div>
                <TaxRateHint rates={taxRates} loaded={taxRatesLoaded} />

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center bg-card p-2.5 rounded-lg border border-border/50 text-xs"
                    >
                      <div className="col-span-12 sm:col-span-5">
                        <Input
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          required
                          className="h-8 text-xs bg-secondary/40"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          min="1"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          required
                          className="h-8 text-xs bg-secondary/40"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Input
                          type="number"
                          placeholder="Unit Price"
                          min="0"
                          step="any"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          required
                          className="h-8 text-xs bg-secondary/40"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <TaxRateSelect
                          value={item.taxRate}
                          rates={taxRates}
                          onChange={(fraction) => handleItemChange(idx, 'taxRate', fraction)}
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={items.length === 1}
                          className="text-muted-foreground hover:text-rose-500 disabled:opacity-30 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculation Summary Box */}
                <div className="flex flex-col items-end gap-1.5 pt-3 border-t border-border/60 text-xs">
                  <div className="flex justify-between w-64 text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-foreground">
                      ₹{totals.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between w-64 text-muted-foreground">
                    <span>Tax (GST):</span>
                    <span className="font-semibold text-foreground">
                      +₹{totals.taxTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between w-64 items-center text-muted-foreground">
                    <span>Doc Discount:</span>
                    <Input
                      type="number"
                      min="0"
                      value={formData.discount}
                      onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                      className="w-24 h-7 text-xs bg-secondary/40 text-right"
                    />
                  </div>
                  <div className="flex justify-between w-64 text-sm font-bold text-primary pt-1.5 border-t border-border/80">
                    <span>Final Amount:</span>
                    <span>₹{totals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Client Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Notes visible to client..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full text-xs p-2 rounded-md bg-secondary/50 border border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Terms & Conditions
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Payment terms, bank details, penalties..."
                    value={formData.terms}
                    onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                    className="w-full text-xs p-2 rounded-md bg-secondary/50 border border-border text-foreground"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenCreate(false)}
                  disabled={submitting}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 px-5 shadow-sm"
                >
                  {submitting ? 'Generating Invoice...' : 'Create Invoice'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
