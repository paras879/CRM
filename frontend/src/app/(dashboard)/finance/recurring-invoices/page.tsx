'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Pause, Play, Plus, Repeat, Trash2, Zap } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { TaxRateSelect, TaxRateHint, useTaxRates } from '@/components/ui/tax-rate-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Frequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

interface Schedule {
  id: string;
  title: string;
  customer: string | null;
  currency: string;
  frequency: Frequency;
  intervalCount: number;
  nextRunDate: string;
  endDate: string | null;
  autoIssue: boolean;
  isActive: boolean;
  generatedCount: number;
  items: LineItem[];
  discount: number;
}

interface CustomerOption {
  id: string;
  name: string;
}

const FREQUENCY_LABEL: Record<Frequency, string> = {
  WEEKLY: 'week',
  MONTHLY: 'month',
  QUARTERLY: 'quarter',
  YEARLY: 'year',
};

const emptyItem = (taxRate: number): LineItem => ({ description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate });

function cadence(s: Schedule) {
  const unit = FREQUENCY_LABEL[s.frequency];
  return s.intervalCount === 1 ? `Every ${unit}` : `Every ${s.intervalCount} ${unit}s`;
}

function scheduleTotal(s: Schedule) {
  const net = s.items.reduce((sum, i) => {
    const line = Math.max(0, i.quantity * i.unitPrice - (i.discount || 0));
    return sum + line + line * (i.taxRate || 0);
  }, 0);
  return Math.max(0, net - (s.discount || 0));
}

