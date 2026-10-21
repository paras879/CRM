'use client';
import { AttachmentsPanel } from '@/components/ui/attachments-panel';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Invoice, PaymentMethod } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Receipt,
  ArrowLeft,
  Printer,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Clock,
  Send,
  Ban,
  FileCheck,
  Download,
} from 'lucide-react';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.invoiceId as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<{ name: string; email: string | null; phone: string | null; address: string | null } | null>(null);

  // Business details on the printed invoice come from Company Settings.
  useEffect(() => {
    apiFetch<{ data: { name: string; email: string | null; phone: string | null; address: string | null } }>('/settings/company')
      .then((res) => setCompany(res.data))
      .catch(() => setCompany(null));
  }, []);
  const [loading, setLoading] = useState(true);

  // Record Payment Dialog
  const [openPayment, setOpenPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ success: boolean; data: Invoice }>(`/invoices/${invoiceId}`);
      setInvoice(res.data);
      if (res.data) {
        setPaymentAmount(String(res.data.balanceDue));
      }
    } catch (err) {
      console.error('Failed to load invoice', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const handlePrint = () => {
    window.print();
  };

  const handleIssue = async () => {
    if (!confirm('Issue this invoice?')) return;
    try {
      await apiFetch(`/invoices/${invoiceId}/issue`, { method: 'PATCH' });
      loadInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to issue invoice');
    }
  };

  const handleVoid = async () => {
    const reason = prompt('Enter reason for voiding this invoice:');
    if (reason === null) return;
    try {
      await apiFetch(`/invoices/${invoiceId}/void`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
      loadInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to void invoice');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');

    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }

    if (invoice && amt > invoice.balanceDue) {
      setPaymentError(`Amount cannot exceed the balance due of ₹${invoice.balanceDue.toFixed(2)}.`);
      return;
    }

    try {
      setSubmittingPayment(true);
      await apiFetch('/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId,
          amount: amt,
          method: paymentMethod,
          reference: paymentRef || undefined,
          notes: paymentNotes || undefined,
        }),
      });

      setOpenPayment(false);
      loadInvoice();
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground text-sm">
        Loading invoice details...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-bold text-foreground">Invoice Not Found</h2>
        <p className="text-sm text-muted-foreground mt-1">The requested invoice could not be located.</p>
        <Link href="/finance/invoices">
          <Button variant="outline" className="mt-4">
            Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  const isPaid = invoice.status === 'PAID';
  const isOverdue = invoice.status === 'OVERDUE';
  const isDraft = invoice.status === 'DRAFT';

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Action Bar (Hidden on print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <span className="text-muted-foreground/60 text-xs">/</span>
          <span className="text-xs font-mono font-bold text-foreground">{invoice.invoiceNumber}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 text-xs flex items-center gap-1.5 border-border shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>

          <a
            href={`/api/v1/invoices/${invoice.id}/pdf`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium shadow-sm hover:bg-secondary"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </a>

          {isDraft && (
            <Button
              size="sm"
              onClick={handleIssue}
              className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center gap-1.5 shadow-sm"
            >
              <Send className="h-3.5 w-3.5" /> Issue Invoice
            </Button>
          )}

          {!isPaid && !isDraft && invoice.status !== 'VOID' && (
            <Button
              size="sm"
              onClick={() => setOpenPayment(true)}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1.5 shadow-sm"
            >
              <CreditCard className="h-3.5 w-3.5" /> Record Payment
            </Button>
          )}

          {invoice.amountPaid === 0 && invoice.status !== 'VOID' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleVoid}
              className="h-8 text-xs text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
            >
              <Ban className="h-3.5 w-3.5 mr-1" /> Void
            </Button>
          )}
        </div>
      </div>

      {/* Printable Invoice Container */}
      <div className="bg-card border border-border/80 rounded-xl shadow-lg p-8 sm:p-12 print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
        {/* Invoice Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-border/70 pb-8 print:border-neutral-300">
          <div>
            <div className="flex items-center gap-2 text-primary font-bold text-xl">
              <Receipt className="h-7 w-7" />
              <span>{company?.name ?? ''}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed print:text-neutral-600">
              {company?.address && (
                <>
                  {company.address}
                  <br />
                </>
              )}
              {[company?.email, company?.phone].filter(Boolean).join(' • ')}
            </p>
          </div>

          <div className="text-right">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground uppercase print:text-black">
              INVOICE
            </h1>
            <div className="font-mono text-base font-bold text-primary mt-1">
              {invoice.invoiceNumber}
            </div>
            <div className="mt-2">
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-0.5 font-bold uppercase ${
                  isPaid
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                    : isOverdue
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                }`}
              >
                {invoice.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Billed To & Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 my-8 text-xs">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 print:text-neutral-500">
              Billed To
            </h3>
            <div className="font-bold text-base text-foreground print:text-black">
              {invoice.customer?.name}
            </div>
            {invoice.customer?.companyName && (
              <div className="text-muted-foreground mt-0.5 font-medium print:text-neutral-700">
                {invoice.customer.companyName}
              </div>
            )}
            <div className="text-muted-foreground mt-1 leading-relaxed print:text-neutral-600">
              {invoice.customer?.address || 'Client Address'}<br />
              {invoice.customer?.city ? `${invoice.customer.city}, ` : ''}
              {invoice.customer?.state || ''} {invoice.customer?.zipCode || ''}<br />
              {invoice.customer?.email && <div>{invoice.customer.email}</div>}
              {invoice.customer?.taxId && (
                <div className="mt-1 font-mono font-medium">GSTIN/Tax ID: {invoice.customer.taxId}</div>
              )}
            </div>
          </div>

          <div className="space-y-2 text-right">
            <div className="flex justify-between sm:justify-end gap-6 text-muted-foreground print:text-neutral-600">
              <span>Issue Date:</span>
              <span className="font-medium text-foreground print:text-black">
                {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : 'Draft'}
              </span>
            </div>
            <div className="flex justify-between sm:justify-end gap-6 text-muted-foreground print:text-neutral-600">
              <span>Due Date:</span>
              <span className={`font-semibold ${isOverdue ? 'text-rose-500' : 'text-foreground print:text-black'}`}>
                {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Net 15 Days'}
              </span>
            </div>
            {invoice.project && (
              <div className="flex justify-between sm:justify-end gap-6 text-muted-foreground print:text-neutral-600">
                <span>Project:</span>
                <span className="font-medium text-foreground print:text-black">{invoice.project.name}</span>
              </div>
            )}
            <div className="flex justify-between sm:justify-end gap-6 text-muted-foreground print:text-neutral-600">
              <span>Currency:</span>
              <span className="font-semibold text-foreground print:text-black">{invoice.currency}</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto my-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-border/80 text-muted-foreground font-bold uppercase tracking-wider print:border-neutral-400">
                <th className="py-2.5">#</th>
                <th className="py-2.5">Description</th>
                <th className="py-2.5 text-right">Qty</th>
                <th className="py-2.5 text-right">Unit Price</th>
                <th className="py-2.5 text-right">Tax Rate</th>
                <th className="py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 print:divide-neutral-200">
              {invoice.items.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-muted/30">
                  <td className="py-3 text-muted-foreground font-mono">{index + 1}</td>
                  <td className="py-3 font-medium text-foreground pr-4 print:text-black">
                    {item.description}
                  </td>
                  <td className="py-3 text-right font-mono text-muted-foreground print:text-black">
                    {item.quantity}
                  </td>
                  <td className="py-3 text-right font-mono text-muted-foreground print:text-black">
                    ₹{item.unitPrice.toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-mono text-muted-foreground print:text-black">
                    {(item.taxRate * 100).toFixed(0)}%
                  </td>
                  <td className="py-3 text-right font-mono font-semibold text-foreground print:text-black">
                    ₹{item.lineTotal.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t border-border/70 pt-6 my-6 print:border-neutral-300">
          <div className="space-y-4 max-w-sm text-xs text-muted-foreground print:text-neutral-600">
            {invoice.notes && (
              <div>
                <h4 className="font-bold text-foreground text-xs uppercase mb-1 print:text-black">Notes</h4>
                <p className="leading-relaxed whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <h4 className="font-bold text-foreground text-xs uppercase mb-1 print:text-black">Terms & Conditions</h4>
                <p className="leading-relaxed whitespace-pre-line">{invoice.terms}</p>
              </div>
            )}
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <span className="font-mono font-medium text-foreground print:text-black">
                ₹{invoice.subtotal.toFixed(2)}
              </span>
            </div>

            {invoice.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-500">
                <span>Discount Applied:</span>
                <span className="font-mono font-medium">-₹{invoice.discountTotal.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-muted-foreground">
              <span>Applicable Tax (GST):</span>
              <span className="font-mono font-medium text-foreground print:text-black">
                +₹{invoice.taxTotal.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-base font-bold text-foreground border-t border-border/80 pt-2 print:border-neutral-400 print:text-black">
              <span>Invoice Total:</span>
              <span className="font-mono text-primary font-bold">
                ₹{invoice.total.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-muted-foreground pt-1">
              <span>Amount Paid:</span>
              <span className="font-mono font-medium text-emerald-500">
                ₹{invoice.amountPaid.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-sm font-bold border-t border-border/50 pt-2">
              <span className={invoice.balanceDue > 0 ? (isOverdue ? 'text-rose-500' : 'text-amber-500') : 'text-emerald-500'}>
                Balance Due:
              </span>
              <span className={`font-mono ${invoice.balanceDue > 0 ? (isOverdue ? 'text-rose-500' : 'text-amber-500') : 'text-emerald-500'}`}>
                ₹{invoice.balanceDue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Payments History List */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="mt-8 border-t border-border/70 pt-6 print:border-neutral-300">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-500" />
              Recorded Payments & Ledger History
            </h3>
            <div className="rounded-lg border border-border/60 overflow-hidden text-xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40 border-border/60">
                    <TableHead className="py-2">Date</TableHead>
                    <TableHead className="py-2">Method</TableHead>
                    <TableHead className="py-2">Reference</TableHead>
                    <TableHead className="py-2">Status</TableHead>
                    <TableHead className="py-2 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.payments.map((p) => (
                    <TableRow key={p.id} className="border-border/40">
                      <TableCell>{new Date(p.paidAt).toLocaleDateString()}</TableCell>
                      <TableCell className="capitalize">{p.method.replace('_', ' ').toLowerCase()}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{p.reference || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-emerald-500">
                        ₹{p.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={openPayment} onOpenChange={setOpenPayment}>
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-500" />
                Record Invoice Payment
              </h2>
              <button
                onClick={() => setOpenPayment(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            {paymentError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {paymentError}
              </div>
            )}

            <div className="p-3 bg-secondary/50 rounded-lg border border-border/60 text-xs flex justify-between items-center">
              <span className="text-muted-foreground">Outstanding Balance Due:</span>
              <span className="text-sm font-bold text-amber-500 font-mono">
                ₹{invoice.balanceDue.toFixed(2)}
              </span>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Payment Amount (₹) *
                </label>
                <Input
                  type="number"
                  min="0.01"
                  max={invoice.balanceDue}
                  step="any"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  className="h-9 bg-secondary/50 border-border text-sm font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full h-9 rounded-md bg-secondary border border-border px-3 text-xs text-foreground font-medium"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Transaction / Cheque Reference #
                </label>
                <Input
                  placeholder="e.g. HDFC-UTR-992019"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="h-9 bg-secondary/50 border-border text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Internal Notes
                </label>
                <Input
                  placeholder="Notes about bank receipt..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="h-9 bg-secondary/50 border-border text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenPayment(false)}
                  disabled={submittingPayment}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-5 shadow-sm"
                >
                  {submittingPayment ? 'Recording...' : 'Confirm Payment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Files</h2>
        <AttachmentsPanel entityType="invoice" entityId={invoiceId} />
      </section>
    </div>
  );
}
