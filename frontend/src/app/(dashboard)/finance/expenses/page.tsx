'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Expense, ExpenseCategory, Customer, Project, ExpenseApprovalStatus } from '@/types';
import { formatCurrency, formatCurrencyTotals } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUploadField } from '@/components/ui/file-upload-field';
import { ExportMenu } from '@/components/ui/export-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Wallet,
  Plus,
  Search,
  Calendar,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  Tag,
  Paperclip,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';

const approvalBadgeStyles: Record<ExpenseApprovalStatus, { label: string; class: string }> = {
  PENDING: { label: 'Pending Approval', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  APPROVED: { label: 'Approved', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  REJECTED: { label: 'Rejected', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' },
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('approvalStatus') ?? '');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Create Expense Modal
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create Category Modal
  const [openCreateCategory, setOpenCreateCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number>(150);
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (search) params.append('search', search);
      if (categoryFilter) params.append('category', categoryFilter);
      if (statusFilter) params.append('approvalStatus', statusFilter);

      const res = await apiFetch<any>(`/expenses?${params.toString()}`);
      if (res && res.data) {
        setExpenses(res.data);
        if (res.meta) {
          setTotalPages(res.meta.totalPages || 1);
          setTotalCount(res.meta.total || res.data.length);
        } else {
          setTotalCount(res.data.length);
        }
      }
    } catch (err: any) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuxData = async () => {
    // Each list is optional: Finance users cannot read projects, and that must not hide categories or customers.
    const [catRes, cRes, pRes] = await Promise.allSettled([
      apiFetch<any>('/expenses/categories'),
      apiFetch<any>('/customers?limit=100'),
      apiFetch<any>('/projects?limit=100'),
    ]);
    if (catRes.status === 'fulfilled' && catRes.value?.data) setCategories(catRes.value.data);
    if (cRes.status === 'fulfilled' && cRes.value?.data) setCustomers(cRes.value.data);
    if (pRes.status === 'fulfilled' && pRes.value?.data) setProjects(pRes.value.data);
  };

  useEffect(() => {
    loadAuxData();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [page, search, categoryFilter, statusFilter]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter an expense title');
      return;
    }
    if (amount <= 0) {
      setFormError('Expense amount must be greater than 0');
      return;
    }

    setCreating(true);
    setFormError('');

    try {
      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          title,
          amount: Number(amount),
          expenseDate: new Date(expenseDate).toISOString(),
          categoryId: categoryId || undefined,
          customerId: customerId || undefined,
          projectId: projectId || undefined,
          paymentMethod,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          receiptUrl: receiptUrl.trim() || undefined,
        }),
      });

      setSuccessMsg('Expense recorded successfully!');
      setOpenCreate(false);
      resetForm();
      fetchExpenses();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record expense');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      const res = await apiFetch<any>('/expenses/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim(), description: newCatDesc.trim() || undefined }),
      });
      if (res && res.data) {
        setCategories([...categories, res.data]);
        setCategoryId(res.data.id);
      }
      setOpenCreateCategory(false);
      setNewCatName('');
      setNewCatDesc('');
    } catch (err: any) {
      alert(err?.message || 'Failed to create category');
    } finally {
      setCreatingCat(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setAmount(150);
    setCategoryId('');
    setCustomerId('');
    setProjectId('');
    setReferenceNumber('');
    setNotes('');
    setReceiptUrl('');
  };

  const handleApprove = async (id: string) => {
    try {
      await apiFetch(`/expenses/${id}/approve`, { method: 'POST' });
      setSuccessMsg('Expense approved');
      fetchExpenses();
    } catch (err: any) {
      alert(err?.message || 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await apiFetch(`/expenses/${id}/reject`, { method: 'POST' });
      setSuccessMsg('Expense rejected');
      fetchExpenses();
    } catch (err: any) {
      alert(err?.message || 'Failed to reject');
    }
  };

  // Metrics
  const totalAmount = formatCurrencyTotals(expenses, (ex) => ex.amount, (ex) => ex.currency);
  const approvedTotal = formatCurrencyTotals(
    expenses.filter((e) => e.approvalStatus === 'APPROVED'),
    (e) => e.amount,
    (e) => e.currency
  );
  const pendingCount = expenses.filter((e) => e.approvalStatus === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" />
            Business Expenses
          </h1>
          <p className="text-sm text-muted-foreground">
            Track operational outlays, billable client expenses, category breakdowns, and audit approvals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu type="expenses-table" />
          <Button
            variant="outline"
            onClick={() => setOpenCreateCategory(true)}
            className="gap-2 border-border/70 hover:border-primary/50 text-foreground"
          >
            <Tag className="w-4 h-4 text-primary" />
            New Category
          </Button>
          <Button onClick={() => setOpenCreate(true)} className="gap-2 bg-primary hover:bg-primary/90 text-white">
            <Plus className="w-4 h-4" />
            Record Expense
          </Button>
        </div>
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Outlay</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {totalAmount}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{totalCount} recorded expenses</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Wallet className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-muted-foreground">Approved Expenses</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {approvedTotal}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Authorized for reimbursement/tax</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-muted-foreground">Pending Approvals</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Awaiting management sign-off</p>
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
                placeholder="Search expense title, ref..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 bg-secondary/50 border-border/70"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-44 bg-secondary/50 border border-border/70 rounded-md text-sm px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-44 bg-secondary/50 border border-border/70 rounded-md text-sm px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card className="border border-border/70 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/40">
              <TableRow>
                <TableHead className="font-medium text-xs uppercase">Title & Details</TableHead>
                <TableHead className="font-medium text-xs uppercase">Category</TableHead>
                <TableHead className="font-medium text-xs uppercase">Date</TableHead>
                <TableHead className="font-medium text-xs uppercase">Customer / Project</TableHead>
                <TableHead className="font-medium text-xs uppercase text-right">Amount</TableHead>
                <TableHead className="font-medium text-xs uppercase text-center">Approval</TableHead>
                <TableHead className="font-medium text-xs uppercase text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>Loading expenses...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Wallet className="w-10 h-10 text-muted-foreground/40" />
                      <p className="font-medium text-base text-foreground">No expenses recorded</p>
                      <p className="text-xs">Log outlays, recurring bills, and operational expenses with receipt tracking.</p>
                      <Button onClick={() => setOpenCreate(true)} size="sm" className="mt-2">
                        Record Expense
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((ex) => {
                  const badge = approvalBadgeStyles[ex.approvalStatus] || {
                    label: ex.approvalStatus,
                    class: 'bg-muted text-muted-foreground',
                  };

                  return (
                    <TableRow key={ex.id} className="hover:bg-secondary/30 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{ex.title}</span>
                          {ex.referenceNumber && (
                            <span className="text-xs font-mono text-muted-foreground">Ref: {ex.referenceNumber}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-border/70 text-xs bg-secondary/40">
                          {ex.categoryRef?.name || (typeof ex.category === 'string' ? ex.category : (ex.category as any)?.name) || 'General'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(ex.incurredAt || (ex as any).expenseDate || ex.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ex.customer ? (
                          <span className="flex items-center gap-1 text-foreground font-medium">
                            <Building className="w-3.5 h-3.5 text-primary" />
                            {ex.customer.companyName || ex.customer.name}
                          </span>
                        ) : ex.project ? (
                          <span className="text-foreground">{ex.project.name || (ex.project as any).projectName}</span>
                        ) : (
                          'Internal Overhead'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground">
                        {formatCurrency(ex.amount, ex.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-xs ${badge.class}`}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {ex.receiptUrl && (
                            <a
                              href={ex.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline p-1 flex items-center gap-1"
                              title="View Receipt"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {ex.approvalStatus === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleApprove(ex.id)}
                                className="h-7 w-7 p-0 text-emerald-600 dark:text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleReject(ex.id)}
                                className="h-7 w-7 p-0 text-rose-600 dark:text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
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

      {/* Record Expense Modal */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        {openCreate && (
          <div className="fixed inset-0 z-50 flex p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto [&>*]:m-auto">
            <div className="w-full max-w-2xl bg-card border border-border/80 rounded-xl shadow-2xl p-6 space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  Record New Expense
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

              <form onSubmit={handleCreateExpense} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Expense Title <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. AWS Cloud Server Hosting Oct 2026"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="bg-secondary/50 border-border/70"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Amount (INR) <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      className="bg-secondary/50 border-border/70"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Expense Date</label>
                    <Input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="bg-secondary/50 border-border/70"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Category</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full bg-secondary/50 border border-border/70 rounded-md text-sm px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-secondary/50 border border-border/70 rounded-md text-sm px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CREDIT_CARD">Credit Card</option>
                      <option value="CASH">Cash</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Billable Customer (Optional)</label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full bg-secondary/50 border border-border/70 rounded-md text-sm px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">None (Internal)</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName || c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Project (Optional)</label>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full bg-secondary/50 border border-border/70 rounded-md text-sm px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">None</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name || p.projectName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Reference / Invoice #</label>
                    <Input
                      placeholder="e.g. INV-VENDOR-8910"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="bg-secondary/50 border-border/70"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Receipt</label>
                    <FileUploadField value={receiptUrl} onChange={setReceiptUrl} disabled={creating} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Notes / Justification</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Expense details or business purpose..."
                    rows={2}
                    className="w-full text-xs bg-secondary/50 border border-border/70 rounded-md p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
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
                    {creating ? 'Saving...' : 'Record Expense'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Dialog>

      {/* Create Category Modal */}
      <Dialog open={openCreateCategory} onOpenChange={setOpenCreateCategory}>
        {openCreateCategory && (
          <div className="fixed inset-0 z-50 flex p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto [&>*]:m-auto">
            <div className="w-full max-w-md bg-card border border-border/80 rounded-xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Tag className="w-5 h-5 text-primary" />
                  New Expense Category
                </h3>
                <button onClick={() => setOpenCreateCategory(false)} className="text-muted-foreground hover:text-foreground">
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateCategory} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Category Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Office Supplies, Travel, Software Licensing..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="bg-secondary/50 border-border/70"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Description (Optional)</label>
                  <textarea
                    placeholder="Brief description of deductible outlays..."
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    rows={2}
                    className="w-full text-xs bg-secondary/50 border border-border/70 rounded-md p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/70">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenCreateCategory(false)}
                    disabled={creatingCat}
                    className="border-border/70"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creatingCat} className="bg-primary hover:bg-primary/90 text-white gap-2">
                    {creatingCat ? 'Adding...' : 'Add Category'}
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
