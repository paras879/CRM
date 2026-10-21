'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { apiFetch } from '@/lib/api';
import { FinancialSummary } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { getDisplayName } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Plus,
  Receipt,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { MetricTile } from './staff-dashboard';
import { ExportMenu } from '@/components/ui/export-menu';

const DAY_MS = 24 * 60 * 60 * 1000;

const CARD = 'bg-card rounded-xl border border-border/70 shadow-sm p-6 space-y-4';
const CARD_HEAD = 'flex items-start justify-between gap-3 border-b border-border/70 pb-3';
const CARD_TITLE = 'text-lg font-semibold tracking-tight text-foreground flex items-center gap-2';
const CARD_LINK = 'text-primary hover:underline text-xs font-semibold flex items-center gap-1 shrink-0';

const INVOICE_STATUS: Record<string, { label: string; bar: string }> = {
  PAID: { label: 'Paid', bar: 'bg-emerald-500' },
  PARTIALLY_PAID: { label: 'Partially paid', bar: 'bg-sky-500' },
  ISSUED: { label: 'Issued', bar: 'bg-indigo-500' },
  UNPAID: { label: 'Unpaid', bar: 'bg-amber-500' },
  OVERDUE: { label: 'Overdue', bar: 'bg-red-500' },
};

function money(value: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value || 0);
}

function daysOverdue(due?: string | null): number {
  if (!due) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(due).getTime()) / DAY_MS));
}

interface FinanceDashboardProps {
  /** `home` is the landing dashboard for finance users; `page` is the standalone Finance Overview. */
  variant?: 'home' | 'page';
}