export default function RecurringInvoicesPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('invoices.create');
  const canUpdate = hasPermission('invoices.update');

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { rates: taxRates, loaded: taxRatesLoaded, defaultFraction } = useTaxRates();

  // Create dialog
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [frequency, setFrequency] = useState<Frequency>('MONTHLY');
  const [intervalCount, setIntervalCount] = useState(1);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [dueInDays, setDueInDays] = useState(14);
  const [autoIssue, setAutoIssue] = useState(false);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyItem(0)]);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: Schedule[] }>('/recurring-invoices');
      setSchedules(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load recurring invoices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    apiFetch<{ data: CustomerOption[] }>('/customers?limit=100')
      .then((res) => setCustomers(res.data))
      .catch(() => setCustomers([]));
  }, [load]);

  useEffect(() => {
    if (!taxRatesLoaded || defaultFraction === 0) return;
    setItems((prev) =>
      prev.length === 1 && !prev[0].description && prev[0].unitPrice === 0 && prev[0].taxRate === 0
        ? [{ ...prev[0], taxRate: defaultFraction }]
        : prev
    );
  }, [taxRatesLoaded, defaultFraction]);

  const run = async (action: () => Promise<unknown>, fallback: string, success?: string) => {
    setError(null);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    }
  };

  const updateItem = (index: number, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const resetForm = () => {
    setTitle('');
    setCustomerId('');
    setFrequency('MONTHLY');
    setIntervalCount(1);
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate('');
    setDueInDays(14);
    setAutoIssue(false);
    setNotes('');
    setItems([emptyItem(defaultFraction)]);
    setFormError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await apiFetch('/recurring-invoices', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          customerId,
          currency: currency.trim().toUpperCase(),
          frequency,
          intervalCount,
          startDate,
          endDate: endDate || null,
          dueInDays,
          autoIssue,
          notes: notes.trim() || null,
          items: items.map((i) => ({ ...i, description: i.description.trim() })),
        }),
      });
      setOpen(false);
      resetForm();
      await load();
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details) && err.details.length > 0) {
        const first = err.details[0] as { field?: string; message?: string };
        setFormError(first.field ? `${first.field}: ${first.message}` : String(first.message ?? err.message));
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Failed to create the schedule.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formTotal = items.reduce((sum, i) => {
    const line = Math.max(0, i.quantity * i.unitPrice - (i.discount || 0));
    return sum + line + line * (i.taxRate || 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Recurring Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Invoices are created automatically on each schedule. Checked every 15 minutes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                run(
                  async () => {
                    const res = await apiFetch<{ data: { generated: unknown[]; failed: unknown[] } }>('/recurring-invoices/run-due', {
                      method: 'POST',
                    });
                    setNotice(
                      res.data.generated.length === 0 && res.data.failed.length === 0
                        ? 'Nothing is due right now.'
                        : `${res.data.generated.length} invoice(s) generated, ${res.data.failed.length} failed.`
                    );
                  },
                  'Failed to run due schedules.'
                )
              }
            >
              <Zap className="h-3.5 w-3.5" /> Run Due Now
            </Button>
          )}
          {canCreate && (
            <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New Schedule
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Schedule</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Repeats</TableHead>
                <TableHead>Next invoice</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                {(canCreate || canUpdate) && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">
                    Loading schedules...
                  </TableCell>
                </TableRow>
              ) : schedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                    <Repeat className="h-5 w-5 mx-auto mb-2 text-muted-foreground/60" />
                    No recurring invoices yet. Create a schedule for retainers, subscriptions or any repeat billing.
                  </TableCell>
                </TableRow>
              ) : (
                schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{s.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.generatedCount} generated{s.autoIssue ? ' · auto-issued' : ' · saved as draft'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{s.customer ?? '-'}</TableCell>
                    <TableCell className="text-sm">{cadence(s)}</TableCell>
                    <TableCell className="text-sm">{s.isActive ? formatDate(s.nextRunDate) : '-'}</TableCell>
                    <TableCell className="text-sm text-right font-mono">{formatCurrency(scheduleTotal(s), s.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? 'default' : 'secondary'}>{s.isActive ? 'Active' : 'Paused / Ended'}</Badge>
                    </TableCell>
                    {(canCreate || canUpdate) && (
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        {canCreate && s.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Generate next invoice for ${s.title} now`}
                            title="Generate next invoice now"
                            onClick={() =>
                              run(
                                () => apiFetch(`/recurring-invoices/${s.id}/generate`, { method: 'POST' }),
                                'Failed to generate the invoice.',
                                'Invoice generated. Find it under Invoices.'
                              )
                            }
                          >
                            <Zap className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={s.isActive ? `Pause ${s.title}` : `Resume ${s.title}`}
                            title={s.isActive ? 'Pause schedule' : 'Resume schedule'}
                            onClick={() =>
                              run(
                                () =>
                                  apiFetch(`/recurring-invoices/${s.id}`, {
                                    method: 'PUT',
                                    body: JSON.stringify({ isActive: !s.isActive }),
                                  }),
                                'Failed to update the schedule.'
                              )
                            }
                          >
                            {s.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete ${s.title}`}
                            title="Delete schedule"
                            onClick={() => {
                              if (confirm(`Delete "${s.title}"? Invoices already created are kept.`)) {
                                run(() => apiFetch(`/recurring-invoices/${s.id}`, { method: 'DELETE' }), 'Failed to delete the schedule.');
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
        title="New recurring invoice"
        description="Each run creates an invoice from these details."
        className="max-w-3xl"
      >
        {formError && <Alert variant="destructive" className="mb-4">{formError}</Alert>}
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="rec-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <div className="space-y-1.5">
              <label htmlFor="rec-customer" className="text-sm font-medium block">Customer</label>
              <select
                id="rec-customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="rec-frequency" className="text-sm font-medium block">Repeats</label>
              <div className="flex gap-2">
                <Input
                  id="rec-interval"
                  aria-label="Repeat every"
                  type="number"
                  min={1}
                  max={24}
                  value={intervalCount}
                  onChange={(e) => setIntervalCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20"
                />
                <select
                  id="rec-frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as Frequency)}
                  className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="WEEKLY">Week(s)</option>
                  <option value="MONTHLY">Month(s)</option>
                  <option value="QUARTERLY">Quarter(s)</option>
                  <option value="YEARLY">Year(s)</option>
                </select>
              </div>
            </div>
            <Input id="rec-currency" label="Currency" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} required />
            <Input id="rec-start" label="First invoice date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            <Input id="rec-end" label="Stop after (optional)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <Input
              id="rec-due"
              label="Payment due (days after invoice)"
              type="number"
              min={0}
              max={365}
              value={dueInDays}
              onChange={(e) => setDueInDays(Math.max(0, parseInt(e.target.value) || 0))}
            />
            <label className="flex items-center gap-2 text-sm pt-7">
              <input type="checkbox" checked={autoIssue} onChange={(e) => setAutoIssue(e.target.checked)} />
              Issue invoices automatically (otherwise saved as drafts)
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Line items</h3>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setItems((p) => [...p, emptyItem(defaultFraction)])}>
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>
            <TaxRateHint rates={taxRates} loaded={taxRatesLoaded} />
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-12 sm:col-span-4">
                  <Input aria-label="Description" placeholder="Description" value={item.description} onChange={(e) => updateItem(idx, { description: e.target.value })} required className="h-8 text-xs" />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Input aria-label="Quantity" type="number" min="0" step="any" value={item.quantity} onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })} required className="h-8 text-xs" />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input aria-label="Unit price" type="number" min="0" step="any" value={item.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })} required className="h-8 text-xs" />
                </div>
                <div className="col-span-5 sm:col-span-2">
                  <Input aria-label="Discount amount" type="number" min="0" step="any" value={item.discount} onChange={(e) => updateItem(idx, { discount: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
                </div>
                <div className="col-span-10 sm:col-span-2">
                  <TaxRateSelect value={item.taxRate} rates={taxRates} onChange={(taxRate) => updateItem(idx, { taxRate })} />
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    aria-label="Remove line item"
                    disabled={items.length === 1}
                    onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Columns: description, quantity, unit price, discount amount, tax.</p>
            <p className="text-sm font-medium text-right">Per invoice: {formatCurrency(formTotal, currency || 'INR')}</p>
          </div>

          <Input id="rec-notes" label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Schedule'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
