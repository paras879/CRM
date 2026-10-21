'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { apiFetch, ApiError } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Company {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
}

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
}

interface Currency {
  id: string;
  code: string;
  symbol: string;
  isDefault: boolean;
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('company.update');

  const [error, setError] = useState<string | null>(null);

  // Company profile
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);

  // Tax rates
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [taxName, setTaxName] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [taxDefault, setTaxDefault] = useState(false);

  // Currencies
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyCode, setCurrencyCode] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('');
  const [editingCurrencyId, setEditingCurrencyId] = useState<string | null>(null);
  const [editingSymbol, setEditingSymbol] = useState('');

  const load = useCallback(async () => {
    try {
      const [company, taxes, curr] = await Promise.all([
        apiFetch<{ data: Company }>('/settings/company'),
        apiFetch<{ data: TaxRate[] }>('/settings/tax-rates'),
        apiFetch<{ data: Currency[] }>('/settings/currencies'),
      ]);
      setName(company.data.name);
      setEmail(company.data.email ?? '');
      setPhone(company.data.phone ?? '');
      setAddress(company.data.address ?? '');
      setBaseCurrency(company.data.currency);
      setTaxRates(taxes.data);
      setCurrencies(curr.data);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load settings.'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(errorMessage(err, fallback));
    }
  };

  const saveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompany(true);
    setCompanySaved(false);
    await run(async () => {
      await apiFetch('/settings/company', {
        method: 'PUT',
        body: JSON.stringify({ name, email, phone, address }),
      });
      setCompanySaved(true);
    }, 'Failed to save company profile.');
    setSavingCompany(false);
  };

  const addTaxRate = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      await apiFetch('/settings/tax-rates', {
        method: 'POST',
        body: JSON.stringify({ name: taxName, rate: Number(taxRate), isDefault: taxDefault }),
      });
      setTaxName('');
      setTaxRate('');
      setTaxDefault(false);
    }, 'Failed to add tax rate.');
  };

  const addCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      await apiFetch('/settings/currencies', {
        method: 'POST',
        body: JSON.stringify({ code: currencyCode, symbol: currencySymbol }),
      });
      setCurrencyCode('');
      setCurrencySymbol('');
    }, 'Failed to add currency.');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Company Settings</h1>
        <p className="text-sm text-muted-foreground">
          Business profile, tax rates and currencies used across proposals, estimates and invoices.
        </p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company profile</CardTitle>
          <CardDescription>Base currency: {baseCurrency || '—'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveCompany} className="grid gap-4 sm:grid-cols-2">
            <Input id="company-name" label="Company name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required />
            <Input id="company-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEdit} />
            <Input id="company-phone" label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} />
            <Input id="company-address" label="Address" value={address} onChange={(e) => setAddress(e.target.value)} disabled={!canEdit} />
            {canEdit && (
              <div className="sm:col-span-2 flex items-center gap-3">
                <Button type="submit" size="sm" disabled={savingCompany}>
                  {savingCompany ? 'Saving...' : 'Save Profile'}
                </Button>
                {companySaved && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                    <Check className="h-3.5 w-3.5" /> Saved
                  </span>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tax rates</CardTitle>
          <CardDescription>Percentages you can reuse on line items. One rate can be the default.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Default</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxRates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                    No tax rates yet. Add your first rate below.
                  </TableCell>
                </TableRow>
              ) : (
                taxRates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm font-medium">{t.name}</TableCell>
                    <TableCell className="text-sm">{t.rate}%</TableCell>
                    <TableCell>{t.isDefault && <Badge>Default</Badge>}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right space-x-1">
                        {!t.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Make ${t.name} default`}
                            onClick={() =>
                              run(
                                () => apiFetch(`/settings/tax-rates/${t.id}`, { method: 'PUT', body: JSON.stringify({ isDefault: true }) }),
                                'Failed to update tax rate.'
                              )
                            }
                          >
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${t.name}`}
                          onClick={() => {
                            if (confirm(`Delete tax rate "${t.name}"?`)) {
                              run(() => apiFetch(`/settings/tax-rates/${t.id}`, { method: 'DELETE' }), 'Failed to delete tax rate.');
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {canEdit && (
            <form onSubmit={addTaxRate} className="grid gap-3 sm:grid-cols-[1fr_8rem_auto_auto] items-end">
              <Input id="tax-name" label="Name" value={taxName} onChange={(e) => setTaxName(e.target.value)} required />
              <Input id="tax-rate" label="Rate (%)" type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} required />
              <label className="flex items-center gap-2 text-sm h-10">
                <input type="checkbox" checked={taxDefault} onChange={(e) => setTaxDefault(e.target.checked)} />
                Default
              </label>
              <Button type="submit" size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Tax Rate
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Currencies</CardTitle>
          <CardDescription>The default currency is also the base currency of the company.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Default</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                    No currencies yet. The first one you add becomes the default.
                  </TableCell>
                </TableRow>
              ) : (
                currencies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium">{c.code}</TableCell>
                    <TableCell className="text-sm">
                      {editingCurrencyId === c.id ? (
                        <Input
                          aria-label={`Symbol for ${c.code}`}
                          className="h-8 w-24"
                          maxLength={8}
                          autoFocus
                          value={editingSymbol}
                          onChange={(e) => setEditingSymbol(e.target.value)}
                        />
                      ) : (
                        c.symbol
                      )}
                    </TableCell>
                    <TableCell>{c.isDefault && <Badge>Default</Badge>}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        {editingCurrencyId === c.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Save symbol"
                              disabled={!editingSymbol.trim()}
                              onClick={async () => {
                                await run(
                                  () =>
                                    apiFetch(`/settings/currencies/${c.id}`, {
                                      method: 'PUT',
                                      body: JSON.stringify({ symbol: editingSymbol.trim() }),
                                    }),
                                  'Failed to update currency.'
                                );
                                setEditingCurrencyId(null);
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" aria-label="Cancel" onClick={() => setEditingCurrencyId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Edit ${c.code} symbol`}
                              title="Edit symbol"
                              onClick={() => {
                                setEditingCurrencyId(c.id);
                                setEditingSymbol(c.symbol);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {!c.isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Make ${c.code} default`}
                                title="Make default"
                                onClick={() => run(() => apiFetch(`/settings/currencies/${c.id}/default`, { method: 'POST' }), 'Failed to set default currency.')}
                              >
                                <Star className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {/* The default currency can only be removed when it is the last one left. */}
                            {(!c.isDefault || currencies.length === 1) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Delete ${c.code}`}
                                title="Delete"
                                onClick={() => {
                                  if (confirm(`Delete currency ${c.code}?${c.isDefault ? ' You will need to add a new default afterwards.' : ''}`)) {
                                    run(() => apiFetch(`/settings/currencies/${c.id}`, { method: 'DELETE' }), 'Failed to delete currency.');
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {canEdit && (
            <form onSubmit={addCurrency} className="grid gap-3 sm:grid-cols-[8rem_8rem_auto] items-end">
              <Input id="currency-code" label="Code" maxLength={3} placeholder="e.g. INR" value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} required />
              <Input id="currency-symbol" label="Symbol" maxLength={8} value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} required />
              <Button type="submit" size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Currency
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
