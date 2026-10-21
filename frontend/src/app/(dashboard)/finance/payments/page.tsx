'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Payment, PaymentMethod } from '@/types';
import { formatCurrency, formatCurrencyTotals } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/ui/export-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  CreditCard,
  Search,
  Calendar,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Building,
  User,
  ShieldCheck,
} from 'lucide-react';

const methodLabels: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  CARD: 'Credit / Debit Card',
  CREDIT_CARD: 'Credit Card',
  OTHER: 'Other',
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Reversal dialog
  const [reversePaymentTarget, setReversePaymentTarget] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);
  const [reverseError, setReverseError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (search) params.append('search', search);

      const res = await apiFetch<any>(`/payments?${params.toString()}`);
      if (res && res.data) {
        let items: Payment[] = res.data;
        if (methodFilter) {
          items = items.filter((p: Payment) => (p.paymentMethod || p.method) === methodFilter);
        }
        setPayments(items);
        if (res.meta) {
          setTotalPages(res.meta.totalPages || 1);
          setTotalCount(res.meta.total || items.length);
        } else {
          setTotalCount(items.length);
        }
      }
    } catch (err: any) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page, search, methodFilter]);

  const handleReversePayment = async () => {
    if (!reversePaymentTarget) return;
    if (!reversalReason.trim()) {
      setReverseError('Please provide a reason for reversal');
      return;
    }
    setReversing(true);
    setReverseError('');
    try {
      await apiFetch(`/payments/${reversePaymentTarget.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: reversalReason.trim() }),
      });
      setSuccessMsg(`Payment ${reversePaymentTarget.paymentNumber} has been successfully reversed.`);
      setReversePaymentTarget(null);
      setReversalReason('');
      fetchPayments();
    } catch (err: any) {
      setReverseError(err?.message || 'Failed to reverse payment');
    } finally {
      setReversing(false);
    }
  };

  // Metrics
  const activePayments = payments.filter((p) => !p.isReversed);
  const totalAmountActive = formatCurrencyTotals(activePayments, (p) => p.amount, (p) => p.currency);
  const reversedCount = payments.filter((p) => p.isReversed).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Payments & Collections
          </h1>
          <p className="text-sm text-muted-foreground">
            Reconcile customer collections, audit payment histories, and manage transaction reversals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu type="payments-table" />
          <Link href="/finance/invoices">
            <Button variant="outline" className="gap-2 border-border/70 hover:border-primary/50">
              <Receipt className="w-4 h-4 text-primary" />
              View Invoices
            </Button>
          </Link>
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
              <p className="text-xs uppercase font-medium text-muted-foreground">Active Collections</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {totalAmountActive}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{activePayments.length} valid transactions</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-muted-foreground">Total Transactions</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{totalCount}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Recorded on system</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <CreditCard className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-card hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-muted-foreground">Reversals & Corrections</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{reversedCount}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Audited reversals</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <RotateCcw className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card className="border border-border/70 bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search payment #, ref, invoice..."
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
                value={methodFilter}
                onChange={(e) => {
                  setMethodFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-48 bg-secondary/50 border border-border/70 rounded-md text-sm px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Payment Methods</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card className="border border-border/70 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/40">
              <TableRow>
                <TableHead className="font-medium text-xs uppercase">Payment Ref</TableHead>
                <TableHead className="font-medium text-xs uppercase">Invoice</TableHead>
                <TableHead className="font-medium text-xs uppercase">Date</TableHead>
                <TableHead className="font-medium text-xs uppercase">Method</TableHead>
                <TableHead className="font-medium text-xs uppercase">Transaction Ref</TableHead>
                <TableHead className="font-medium text-xs uppercase text-right">Amount</TableHead>
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
                      <span>Loading payments...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CreditCard className="w-10 h-10 text-muted-foreground/40" />
                      <p className="font-medium text-base text-foreground">No payments found</p>
                      <p className="text-xs">Record incoming payments directly against issued customer invoices.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => {
                  return (
                    <TableRow key={p.id} className="hover:bg-secondary/30 transition-colors">
                      <TableCell className="font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-mono">{p.paymentNumber || p.reference || `PAY-${p.id.slice(0, 8)}`}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.invoice ? (
                          <Link
                            href={`/finance/invoices/${p.invoice.id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            {p.invoice.invoiceNumber}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">{p.invoiceId.slice(0, 8)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(p.paymentDate || p.paidAt || p.createdAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs border-border/80 bg-secondary/50">
                          {methodLabels[(p.paymentMethod || p.method) as PaymentMethod] || p.paymentMethod || p.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {p.transactionReference || p.reference || '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground">
                        {formatCurrency(p.amount, p.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.isReversed ? (
                          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-xs">
                            Reversed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                            Completed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {p.invoice && (
                            <Link href={`/finance/invoices/${p.invoice.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          )}
                          {!p.isReversed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReversePaymentTarget(p);
                                setReversalReason('');
                                setReverseError('');
                              }}
                              className="h-8 px-2 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                              title="Reverse Payment"
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" />
                              Reverse
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

      {/* Reverse Payment Dialog */}
      <Dialog open={!!reversePaymentTarget} onOpenChange={() => setReversePaymentTarget(null)}>
        {reversePaymentTarget && (
          <div className="fixed inset-0 z-50 flex p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto [&>*]:m-auto">
            <div className="w-full max-w-md bg-card border border-border/80 rounded-xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  Reverse Payment
                </h3>
                <button onClick={() => setReversePaymentTarget(null)} className="text-muted-foreground hover:text-foreground">
                  &times;
                </button>
              </div>

              {reverseError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{reverseError}</span>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                You are about to reverse payment <span className="font-bold text-foreground">{reversePaymentTarget.paymentNumber}</span> for{' '}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(reversePaymentTarget.amount, reversePaymentTarget.currency)}</span>.
                This will deduct the paid amount from invoice balance and restore its status. This action is permanently audited.
              </p>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Reason for Reversal <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="e.g. Bounced cheque, erroneous charge, duplicate entry..."
                  rows={3}
                  className="w-full text-sm bg-secondary/50 border border-border/70 rounded-md p-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/70">
                <Button
                  variant="outline"
                  onClick={() => setReversePaymentTarget(null)}
                  disabled={reversing}
                  className="border-border/70"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReversePayment}
                  disabled={reversing || !reversalReason.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-white gap-2"
                >
                  {reversing ? 'Reversing...' : 'Confirm Reversal'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