export function FinanceDashboard({ variant = 'home' }: FinanceDashboardProps) {
  const { user, hasPermission } = useAuth();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [currency, setCurrency] = useState('INR');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: FinancialSummary }>('/finance-dashboard/summary');
      setSummary(res.data);
      setLoadFailed(false);
      const currencies = Object.keys(res.data.currencyMetrics);
      if (currencies.length > 0) {
        setCurrency((current) => (currencies.includes(current) ? current : currencies[0]));
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approveExpense(id: string) {
    setApprovingId(id);
    try {
      await apiFetch(`/expenses/${id}/approve`, { method: 'POST' });
      await load();
    } catch {
      // the expense stays in the list if approval fails
    } finally {
      setApprovingId(null);
    }
  }

  const currencies = summary ? Object.keys(summary.currencyMetrics) : [];
  const m = summary?.currencyMetrics[currency] ?? {
    totalInvoiced: 0,
    totalReceived: 0,
    outstandingBalance: 0,
    overdueAmount: 0,
    totalExpenses: 0,
  };
  const fmt = (value: number) => money(value, currency);
  const collectionRate = m.totalInvoiced > 0 ? Math.round((m.totalReceived / m.totalInvoiced) * 100) : 0;
  const net = m.totalReceived - m.totalExpenses;

  const action = summary?.actionNeeded;
  const expiringCount = summary?.expiringContracts.length ?? 0;
  const attention = [
    {
      label: 'Overdue invoices',
      hint: 'Past due date and still unpaid',
      count: action?.overdueInvoiceCount ?? 0,
      href: '/finance/invoices?status=OVERDUE',
      tone: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
      show: hasPermission('invoices.view'),
    },
    {
      label: 'Draft invoices to issue',
      hint: 'Created but not yet sent to the client',
      count: action?.draftInvoiceCount ?? 0,
      href: '/finance/invoices?status=DRAFT',
      tone: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
      show: hasPermission('invoices.view'),
    },
    {
      label: 'Expenses awaiting approval',
      hint: 'Submitted and waiting for a decision',
      count: action?.pendingExpenseCount ?? 0,
      href: '/finance/expenses?approvalStatus=PENDING',
      tone: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
      show: hasPermission('expenses.view'),
    },
    {
      label: 'Contracts expiring soon',
      hint: 'Ending within 30 days or already expired',
      count: expiringCount,
      href: '/sales/contracts',
      tone: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
      show: hasPermission('contracts.view'),
    },
  ].filter((item) => item.show);
  const attentionTotal = attention.reduce((sum, item) => sum + item.count, 0);

  const statusEntries = Object.entries(summary?.statusDistribution ?? {}).filter(([, count]) => count > 0);
  const statusTotal = statusEntries.reduce((sum, [, count]) => sum + count, 0);
  const categoryMax = Math.max(1, ...(summary?.expenseByCategory ?? []).map((c) => c.totalAmount));

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-6 rounded-xl border border-border/70 shadow-sm">
        <div>
          {variant === 'home' ? (
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h2 className="text-2xl md:text-[28px] font-bold tracking-tight text-foreground">
                Welcome back, {getDisplayName(user)}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 text-[11px] font-semibold">
                Finance
              </span>
            </div>
          ) : (
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 mb-1">
              <TrendingUp className="h-6 w-6 text-primary" /> Finance Overview
            </h2>
          )}
          <p className="text-[15px] text-muted-foreground">
            What is billed, what is paid, and what needs your attention.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:flex-nowrap md:shrink-0">
          <ExportMenu type="finance-summary" label="Download summary" />
          {hasPermission('invoices.create') && (
            <Link
              href="/finance/invoices"
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 shadow-sm"
            >
              <Plus className="h-[18px] w-[18px]" /> New Invoice
            </Link>
          )}
          {hasPermission('payments.record') && (
            <Link
              href="/finance/payments"
              className="px-4 py-2 bg-card border border-border/70 hover:bg-secondary/50 text-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <CreditCard className="h-[18px] w-[18px]" /> Record Payment
            </Link>
          )}
          {hasPermission('expenses.create') && (
            <Link
              href="/finance/expenses"
              className="px-4 py-2 bg-card border border-border/70 hover:bg-secondary/50 text-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <Wallet className="h-[18px] w-[18px]" /> Add Expense
            </Link>
          )}
        </div>
      </div>

      {loadFailed && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-foreground flex items-center justify-between gap-3">
          <span>We couldn&apos;t load the finance numbers. Check your connection and try again.</span>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              load();
            }}
            className="px-3 py-1.5 rounded-md border border-border/70 bg-card text-xs font-semibold hover:bg-secondary/50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Currency switcher */}
      {currencies.length > 1 && (
        <div className="flex items-center gap-2 bg-secondary p-1 rounded-lg border border-border w-fit">
          <span className="text-xs font-medium text-muted-foreground px-2">Currency</span>
          {currencies.map((cur) => (
            <button
              key={cur}
              type="button"
              onClick={() => setCurrency(cur)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                currency === cur ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {cur}
            </button>
          ))}
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricTile
          label="Total Invoiced"
          value={fmt(m.totalInvoiced)}
          href="/finance/invoices"
          isLoading={isLoading}
          icon={Receipt}
          iconClass="text-blue-600 bg-blue-500/10 dark:text-blue-400"
        >
          <span className="text-muted-foreground">Issued bills in {currency}</span>
        </MetricTile>
        <MetricTile
          label="Total Received"
          value={fmt(m.totalReceived)}
          valueClass="text-emerald-600 dark:text-emerald-400"
          href="/finance/payments"
          isLoading={isLoading}
          icon={Banknote}
          iconClass="text-emerald-600 bg-emerald-500/10 dark:text-emerald-400"
        >
          <span className="text-muted-foreground">{collectionRate}% of invoiced collected</span>
        </MetricTile>
        <MetricTile
          label="Outstanding"
          value={fmt(m.outstandingBalance)}
          valueClass="text-amber-600 dark:text-amber-400"
          href="/finance/invoices?status=UNPAID"
          isLoading={isLoading}
          icon={Clock}
          iconClass="text-amber-600 bg-amber-500/10 dark:text-amber-400"
        >
          <span className="text-muted-foreground">Still to be collected</span>
        </MetricTile>
        <MetricTile
          label="Overdue"
          value={fmt(m.overdueAmount)}
          valueClass={m.overdueAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}
          href="/finance/invoices?status=OVERDUE"
          isLoading={isLoading}
          icon={AlertTriangle}
          iconClass="text-red-600 bg-red-500/10 dark:text-red-400"
        >
          <span className="text-muted-foreground">Unpaid past the due date</span>
        </MetricTile>
        <MetricTile
          label="Expenses"
          value={fmt(m.totalExpenses)}
          valueClass="text-purple-600 dark:text-purple-400"
          href="/finance/expenses"
          isLoading={isLoading}
          icon={Wallet}
          iconClass="text-purple-600 bg-purple-500/10 dark:text-purple-400"
        >
          <span className="text-muted-foreground">Approved spend only</span>
        </MetricTile>
        <MetricTile
          label="Net Cash Position"
          value={fmt(net)}
          valueClass={net < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}
          isLoading={isLoading}
          icon={TrendingUp}
          iconClass="text-teal-600 bg-teal-500/10 dark:text-teal-400"
        >
          <span className="text-muted-foreground">Received minus approved expenses</span>
        </MetricTile>
      </div>

      {/* Needs attention + collections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div>
              <h3 className={CARD_TITLE}>
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Needs Attention
              </h3>
              <p className="text-xs text-muted-foreground">Things waiting on you today</p>
            </div>
            {!isLoading && attentionTotal > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 text-xs font-semibold">
                {attentionTotal} open
              </span>
            )}
          </div>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : attentionTotal === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm font-semibold text-foreground">All clear</p>
              <p className="text-xs text-muted-foreground">No overdue invoices, drafts or pending approvals.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {attention.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 py-3 hover:text-primary transition-colors focus:outline-none focus:underline"
                  >
                    <span>
                      <span className={`block text-[13px] ${item.count > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                        {item.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">{item.hint}</span>
                    </span>
                    <span
                      className={`min-w-[28px] text-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        item.count > 0 ? item.tone : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {item.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div>
              <h3 className={CARD_TITLE}>
                <FileText className="h-5 w-5 text-primary" /> Collections
              </h3>
              <p className="text-xs text-muted-foreground">How much of your billing has been paid</p>
            </div>
            <Link href="/finance/invoices" className={CARD_LINK}>
              Invoices <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : statusTotal === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">No issued invoices yet.</div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Collected in {currency}</span>
                  <span className="font-semibold text-foreground">{collectionRate}%</span>
                </div>
                <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, collectionRate)}%` }} />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Invoices by status ({statusTotal})</p>
                <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-secondary">
                  {statusEntries.map(([status, count]) => (
                    <div
                      key={status}
                      className={INVOICE_STATUS[status]?.bar ?? 'bg-slate-400'}
                      style={{ width: `${(count / statusTotal) * 100}%` }}
                      title={`${INVOICE_STATUS[status]?.label ?? status}: ${count}`}
                    />
                  ))}
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {statusEntries.map(([status, count]) => (
                    <li key={status} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className={`h-2 w-2 rounded-full ${INVOICE_STATUS[status]?.bar ?? 'bg-slate-400'}`} />
                        {INVOICE_STATUS[status]?.label ?? status}
                      </span>
                      <span className="font-semibold text-foreground">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overdue invoices + pending approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hasPermission('invoices.view') && (
          <div className={CARD}>
            <div className={CARD_HEAD}>
              <div>
                <h3 className={CARD_TITLE}>
                  <Receipt className="h-5 w-5 text-red-500" /> Overdue Invoices
                </h3>
                <p className="text-xs text-muted-foreground">Oldest first, so chase these before the rest</p>
              </div>
              <Link href="/finance/invoices?status=OVERDUE" className={CARD_LINK}>
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !action || action.overdueInvoices.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">Nothing is overdue. Nice.</div>
            ) : (
              <ul className="divide-y divide-border/70">
                {action.overdueInvoices.map((inv) => (
                  <li key={inv.id}>
                    <Link
                      href={`/finance/invoices/${inv.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-secondary/30 -mx-2 px-2 rounded-md transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-primary">{inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground truncate">{inv.customerName ?? 'Customer'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-semibold text-foreground">{money(inv.balance, inv.currency)}</p>
                        <p className="text-[11px] text-red-600 dark:text-red-400">{daysOverdue(inv.dueDate)} days overdue</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {hasPermission('expenses.view') && (
          <div className={CARD}>
            <div className={CARD_HEAD}>
              <div>
                <h3 className={CARD_TITLE}>
                  <Wallet className="h-5 w-5 text-purple-500" /> Expense Approvals
                </h3>
                <p className="text-xs text-muted-foreground">Submitted expenses waiting for a decision</p>
              </div>
              <Link href="/finance/expenses?approvalStatus=PENDING" className={CARD_LINK}>
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !action || action.pendingExpenses.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">No expenses are waiting for approval.</div>
            ) : (
              <ul className="divide-y divide-border/70">
                {action.pendingExpenses.map((exp) => (
                  <li key={exp.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{exp.description}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {exp.category}
                        {exp.vendor ? ` • ${exp.vendor}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[13px] font-semibold text-foreground">{money(exp.amount, exp.currency)}</span>
                      {hasPermission('expenses.approve') && (
                        <button
                          type="button"
                          disabled={approvingId === exp.id}
                          onClick={() => approveExpense(exp.id)}
                          className="px-3 py-1 rounded bg-card border border-border/70 text-xs font-semibold hover:bg-secondary/50 disabled:opacity-50"
                        >
                          {approvingId === exp.id ? 'Approving…' : 'Approve'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Expiring contracts */}
      {expiringCount > 0 && summary && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground">Contracts approaching expiry</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                These client agreements end within 30 days. Reach out to agree on renewals.
              </p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {summary.expiringContracts.map((c) => (
                  <Link
                    key={c.id}
                    href="/sales/contracts"
                    className="p-3 bg-card border border-border/70 rounded-lg flex items-center justify-between hover:border-primary/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">{c.subject}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {c.customer?.name} &bull; {c.contractNumber}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        {c.calculatedStatus === 'EXPIRED' ? 'Expired' : 'Expiring soon'}
                      </div>
                      {c.endDate && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(c.endDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent payments + expenses by category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div>
              <h3 className={CARD_TITLE}>
                <CreditCard className="h-5 w-5 text-emerald-500" /> Recent Payments
              </h3>
              <p className="text-xs text-muted-foreground">The latest money received</p>
            </div>
            <Link href="/finance/payments" className={CARD_LINK}>
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !summary || summary.recentPayments.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">No payments recorded yet.</div>
          ) : (
            <ul className="divide-y divide-border/70">
              {summary.recentPayments.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-primary">{p.invoice?.invoiceNumber ?? '-'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.invoice?.customer?.name ?? 'Customer'} &bull; {p.method.replace(/_/g, ' ').toLowerCase()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">{money(p.amount, p.currency)}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(p.paidAt).toLocaleDateString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div>
              <h3 className={CARD_TITLE}>
                <Wallet className="h-5 w-5 text-purple-500" /> Spend by Category
              </h3>
              <p className="text-xs text-muted-foreground">Approved expenses, largest first</p>
            </div>
            <Link href="/finance/expenses" className={CARD_LINK}>
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !summary || summary.expenseByCategory.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">No approved expenses yet.</div>
          ) : (
            <ul className="space-y-3">
              {[...summary.expenseByCategory]
                .sort((a, b) => b.totalAmount - a.totalAmount)
                .map((c) => (
                  <li key={c.category}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground font-medium">
                        {c.category} <span className="text-muted-foreground font-normal">({c.count})</span>
                      </span>
                      <span className="font-semibold text-foreground">{fmt(c.totalAmount)}</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div className="bg-purple-500 h-full rounded-full" style={{ width: `${(c.totalAmount / categoryMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
